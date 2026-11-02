using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
namespace Clubline;
public static class SessionClaims
{
    // Identity rebuilds its principal during security-stamp refresh. Keep the
    // separately revocable server-session identity across that rebuild.
    public static Task RetainServerSession(SecurityStampRefreshingPrincipalContext context)
    {
        if (context.CurrentPrincipal?.FindFirst("sid") is { } sid && context.NewPrincipal?.Identity is ClaimsIdentity identity)
        {
            foreach (var existing in identity.FindAll("sid").ToList()) identity.RemoveClaim(existing);
            identity.AddClaim(new Claim("sid", sid.Value));
        }
        return Task.CompletedTask;
    }
}
