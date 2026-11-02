using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;

namespace Clubline;

public static class AuthEndpoints
{
    public static void MapAuth(this WebApplication app)
    {
        var auth = app.MapGroup("/api/auth").WithTags("Identity");
        auth.MapGet("/csrf", (HttpContext http, IAntiforgery antiforgery) =>
        {
            http.Response.Headers.CacheControl = "no-store";
            return Results.Ok(new { token = antiforgery.GetAndStoreTokens(http).RequestToken });
        });
        auth.MapPost("/register", async (RegisterAccount input, UserManager<AppUser> users, AppDb db, Jobs jobs) =>
        {
            await using var tx = await db.Database.BeginTransactionAsync();
            var user = new AppUser { UserName = Rules.Email(input.Email), Email = Rules.Email(input.Email), DisplayName = Rules.Required(input.Name, "Name") };
            var result = await users.CreateAsync(user, Rules.Password(input.Password));
            Rules.Check(result.Succeeded, string.Join(" ", result.Errors.Select(x => x.Description)));
            var token = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(await users.GenerateEmailConfirmationTokenAsync(user)));
            jobs.Email(user.Email!, "Confirm your Clubline email", $"Confirm your account: {jobs.PublicUrl}/verify?userId={user.Id}&token={Uri.EscapeDataString(token)}", "verify:" + user.Id);
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Results.Ok(new { message = "Account created. Confirm your email before signing in." });
        }).RequireRateLimiting("auth");
        auth.MapPost("/resend-verification", async (EmailRequest input, UserManager<AppUser> users, AppDb db, Jobs jobs) => { var user = await users.FindByEmailAsync(Rules.Email(input.Email)); if (user is not null && !user.EmailConfirmed) { var token = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(await users.GenerateEmailConfirmationTokenAsync(user))); jobs.Email(user.Email!, "Confirm your Clubline email", $"Confirm your account: {jobs.PublicUrl}/verify?userId={user.Id}&token={Uri.EscapeDataString(token)}", "verify-again:" + Guid.NewGuid()); await db.SaveChangesAsync(); } return Results.Ok(new { message = "If the account needs confirmation, a new confirmation link has been queued." }); }).RequireRateLimiting("auth");
        auth.MapPost("/verify", async (VerifyEmail input, UserManager<AppUser> users) =>
        {
            var user = await users.FindByIdAsync(Rules.Required(input.UserId, "Account reference", 128));
            Rules.Check(user is not null, "This confirmation link is invalid or expired.");
            string decoded;
            try { decoded = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(Rules.Required(input.Token, "Account token", 8192))); }
            catch (FormatException) { throw new DomainError(400, "This confirmation link is invalid."); }
            var result = await users.ConfirmEmailAsync(user!, decoded);
            Rules.Check(result.Succeeded, "This confirmation link is invalid or expired.");
            return Results.Ok(new { message = "Email confirmed. You can sign in." });
        }).RequireRateLimiting("auth");
        auth.MapPost("/login", async (LoginAccount input, UserManager<AppUser> users, SignInManager<AppUser> signIn, AppDb db) =>
        {
            var user = await users.FindByEmailAsync(Rules.Email(input.Email));
            if (user is null) throw new DomainError(401, "Email or password is incorrect.");
            var check = await signIn.CheckPasswordSignInAsync(user, Rules.Password(input.Password), lockoutOnFailure: true);
            Rules.Check(check.Succeeded, user.EmailConfirmed ? "Email or password is incorrect, or the account is locked." : "Confirm your email before signing in.", 401);
            var session = new UserSession { UserId = user.Id, ExpiresAt = DateTimeOffset.UtcNow.AddDays(7) };
            db.Sessions.Add(session); await db.SaveChangesAsync();
            await signIn.SignInWithClaimsAsync(user, isPersistent: true, [new Claim("sid", session.Id.ToString())]);
            return Results.Ok(new { user.Id, user.DisplayName, user.Email, user.IsPlatformAdmin });
        }).RequireRateLimiting("auth");
        auth.MapPost("/logout", async (HttpContext http, SignInManager<AppUser> signIn, AppDb db, ConnectionRegistry connections) =>
        {
            if (Guid.TryParse(http.User.FindFirstValue("sid"), out var id)) {
                await db.Sessions.Where(x => x.Id == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, DateTimeOffset.UtcNow)); connections.Revoke(id); }
            await signIn.SignOutAsync(); return Results.NoContent();
        }).RequireAuthorization();
        auth.MapGet("/me", async (HttpContext http, AppDb db) =>
        {
            var userId = http.User.UserId();
            var user = await db.Users.AsNoTracking().SingleAsync(x => x.Id == userId);
            var clubs = await (from m in db.Memberships.IgnoreQueryFilters() join c in db.Clubs on m.ClubId equals c.Id where m.UserId == userId && m.Active select new { c.Id, c.Name, c.Slug, c.Country, c.Currency, c.TimeZone, c.Sports, c.BrandColor, c.IsDemonstration, c.Suspended, m.Role }).ToListAsync();
            return Results.Ok(new { user.Id, user.DisplayName, user.Email, user.IsPlatformAdmin, clubs });
        }).RequireAuthorization();
        auth.MapPost("/forgot-password", async (EmailRequest input, UserManager<AppUser> users, AppDb db, Jobs jobs) =>
        {
            var user = await users.FindByEmailAsync(Rules.Email(input.Email));
            if (user is not null && user.EmailConfirmed)
            {
                var token = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(await users.GeneratePasswordResetTokenAsync(user)));
                jobs.Email(user.Email!, "Reset your Clubline password", $"Reset your password: {jobs.PublicUrl}/reset-password?email={Uri.EscapeDataString(user.Email!)}&token={token}", "reset:" + Guid.NewGuid());
                await db.SaveChangesAsync();
            }
            return Results.Ok(new { message = "If the account is eligible, password reset instructions have been queued." });
        }).RequireRateLimiting("auth");
        auth.MapPost("/reset-password", async (ResetPassword input, UserManager<AppUser> users, AppDb db, ConnectionRegistry connections) =>
        {
            var user = await users.FindByEmailAsync(Rules.Email(input.Email));
            Rules.Check(user is not null, "The reset link is invalid or expired.");
            string token;
            try { token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(Rules.Required(input.Token, "Account token", 8192))); }
            catch (FormatException) { throw new DomainError(400, "The reset link is invalid."); }
            var result = await users.ResetPasswordAsync(user!, token, Rules.Password(input.Password));
            Rules.Check(result.Succeeded, "The reset link is invalid, expired, or the new password does not meet the requirements.");
            await db.Sessions.Where(x => x.UserId == user!.Id && x.RevokedAt == null).ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, DateTimeOffset.UtcNow));
            connections.RevokeUser(user!.Id);
            return Results.Ok(new { message = "Password changed. Sign in again on each device." });
        }).RequireRateLimiting("auth");
        if (app.Environment.IsDevelopment() && app.Configuration.GetValue<bool>("App:DevelopmentInbox"))
            app.MapGet("/api/development/inbox", async (AppDb db) => await db.DevelopmentMail.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(30).ToListAsync()).WithTags("Development only");
    }
}
