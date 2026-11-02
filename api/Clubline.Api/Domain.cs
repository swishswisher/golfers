using Microsoft.AspNetCore.Identity;

namespace Clubline;

public sealed class AppUser : IdentityUser
{
    public string DisplayName { get; set; } = "";
    public bool IsPlatformAdmin { get; set; }
}
public abstract class Entity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public abstract class ClubEntity : Entity { public Guid ClubId { get; set; } }
public sealed class Club : Entity
{
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public string Country { get; set; } = "";
    public string Currency { get; set; } = "USD";
    public string TimeZone { get; set; } = "UTC";
    public string BrandColor { get; set; } = "#235c45";
    public string[] Sports { get; set; } = [];
    public bool IsDemonstration { get; set; }
    public bool Suspended { get; set; }
    public string? StripeAccountId { get; set; }
    public bool ChargesEnabled { get; set; }
}
public sealed class Membership : ClubEntity
{
    public string UserId { get; set; } = "";
    public string Role { get; set; } = "Member";
    public bool Active { get; set; } = true;
}
public sealed class Member : ClubEntity
{
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string? UserId { get; set; }
    public string Sport { get; set; } = "";
    public string Status { get; set; } = "Active";
    public bool Junior { get; set; }
    public bool DirectoryVisible { get; set; }
    public string EmergencyContact { get; set; } = "";
    public DateTimeOffset? RenewalAt { get; set; }
}
public sealed class GuardianLink : ClubEntity
{
    public string GuardianUserId { get; set; } = "";
    public Guid JuniorMemberId { get; set; }
    public string VerifiedBy { get; set; } = "";
}
public sealed class Invitation : ClubEntity
{
    public string Email { get; set; } = "";
    public string Role { get; set; } = "Member";
    public string TokenHash { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}
public sealed class Team : ClubEntity { public string Name { get; set; } = ""; public string Sport { get; set; } = ""; }
public sealed class TeamAssignment : ClubEntity
{
    public Guid TeamId { get; set; }
    public Guid MemberId { get; set; }
    public bool Staff { get; set; }
}
public sealed class Activity : ClubEntity
{
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Kind { get; set; } = "Coaching";
    public string Sport { get; set; } = "";
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    public string Place { get; set; } = "";
    public int Capacity { get; set; } = 12;
    public long PriceMinor { get; set; }
    public Guid? TeamId { get; set; }
    public string Audience { get; set; } = "All";
    public string Status { get; set; } = "Draft";
    public string AuthorId { get; set; } = "";
    public DateTimeOffset? PublishedAt { get; set; }
    public uint Version { get; set; }
}
public sealed class Registration : ClubEntity
{
    public Guid AttemptId { get; set; } = Guid.NewGuid();
    public Guid ActivityId { get; set; }
    public Guid MemberId { get; set; }
    public string BookedBy { get; set; } = "";
    public string Status { get; set; } = "Confirmed";
    public string Attendance { get; set; } = "NotCheckedIn";
    public bool Consent { get; set; }
    public string TermsVersion { get; set; } = "2026-11";
    public DateTimeOffset? ReservationExpiresAt { get; set; }
    public long AmountMinor { get; set; }
}
public sealed class Resource : ClubEntity
{
    public string Name { get; set; } = "";
    public string Sport { get; set; } = "";
    public int SlotMinutes { get; set; } = 60;
}
public sealed class Booking : ClubEntity
{
    public Guid ResourceId { get; set; }
    public string UserId { get; set; } = "";
    public string Title { get; set; } = "";
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    public string Status { get; set; } = "Confirmed";
}
public sealed class Conversation : ClubEntity
{
    public string Title { get; set; } = "";
    public string Kind { get; set; } = "Group";
    public Guid? ActivityId { get; set; }
    public string CreatedBy { get; set; } = "";
}
public sealed class Participant : ClubEntity
{
    public Guid ConversationId { get; set; }
    public string UserId { get; set; } = "";
    public bool Active { get; set; } = true;
    public long ReadThrough { get; set; }
}
public sealed class Message : ClubEntity
{
    public Guid ConversationId { get; set; }
    public string SenderId { get; set; } = "";
    public Guid ClientMessageId { get; set; }
    public long Sequence { get; set; }
    public string Body { get; set; } = "";
    public DateTimeOffset? HiddenAt { get; set; }
}
public sealed class MessageReport : ClubEntity
{
    public Guid MessageId { get; set; }
    public string ReporterId { get; set; } = "";
    public string Reason { get; set; } = "";
    public string Status { get; set; } = "Open";
}
public sealed class Notification : ClubEntity
{
    public string UserId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public string Link { get; set; } = "";
    public string OperationKey { get; set; } = "";
    public DateTimeOffset? ReadAt { get; set; }
}
public sealed class Preference : ClubEntity
{
    public string UserId { get; set; } = "";
    public bool Email { get; set; } = true;
    public bool Push { get; set; }
    public bool Digest { get; set; }
    public string Language { get; set; } = "en";
    public string TimeZone { get; set; } = "UTC";
}
public sealed class PushSubscription : ClubEntity
{
    public string UserId { get; set; } = "";
    public string Endpoint { get; set; } = "";
    public string P256dh { get; set; } = "";
    public string Auth { get; set; } = "";
    public bool Active { get; set; } = true;
}
public sealed class StoredFile : ClubEntity
{
    public string UserId { get; set; } = "";
    public Guid? ConversationId { get; set; }
    public string Name { get; set; } = "";
    public string StorageKey { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long Length { get; set; }
}
public sealed class Payment : ClubEntity
{
    public Guid? RegistrationAttemptId { get; set; }
    public Guid? MemberId { get; set; }
    public string Description { get; set; } = "";
    public DateTimeOffset? RenewalUntil { get; set; }
    public Guid? RegistrationId { get; set; }
    public string UserId { get; set; } = "";
    public string Purpose { get; set; } = "Activity";
    public long AmountMinor { get; set; }
    public string Currency { get; set; } = "";
    public string Status { get; set; } = "Pending";
    public string OperationKey { get; set; } = "";
    public string? ProviderId { get; set; }
    public string? IntentId { get; set; }
    public string? Reference { get; set; }
    public string? CheckoutUrl { get; set; }
    public long RefundedMinor { get; set; }
}
public sealed class Refund : ClubEntity
{
    public Guid PaymentId { get; set; }
    public long AmountMinor { get; set; }
    public string Reason { get; set; } = "";
    public string Status { get; set; } = "Pending";
    public string OperationKey { get; set; } = "";
    public string? ProviderId { get; set; }
}
public sealed class ClubSubscription : ClubEntity
{
    public string? CheckoutKey { get; set; }
    public string? CheckoutUrl { get; set; }
    public string? CheckoutPlan { get; set; }
    public DateTimeOffset? CheckoutExpiresAt { get; set; }
    public long ProviderUpdatedAt { get; set; }
    public string Plan { get; set; } = "Trial";
    public string Status { get; set; } = "Trialing";
    public int MemberLimit { get; set; } = 500;
    public DateTimeOffset PeriodEnd { get; set; } = DateTimeOffset.UtcNow.AddDays(14);
    public string? CustomerId { get; set; }
    public string? ProviderId { get; set; }
    public bool CancelAtPeriodEnd { get; set; }
}
public sealed class Invoice : ClubEntity
{
    public string ProviderId { get; set; } = "";
    public long AmountMinor { get; set; }
    public string Currency { get; set; } = "USD";
    public string Status { get; set; } = "";
    public string? HostedUrl { get; set; }
}
public sealed class ClubContent : ClubEntity
{
    public string Kind { get; set; } = "Page";
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public bool Published { get; set; }
}
public sealed class PlatformContent : Entity
{
    public string Slug { get; set; } = "";
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public bool Published { get; set; }
}
public sealed class SupportTicket : Entity
{
    public string? Response { get; set; }
    public DateTimeOffset? RespondedAt { get; set; }
    public Guid? ClubId { get; set; }
    public string UserId { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Body { get; set; } = "";
    public string Status { get; set; } = "Open";
}
public sealed class Enquiry : Entity
{
    public Guid? ClubId { get; set; }
    public string Kind { get; set; } = "Demo";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Body { get; set; } = "";
    public string Status { get; set; } = "New";
}
public sealed class Audit : ClubEntity
{
    public string ActorId { get; set; } = "";
    public string Action { get; set; } = "";
    public string Resource { get; set; } = "";
}
public sealed class UserSession : Entity
{
    public string UserId { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}
public sealed class Outbox : Entity
{
    public Guid? ClubId { get; set; }
    public string Kind { get; set; } = "Email";
    public string OperationKey { get; set; } = "";
    public string ProtectedPayload { get; set; } = "";
    public string Status { get; set; } = "Queued";
    public int Attempts { get; set; }
    public DateTimeOffset AvailableAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LeaseUntil { get; set; }
    public string? LastError { get; set; }
}
public sealed class ProviderEvent : Entity
{
    public string ProviderId { get; set; } = "";
    public string Kind { get; set; } = "";
}
public sealed class DevelopmentMail : Entity
{
    public string Recipient { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Body { get; set; } = "";
}
public sealed class AutomationRule : ClubEntity
{
    public string Kind { get; set; } = "Welcome";
    public bool Enabled { get; set; }
    public int OffsetHours { get; set; } = 24;
    public string Template { get; set; } = "Welcome to {club}. Find your next activity and meet your group.";
    public DateTimeOffset? LastRunAt { get; set; }
}

public sealed class PlatformAudit : Entity { public string ActorId { get; set; } = ""; public string Action { get; set; } = ""; public string? Resource { get; set; } }
