using Clubline;
using Microsoft.Extensions.Configuration;
using System.Net;
using Xunit;
public class ProviderTests
{
    private sealed class Handler : HttpMessageHandler, IHttpClientFactory
    {
        public List<(string Key, string Account, string Body)> Requests = new();
        public HttpStatusCode Code = HttpStatusCode.OK;
        public HttpClient CreateClient(string name) => new(this, disposeHandler:false);
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Requests.Add((request.Headers.GetValues("Idempotency-Key").Single(),request.Headers.GetValues("Stripe-Account").Single(),await request.Content!.ReadAsStringAsync(ct)));
            return new HttpResponseMessage(Code) { Content = new StringContent("{\"id\":\"re_test\",\"status\":\"pending\"}") };
        }
    }
    [Fact] public async Task RetriesPreserveProviderKeyAndMerchantAccount()
    {
        var handler=new Handler(); var cfg=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> {{"Billing:SecretKey","sk_test_fixture"}}).Build(); var gateway=new StripeGateway(handler,cfg);
        for(var i=0;i<2;i++)await gateway.Request("refunds",new(){{"amount","1200"},{"payment_intent","pi_test"}},"same-operation","acct_test");
        Assert.Equal(handler.Requests[0],handler.Requests[1]); Assert.Contains("amount=1200",handler.Requests[0].Body); Assert.Equal("acct_test",handler.Requests[0].Account);
    }
    [Fact] public async Task ProviderFailureCannotReturnSuccess()
    {
        var handler=new Handler{Code=HttpStatusCode.BadGateway}; var cfg=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> {{"Billing:SecretKey","sk_test_fixture"}}).Build(); var gateway=new StripeGateway(handler,cfg);
        var ex=await Assert.ThrowsAsync<DomainError>(()=>gateway.Request("refunds",new(),"operation","acct_test")); Assert.Equal(502,ex.Status);
    }
    [Fact] public async Task MissingProviderConfigurationMakesNoNetworkRequest()
    {
        var handler=new Handler(); var gateway=new StripeGateway(handler,new ConfigurationBuilder().Build()); var ex=await Assert.ThrowsAsync<DomainError>(()=>gateway.Request("refunds",new(),"operation","acct_test")); Assert.Equal(503,ex.Status);Assert.Empty(handler.Requests);
    }
}
public class CurrencyBoundaryTests
{
    [Theory][InlineData("USD",12345,12345)][InlineData("JPY",500,500)][InlineData("ISK",500,50000)][InlineData("UGX",500,50000)]
    public void ProviderAmountsPreserveTheDisplayedCharge(string currency,long internalMinor,long providerMinor)
    {
        Assert.Equal(providerMinor,StripeAmounts.ToProvider(internalMinor,currency));
        Assert.Equal(internalMinor,StripeAmounts.FromProvider(providerMinor,currency));
    }
    [Fact] public void FractionalLegacyProviderAmountRequiresReview() => Assert.Throws<DomainError>(()=>StripeAmounts.FromProvider(101,"ISK"));
}
