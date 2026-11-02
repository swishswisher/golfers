using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Clubline;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

[assembly: CollectionBehavior(DisableTestParallelization = true)]
namespace ClublineIntegration;

// Only the provider's HTTP transport is simulated. Identity, cookies, CSRF, endpoint
// authorization, EF transactions, migrations, signed webhooks and outbox are real.
public sealed class GatewayFixture : WebApplicationFactory<Program>
{
    public readonly ProviderTransport Provider = new();
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureTestServices(s => s.AddSingleton<IHttpClientFactory>(new ProviderClients(Provider)));
    }
    public async Task<(ApiClient Api, Guid Club, Guid Member)> Club(string currency)
    {
        using var scope = Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var email = Guid.NewGuid().ToString("N") + "@gateway.clubline.test";
        var user = new AppUser { UserName = email, Email = email, EmailConfirmed = true, DisplayName = "Provider test owner" };
        Assert.True((await users.CreateAsync(user, "GatewayTest!2026")).Succeeded);
        var api = new ApiClient(CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("http://localhost"), AllowAutoRedirect = false }));
        await api.Csrf(); await api.Send("/api/auth/login", new { email, password = "GatewayTest!2026" }); await api.Csrf();
        var club = (await api.Send("/api/clubs", new { name = "Demonstration gateway test", country = "GB", currency, timeZone = "UTC", sports = new[] { "Tennis" }, brandColor = "#235c45" })).GetProperty("id").GetGuid();
        var db = scope.ServiceProvider.GetRequiredService<AppDb>(); scope.ServiceProvider.GetRequiredService<TenantContext>().ClubId = club;
        var c = await db.Clubs.SingleAsync(x => x.Id == club); c.IsDemonstration = true; c.StripeAccountId = "acct_" + club.ToString("N"); c.ChargesEnabled = true;
        var pref = await db.Preferences.SingleAsync(); pref.Email = false; pref.Push = false;
        var member = await db.Members.SingleAsync(); await db.SaveChangesAsync();
        return (api, club, member.Id);
    }
    public async Task<T> Read<T>(Guid club, Func<AppDb, Task<T>> read)
    {
        using var scope = Services.CreateScope(); scope.ServiceProvider.GetRequiredService<TenantContext>().ClubId = club;
        return await read(scope.ServiceProvider.GetRequiredService<AppDb>());
    }
    public async Task Webhook(ApiClient api, string type, object obj, string? account = null, string? id = null)
    {
        var body = JsonSerializer.Serialize(new { id = id ?? "evt_" + Guid.NewGuid().ToString("N"), type, livemode = false, created = DateTimeOffset.UtcNow.ToUnixTimeSeconds(), account, data = new { @object = obj } });
        // Platform events omit account entirely, matching Stripe's envelope.
        if (account is null) { var node = System.Text.Json.Nodes.JsonNode.Parse(body)!; node.AsObject().Remove("account"); body = node.ToJsonString(); }
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        var signature = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes("gateway-test-signature-secret"), Encoding.UTF8.GetBytes(timestamp + "." + body))).ToLowerInvariant();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/webhooks/stripe") { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        request.Headers.Add("Stripe-Signature", "t=" + timestamp + ",v1=" + signature);
        var response = await api.Http.SendAsync(request); Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
    }
}
public sealed class GatewayTests(GatewayFixture fixture) : IClassFixture<GatewayFixture>
{
    [Fact]
    public async Task Activity_checkout_signed_duplicate_payment_and_refund_preserve_amount_and_reservation()
    {
        var (api, club, member) = await fixture.Club("UGX"); var path = "/api/clubs/" + club;
        var start = DateTimeOffset.UtcNow.AddDays(2);
        var a = await api.Send(path + "/activities", new { title = "Paid transport test", description = "Recorded test activity", kind = "Social", sport = "Tennis", startsAt = start, endsAt = start.AddHours(1), place = "Court one", capacity = 4, priceMinor = 500, audience = "All" });
        var aid = a.GetProperty("id").GetGuid(); await api.Send(path + "/activities/" + aid + "/publish", new { });
        var reg = await api.Send(path + "/activities/" + aid + "/register", new { memberId = member, consent = true, joinWaitlist = false }); var rid = reg.GetProperty("id").GetGuid();
        var checkout = await api.Send(path + "/registrations/" + rid + "/checkout", new { });
        Assert.Equal(checkout.GetProperty("url").GetString(), (await api.Send(path + "/registrations/" + rid + "/checkout", new { })).GetProperty("url").GetString());
        var payment = await fixture.Read(club, d => d.Payments.AsNoTracking().SingleAsync(x => x.RegistrationId == rid));
        var request = fixture.Provider.Checkout(payment.ProviderId!); Assert.Equal("50000", request["line_items[0][price_data][unit_amount]"]);
        Assert.True(long.Parse(request["expires_at"]) > DateTimeOffset.UtcNow.AddMinutes(30).ToUnixTimeSeconds());
        var account = "acct_" + club.ToString("N"); var evt = "evt_" + Guid.NewGuid().ToString("N");
        var paid = new { id = payment.ProviderId, metadata = new { paymentId = payment.Id, clubId = club }, amount_total = 50000, currency = "ugx", payment_status = "paid", payment_intent = "pi_" + payment.Id.ToString("N") };
        await fixture.Webhook(api, "checkout.session.completed", paid, account, evt); await fixture.Webhook(api, "checkout.session.completed", paid, account, evt);
        Assert.Equal("Confirmed", await fixture.Read(club, d => d.Registrations.Where(x => x.Id == rid).Select(x => x.Status).SingleAsync()));
        var refundBody = new { amountMinor = 200, reason = "Verified test refund", operationKey = Guid.NewGuid().ToString() };
        var refund = await api.Send(path + "/payments/" + payment.Id + "/refund", refundBody);
        Assert.Equal(refund.GetProperty("id").GetGuid(), (await api.Send(path + "/payments/" + payment.Id + "/refund", refundBody)).GetProperty("id").GetGuid());
        using var scope = fixture.Services.CreateScope(); var worker = ActivatorUtilities.CreateInstance<JobWorker>(scope.ServiceProvider);
        for (var i = 0; i < 20 && await worker.Dispatch(CancellationToken.None); i++) { }
        Assert.Contains(fixture.Provider.Requests, x => x.Path == "refunds" && x.Fields.GetValueOrDefault("amount") == "20000" && x.Account == account);
        var refundId = refund.GetProperty("id").GetGuid(); var confirmed = new { id = "re_fixture", metadata = new { refundId }, amount = 20000, payment_intent = paid.payment_intent, status = "succeeded" };
        await fixture.Webhook(api, "refund.updated", confirmed, account); await fixture.Webhook(api, "refund.updated", confirmed, account);
        await fixture.Webhook(api, "refund.updated", new { confirmed.id, confirmed.metadata, confirmed.amount, confirmed.payment_intent, status = "pending" }, account);
        Assert.Equal(200, await fixture.Read(club, d => d.Payments.Where(x => x.Id == payment.Id).Select(x => x.RefundedMinor).SingleAsync()));
        Assert.Equal("Confirmed", await fixture.Read(club, d => d.Refunds.Where(x => x.Id == refundId).Select(x => x.Status).SingleAsync()));
    }
    [Fact]
    public async Task Expired_membership_checkout_can_restart_and_only_signed_payment_renews()
    {
        var (api, club, member) = await fixture.Club("ISK"); var path = "/api/clubs/" + club; var renewal = DateTimeOffset.UtcNow.AddYears(1);
        var p = await api.Send(path + "/fees", new { memberId = member, amountMinor = 1500, description = "Annual test membership", renewalUntil = renewal, operationKey = Guid.NewGuid().ToString() }); var id = p.GetProperty("id").GetGuid();
        var first = await api.Send(path + "/payments/" + id + "/checkout", new { });
        var payment = await fixture.Read(club, d => d.Payments.AsNoTracking().SingleAsync(x => x.Id == id)); var old = payment.ProviderId!;
        fixture.Provider.SetSessionStatus(old, "expired");
        var next = await api.Send(path + "/payments/" + id + "/checkout", new { }); Assert.NotEqual(first.GetProperty("url").GetString(), next.GetProperty("url").GetString());
        Assert.Equal(next.GetProperty("url").GetString(), (await api.Send(path + "/payments/" + id + "/checkout", new { })).GetProperty("url").GetString());
        payment = await fixture.Read(club, d => d.Payments.AsNoTracking().SingleAsync(x => x.Id == id)); Assert.NotEqual(old, payment.ProviderId);
        Assert.Equal("150000", fixture.Provider.Checkout(payment.ProviderId!)["line_items[0][price_data][unit_amount]"]);
        Assert.Null(await fixture.Read(club, d => d.Members.Where(x => x.Id == member).Select(x => x.RenewalAt).SingleAsync()));
        await fixture.Webhook(api, "checkout.session.completed", new { id = payment.ProviderId, metadata = new { paymentId = id, clubId = club }, amount_total = 150000, currency = "isk", payment_status = "paid", payment_intent = "pi_fee" }, "acct_" + club.ToString("N"));
        Assert.True(await fixture.Read(club, d => d.Members.Where(x => x.Id == member).Select(x => x.RenewalAt > DateTimeOffset.UtcNow.AddMonths(11)).SingleAsync()));
    }
    [Fact]
    public async Task Lost_subscription_response_recovers_same_intent_and_retired_events_cannot_overwrite_it()
    {
        var (api, club, _) = await fixture.Club("GBP"); var path = "/api/clubs/" + club;
        fixture.Provider.LoseNextSubscriptionResponse = true;
        await api.Send(path + "/billing/checkout", new { plan = "Club", operationKey = "lost-" + club }, 500);
        var recovered = await api.Send(path + "/billing/checkout", new { plan = "Club", operationKey = "retry-" + club }); Assert.Contains("checkout.stripe.com", recovered.GetProperty("url").GetString());
        var sub = await fixture.Read(club, d => d.Subscriptions.AsNoTracking().SingleAsync());
        var calls = fixture.Provider.Requests.Where(x => x.Fields.GetValueOrDefault("subscription_data[metadata][clubId]") == club.ToString()).ToList(); Assert.Equal(2, calls.Count); Assert.Equal(calls[0].Key, calls[1].Key); Assert.Equal(calls[0].Fields, calls[1].Fields);
        var sid = "sub_" + club.ToString("N"); var current = new { id = sid, status = "active", customer = "cus_" + club.ToString("N"), metadata = new { clubId = club, plan = "Club", checkoutKey = sub.CheckoutKey }, current_period_end = DateTimeOffset.UtcNow.AddMonths(1).ToUnixTimeSeconds(), cancel_at_period_end = false };
        fixture.Provider.Subscriptions[sid] = JsonSerializer.SerializeToElement(current);
        await fixture.Webhook(api, "customer.subscription.created", current);
        await fixture.Webhook(api, "customer.subscription.updated", new { id = "sub_retired", metadata = new { clubId = club, plan = "Community", checkoutKey = "retired-intent" } });
        sub = await fixture.Read(club, d => d.Subscriptions.AsNoTracking().SingleAsync()); Assert.Equal(sid, sub.ProviderId); Assert.Equal("Active", sub.Status); Assert.Equal("Club", sub.Plan);
        await api.Send(path + "/billing/checkout", new { plan = "Club", operationKey = "must-not-duplicate" }, 409);
        await api.Send(path + "/billing/cancel", new { }); await api.Send(path + "/billing/cancel", new { });
        var cancellations = fixture.Provider.Requests.Where(x => x.Path == "subscriptions/" + sid && x.Fields.ContainsKey("cancel_at_period_end")).ToList(); Assert.Equal(2, cancellations.Count); Assert.Equal(cancellations[0].Key, cancellations[1].Key);
        var invoice = new { id = "in_" + club.ToString("N"), customer = current.customer, subscription = sid, amount_paid = 7900, currency = "gbp", hosted_invoice_url = "https://invoice.stripe.com/test" };
        await fixture.Webhook(api, "invoice.paid", invoice); await fixture.Webhook(api, "invoice.paid", invoice);
        Assert.Equal(1, await fixture.Read(club, d => d.Invoices.CountAsync()));
    }
}
public sealed class ApiClient(HttpClient http)
{
    public HttpClient Http => http;
    public async Task Csrf() { var data = await http.GetFromJsonAsync<JsonElement>("/api/auth/csrf"); http.DefaultRequestHeaders.Remove("X-CSRF-TOKEN"); http.DefaultRequestHeaders.Add("X-CSRF-TOKEN", data.GetProperty("token").GetString()); }
    public async Task<JsonElement> Send(string path, object input, int? expected = null)
    {
        using var response = await http.PostAsJsonAsync(path, input); var body = await response.Content.ReadAsStringAsync();
        if (expected is null) Assert.True(response.IsSuccessStatusCode, path + ": " + body); else Assert.Equal(expected, (int)response.StatusCode);
        return string.IsNullOrWhiteSpace(body) ? default : JsonSerializer.Deserialize<JsonElement>(body);
    }
}
public sealed class ProviderClients(ProviderTransport transport) : IHttpClientFactory
{
    public HttpClient CreateClient(string name) => new(transport, disposeHandler: false);
}
public record ProviderCall(string Path, string? Key, string? Account, Dictionary<string, string> Fields);
public sealed class ProviderTransport : HttpMessageHandler
{
    public readonly List<ProviderCall> Requests = [];
    public readonly Dictionary<string, JsonElement> Subscriptions = [];
    private readonly Dictionary<string, JsonElement> sessions = [];
    private readonly Dictionary<string, (string Id, Dictionary<string, string> Fields)> intents = [];
    public bool LoseNextSubscriptionResponse;
    public Dictionary<string, string> Checkout(string id) => intents.Values.Single(x => x.Id == id).Fields;
    public void SetSessionStatus(string id, string status) => sessions[id] = JsonSerializer.SerializeToElement(new { id, status, url = "https://checkout.stripe.com/" + id });
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var path = request.RequestUri!.AbsolutePath[4..];
        var fields = request.Content is null ? new Dictionary<string, string>() : (await request.Content.ReadAsStringAsync(cancellationToken)).Split('&').Select(x => x.Split('=', 2)).ToDictionary(x => WebUtility.UrlDecode(x[0]), x => WebUtility.UrlDecode(x[1]));
        var key = request.Headers.TryGetValues("Idempotency-Key", out var keys) ? keys.Single() : null;
        var account = request.Headers.TryGetValues("Stripe-Account", out var accounts) ? accounts.Single() : null;
        Requests.Add(new ProviderCall(path, key, account, fields));
        object result;
        if (request.Method == HttpMethod.Get) result = path.StartsWith("checkout/sessions/") ? sessions[path[18..]] : Subscriptions[path[14..]];
        else if (path == "checkout/sessions") {
            Assert.NotNull(key);
            if (fields.TryGetValue("expires_at", out var expiry)) Assert.InRange(long.Parse(expiry) - DateTimeOffset.UtcNow.ToUnixTimeSeconds(), 1800, 86400);
            if (!intents.TryGetValue(key, out var intent)) { var id = "cs_" + Guid.NewGuid().ToString("N"); intent = (id, fields); intents[key] = intent; SetSessionStatus(id, "open"); }
            else Assert.Equal(intent.Fields, fields);
            result = sessions[intent.Id];
            if (fields["mode"] == "subscription" && LoseNextSubscriptionResponse) { LoseNextSubscriptionResponse = false; throw new HttpRequestException("Simulated lost response after provider accepted the request."); }
        }
        else if (path == "refunds") result = new { id = "re_fixture", status = "pending" };
        else if (path.StartsWith("subscriptions/")) result = Subscriptions[path[14..]];
        else throw new InvalidOperationException("Unexpected provider request: " + path);
        return new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(result) };
    }
}
