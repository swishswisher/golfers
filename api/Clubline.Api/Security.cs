using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;

namespace Clubline;

public sealed class DomainError(int status, string message) : Exception(message) { public int Status { get; } = status; }
public static class Rules
{
    public static readonly string[] Roles = ["Owner", "Manager", "Coach", "Treasurer", "Caterer", "ProShop", "Member", "Guardian"];
    public static readonly string[] ActivityKinds = ["Coaching", "Training", "Social", "Announcement", "Promotion"];
    public static string UserId(this ClaimsPrincipal user) => user.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw new DomainError(401, "Sign in to continue.");
    public static void Check(bool condition, string message, int status = 400) { if (!condition) throw new DomainError(status, message); }
    public static string Required(string? value, string field, int max = 160)
    {
        var result = value?.Trim() ?? "";
        Check(result.Length > 0 && result.Length <= max, $"{field} must contain between 1 and {max} characters.");
        return result;
    }
    public static string Email(string? input)
    {
        var email = Required(input, "Email", 254).ToLowerInvariant();
        Check(!email.Any(char.IsWhiteSpace) && new EmailAddressAttribute().IsValid(email), "Enter a valid email address."); return email;
    }
    public static string Password(string? value) { Check(value is { Length: > 0 and <= 128 }, "Password must contain between 1 and 128 characters."); return value!; }
    public static string Token() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    public static string Hash(string text) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    public static int PageSize(int? size) => Math.Clamp(size ?? 50, 1, 100);
}
public sealed class Access(AppDb db, TenantContext tenant, IHttpContextAccessor http)
{
    public string UserId => http.HttpContext!.User.UserId();
    public Guid ClubId => tenant.ClubId;
    public string Role => tenant.Role;
    public bool Manager => tenant.Role is "Owner" or "Manager";
    public void Roles(params string[] roles) => Rules.Check(roles.Contains(tenant.Role), "Your club role does not permit this action.", 403);
    public void Manage() => Roles("Owner", "Manager");
    public void Finance() => Roles("Owner", "Manager", "Treasurer");
    public async Task SetClub(Guid clubId, string? userId = null)
    {
        var membership = await db.Memberships.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.ClubId == clubId && x.UserId == (userId ?? UserId) && x.Active);
        Rules.Check(membership is not null, "Club access is not available for this account.", 403);
        tenant.ClubId = clubId; tenant.Role = membership!.Role;
        Rules.Check(!await db.Clubs.AnyAsync(x => x.Id == clubId && x.Suspended), "This club is suspended. Contact support.", 403);
    }
    public async Task CanWrite()
    {
        var sub = await db.Subscriptions.AsNoTracking().SingleAsync();
        Rules.Check(sub.Status is "Active" or "Trialing" && sub.PeriodEnd > DateTimeOffset.UtcNow, "The club subscription needs attention. Reading and exporting records remains available.", 402);
    }
    public async Task<bool> Assigned(Guid? teamId)
    {
        if (Manager) return true;
        if (teamId is null) return false;
        return await (from a in db.TeamAssignments join m in db.Members on a.MemberId equals m.Id where a.TeamId == teamId && a.Staff && m.UserId == UserId select a).AnyAsync();
    }
    public async Task ManageActivity(Activity activity)
    {
        if (Manager) return;
        if (tenant.Role == "ProShop" && activity.AuthorId == UserId && activity.Kind is "Coaching" or "Promotion" or "Announcement") return;
        if (tenant.Role == "Caterer" && activity.AuthorId == UserId && activity.Kind is "Social" or "Promotion" or "Announcement") return;
        Rules.Check(tenant.Role == "Coach" && activity.Kind is "Coaching" or "Training" && await Assigned(activity.TeamId), "You cannot manage this activity.", 403);
    }
    public async Task<bool> CanActFor(Guid memberId)
    {
        var m = await db.Members.SingleOrDefaultAsync(x => x.Id == memberId && x.Status == "Active");
        return m is not null && (m.UserId == UserId || await db.Guardians.AnyAsync(g => g.JuniorMemberId == memberId && g.GuardianUserId == UserId));
    }
    public async Task Conversation(Guid conversationId, string? userId = null)
    {
        var uid = userId ?? UserId;
        Rules.Check(await db.Participants.AnyAsync(p => p.ConversationId == conversationId && p.UserId == uid && p.Active), "You are not an active participant in this conversation.", 403);
    }
    public async Task Platform()
    {
        Rules.Check(await db.Users.AnyAsync(u => u.Id == UserId && u.IsPlatformAdmin), "Platform administrator permission is required.", 403);
    }
    public void PlatformAudit(string action, string? resource = null) => db.PlatformAudits.Add(new PlatformAudit { ActorId = UserId, Action = action, Resource = resource });
    public void Audit(string action, Guid? resource = null) => db.Audits.Add(new Audit { ClubId = ClubId, ActorId = UserId, Action = action, Resource = resource?.ToString() ?? "" });
}
public sealed class ClubFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        var clubId = Guid.Parse(ctx.HttpContext.Request.RouteValues["clubId"]!.ToString()!);
        await ctx.HttpContext.RequestServices.GetRequiredService<Access>().SetClub(clubId);
        return await next(ctx);
    }
}
public record RegisterAccount(string Name, string Email, string Password);
public record LoginAccount(string Email, string Password);
public record EmailRequest(string Email);
public record ResetPassword(string Email, string Token, string Password);
public record VerifyEmail(string UserId, string Token);
public record CreateClub(string Name, string Country, string Currency, string TimeZone, string[] Sports, string? BrandColor);
public record InviteMember(string Email, string Role);
public record AcceptInvite(string Token);
public record MemberInput(string Name, string Email, string Sport, bool Junior, bool DirectoryVisible, string? EmergencyContact, string? Status);
public record MemberBatch(MemberInput[] Rows, bool Commit);
public record GuardianInput(string GuardianUserId, Guid JuniorMemberId);
public record TeamInput(string Name, string Sport);
public record TeamAssignmentInput(Guid MemberId, bool Staff);
public record ActivityInput(string Title, string Description, string Kind, string Sport, DateTimeOffset StartsAt, DateTimeOffset EndsAt, string Place, int Capacity, long PriceMinor, Guid? TeamId, string Audience);
public record RegisterActivity(Guid MemberId, bool Consent, bool JoinWaitlist);
public record AttendanceInput(string Status);
public record ConversationInput(string Title, string Kind, string[] UserIds);
public record SendMessage(Guid ClientMessageId, string Body);
public record ReadMessage(long Through);
public record ReportInput(string Reason);
public record ModerateInput(bool Hide, string Reason);
public record PreferenceInput(bool Email, bool Push, bool Digest, string Language, string TimeZone);
public record PushInput(string Endpoint, string P256dh, string Auth);
public record ResourceInput(string Name, string Sport, int SlotMinutes);
public record BookingInput(Guid ResourceId, string Title, DateTimeOffset StartsAt, DateTimeOffset EndsAt);
public record ContentInput(string Kind, string Title, string Body, bool Published);
public record EnquiryInput(string Name, string Email, string Body, string Kind, bool Consent, Guid? ClubId);
public record TicketInput(string Subject, string Body, Guid? ClubId);
public record OfflinePayment(Guid RegistrationId, string Reference, string OperationKey);
public record RefundInput(long AmountMinor, string Reason, string OperationKey);
public record SubscriptionInput(string Plan, string OperationKey);
public record AdminClubInput(bool Suspended, string Plan, string Status, int MemberLimit, DateTimeOffset PeriodEnd);
