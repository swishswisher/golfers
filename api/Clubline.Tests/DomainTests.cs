using Clubline;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Xunit;
public class DomainTests
{
    [Theory][InlineData("")][InlineData("x")][InlineData("x@")][InlineData("a b@example.com")]
    public void InvalidEmailsAreRejected(string value) => Assert.Throws<DomainError>(() => Rules.Email(value));
    [Fact] public void EmailIsCanonical() => Assert.Equal("member@example.com", Rules.Email(" Member@Example.com "));
    [Fact] public void RequiredTextLimitsAreEnforced() => Assert.Throws<DomainError>(() => Rules.Required(new string('x', 101), "Text", 100));
    [Fact] public void RandomInvitationTokensAreDifferent() => Assert.NotEqual(Rules.Token(), Rules.Token());
    [Fact] public void SignatureChecksExactRawBodyAndTime()
    {
        var now = DateTimeOffset.UtcNow; var body = "{\"id\":\"evt_test\"}"; var secret = "test-only-secret"; var t = now.ToUnixTimeSeconds();
        var hash = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(t + "." + body))).ToLowerInvariant();
        StripeGateway.VerifySignature(body, $"t={t},v1=00,v1={hash}", secret, now);
        Assert.Throws<DomainError>(() => StripeGateway.VerifySignature(body + " ", $"t={t},v1={hash}", secret, now));
        Assert.Throws<DomainError>(() => StripeGateway.VerifySignature(body, $"t={t},v1={hash}", secret, now.AddMinutes(6)));
    }
    [Fact] public void EveryClubEntityHasATenantFilterAndCompositeIdentity()
    {
        using var db = new AppDb(new DbContextOptionsBuilder<AppDb>().UseNpgsql("Host=localhost;Database=not-used").Options, new TenantContext());
        var entities = db.Model.GetEntityTypes().Where(x => typeof(ClubEntity).IsAssignableFrom(x.ClrType)).ToList();
        Assert.True(entities.Count > 20);
        foreach (var e in entities) { Assert.NotEmpty(e.GetDeclaredQueryFilters()); Assert.Contains(e.GetKeys(), k => k.Properties.Select(p => p.Name).SequenceEqual(new[] {"ClubId", "Id"})); }
    }
    [Fact] public void RevokedSessionIsRemovedFromRealtimeRecipients()
    {
        var registry = new ConnectionRegistry(); var sid = Guid.NewGuid(); var aborted = false;
        registry.Add("connection", "u", sid, () => aborted = true); Assert.Single(registry.Active(new[] {sid})); registry.Revoke(sid); Assert.True(aborted); Assert.Empty(registry.Active(new[] {sid}));
    }
}
public class SessionRefreshTests
{
    [Fact] public async Task IdentityPrincipalRefreshRetainsOnlyTheOriginalRevocableSession()
    {
        var sid=Guid.NewGuid().ToString();
        var context=new Microsoft.AspNetCore.Identity.SecurityStampRefreshingPrincipalContext {
            CurrentPrincipal=new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity(new[]{new System.Security.Claims.Claim("sid",sid)})),
            NewPrincipal=new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity(new[]{new System.Security.Claims.Claim("sid","different-stored-claim")}))
        };
        await SessionClaims.RetainServerSession(context);
        Assert.Equal(sid,Assert.Single(context.NewPrincipal.FindAll("sid")).Value);
    }
}
