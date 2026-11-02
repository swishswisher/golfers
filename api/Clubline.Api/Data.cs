using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Clubline;

public sealed class TenantContext { public Guid ClubId { get; set; } public string Role { get; set; } = ""; }
public sealed class AppDb(DbContextOptions<AppDb> options, TenantContext tenant) : IdentityDbContext<AppUser>(options)
{
    public Guid CurrentClubId => tenant.ClubId;
    public DbSet<PlatformAudit> PlatformAudits => Set<PlatformAudit>();
    public DbSet<Club> Clubs => Set<Club>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<Member> Members => Set<Member>();
    public DbSet<GuardianLink> Guardians => Set<GuardianLink>();
    public DbSet<Invitation> Invitations => Set<Invitation>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<TeamAssignment> TeamAssignments => Set<TeamAssignment>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<Registration> Registrations => Set<Registration>();
    public DbSet<Resource> Resources => Set<Resource>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<Participant> Participants => Set<Participant>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<MessageReport> Reports => Set<MessageReport>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Preference> Preferences => Set<Preference>();
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();
    public DbSet<StoredFile> Files => Set<StoredFile>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Refund> Refunds => Set<Refund>();
    public DbSet<ClubSubscription> Subscriptions => Set<ClubSubscription>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<ClubContent> ClubContents => Set<ClubContent>();
    public DbSet<PlatformContent> PlatformContents => Set<PlatformContent>();
    public DbSet<SupportTicket> Tickets => Set<SupportTicket>();
    public DbSet<Enquiry> Enquiries => Set<Enquiry>();
    public DbSet<Audit> Audits => Set<Audit>();
    public DbSet<UserSession> Sessions => Set<UserSession>();
    public DbSet<Outbox> Outbox => Set<Outbox>();
    public DbSet<ProviderEvent> ProviderEvents => Set<ProviderEvent>();
    public DbSet<DevelopmentMail> DevelopmentMail => Set<DevelopmentMail>();
    public DbSet<AutomationRule> AutomationRules => Set<AutomationRule>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.Entity<Club>().HasIndex(x => x.Slug).IsUnique();
        b.Entity<Club>().Property(x => x.Sports).HasColumnType("text[]");
        b.Entity<Club>().Property(x => x.Name).HasMaxLength(160);
        ConfigureClub<Membership>(b); ConfigureClub<Member>(b); ConfigureClub<GuardianLink>(b);
        ConfigureClub<Invitation>(b); ConfigureClub<Team>(b); ConfigureClub<TeamAssignment>(b);
        ConfigureClub<Activity>(b); ConfigureClub<Registration>(b); ConfigureClub<Resource>(b);
        ConfigureClub<Booking>(b); ConfigureClub<Conversation>(b); ConfigureClub<Participant>(b);
        ConfigureClub<Message>(b); ConfigureClub<MessageReport>(b); ConfigureClub<Notification>(b);
        ConfigureClub<Preference>(b); ConfigureClub<PushSubscription>(b); ConfigureClub<StoredFile>(b);
        ConfigureClub<Payment>(b); ConfigureClub<Refund>(b); ConfigureClub<ClubSubscription>(b);
        ConfigureClub<Invoice>(b); ConfigureClub<ClubContent>(b); ConfigureClub<Audit>(b);
        ConfigureClub<AutomationRule>(b);
        b.Entity<AutomationRule>().HasIndex(x => new { x.ClubId, x.Kind }).IsUnique();
        b.Entity<Membership>().HasIndex(x => new { x.ClubId, x.UserId }).IsUnique();
        b.Entity<Membership>().HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Member>().HasIndex(x => new { x.ClubId, x.UserId }).IsUnique().HasFilter("\"UserId\" IS NOT NULL");
        b.Entity<Member>().HasIndex(x => new { x.ClubId, x.Email });
        b.Entity<GuardianLink>().HasIndex(x => new { x.ClubId, x.GuardianUserId, x.JuniorMemberId }).IsUnique();
        b.Entity<GuardianLink>().HasOne<Member>().WithMany().HasForeignKey(x => new { x.ClubId, Id = x.JuniorMemberId }).HasPrincipalKey(x => new { x.ClubId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Invitation>().HasIndex(x => x.TokenHash).IsUnique();
        b.Entity<TeamAssignment>().HasIndex(x => new { x.ClubId, x.TeamId, x.MemberId }).IsUnique();
        b.Entity<TeamAssignment>().HasOne<Team>().WithMany().HasForeignKey(x => new { x.ClubId, Id = x.TeamId }).HasPrincipalKey(x => new { x.ClubId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<TeamAssignment>().HasOne<Member>().WithMany().HasForeignKey(x => new { x.ClubId, Id = x.MemberId }).HasPrincipalKey(x => new { x.ClubId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Activity>().Property(x => x.Version).IsRowVersion();
        b.Entity<Activity>().HasIndex(x => new { x.ClubId, x.Status, x.StartsAt });
        b.Entity<Activity>().HasOne<Team>().WithMany().HasForeignKey(x => new { x.ClubId, Id = x.TeamId }).HasPrincipalKey(x => new { x.ClubId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Activity>().ToTable(t => t.HasCheckConstraint("CK_Activity_CapacityPrice", "\"Capacity\" > 0 AND \"PriceMinor\" >= 0"));
        b.Entity<Registration>().Property(x => x.AttemptId).HasDefaultValueSql("gen_random_uuid()");
        b.Entity<Registration>().HasIndex(x => new { x.ClubId, x.ActivityId, x.MemberId }).IsUnique();
        b.Entity<Registration>().HasIndex(x => new { x.ClubId, x.ActivityId, x.Status });
        b.Entity<Registration>().HasOne<Activity>().WithMany().HasForeignKey(x => new { x.ClubId, Id = x.ActivityId }).HasPrincipalKey(x => new { x.ClubId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Registration>().HasOne<Member>().WithMany().HasForeignKey(x => new { x.ClubId, Id = x.MemberId }).HasPrincipalKey(x => new { x.ClubId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Booking>().HasOne<Resource>().WithMany().HasForeignKey(x => new { x.ClubId, Id = x.ResourceId }).HasPrincipalKey(x => new { x.ClubId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Booking>().HasIndex(x => new { x.ClubId, x.ResourceId, x.StartsAt, x.EndsAt });
        b.Entity<Participant>().HasIndex(x => new { x.ClubId, x.ConversationId, x.UserId }).IsUnique();
        b.Entity<Participant>().HasOne<Conversation>().WithMany().HasForeignKey(x => new { x.ClubId, Id = x.ConversationId }).HasPrincipalKey(x => new { x.ClubId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Message>().Property(x => x.Sequence).UseIdentityAlwaysColumn();
        b.Entity<Message>().HasIndex(x => new { x.ClubId, x.ConversationId, x.Sequence }).IsUnique();
        b.Entity<Message>().HasIndex(x => new { x.ClubId, x.SenderId, x.ClientMessageId }).IsUnique();
        b.Entity<Message>().Property(x => x.Body).HasMaxLength(4000);
        b.Entity<Message>().HasOne<Conversation>().WithMany().HasForeignKey(x => new { x.ClubId, Id = x.ConversationId }).HasPrincipalKey(x => new { x.ClubId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MessageReport>().HasOne<Message>().WithMany().HasForeignKey(x => new { x.ClubId, Id = x.MessageId }).HasPrincipalKey(x => new { x.ClubId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Notification>().HasIndex(x => new { x.ClubId, x.UserId, x.OperationKey }).IsUnique();
        b.Entity<Notification>().HasIndex(x => new { x.ClubId, x.UserId, x.ReadAt });
        b.Entity<Preference>().HasIndex(x => new { x.ClubId, x.UserId }).IsUnique();
        b.Entity<PushSubscription>().HasIndex(x => new { x.ClubId, x.UserId, x.Endpoint }).IsUnique();
        b.Entity<StoredFile>().HasOne<Conversation>().WithMany().HasForeignKey(x => new { x.ClubId, Id = x.ConversationId }).HasPrincipalKey(x => new { x.ClubId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Payment>().HasOne<Registration>().WithMany().HasForeignKey(x => new { x.ClubId, Id = x.RegistrationId }).HasPrincipalKey(x => new { x.ClubId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Payment>().HasOne<Member>().WithMany().HasForeignKey(x => new { x.ClubId, Id = x.MemberId }).HasPrincipalKey(x => new { x.ClubId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<StoredFile>().HasIndex(x => x.StorageKey).IsUnique();
        b.Entity<Payment>().HasIndex(x => new { x.ClubId, x.OperationKey }).IsUnique();
        b.Entity<Payment>().HasIndex(x => x.ProviderId).IsUnique().HasFilter("\"ProviderId\" IS NOT NULL");
        b.Entity<Payment>().ToTable(t => t.HasCheckConstraint("CK_Payment_Money", "\"AmountMinor\" >= 0 AND \"RefundedMinor\" >= 0 AND \"RefundedMinor\" <= \"AmountMinor\""));
        b.Entity<Refund>().HasIndex(x => new { x.ClubId, x.OperationKey }).IsUnique();
        b.Entity<Refund>().HasOne<Payment>().WithMany().HasForeignKey(x => new { x.ClubId, Id = x.PaymentId }).HasPrincipalKey(x => new { x.ClubId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<ClubSubscription>().HasIndex(x => x.ClubId).IsUnique();
        b.Entity<Invoice>().HasIndex(x => x.ProviderId).IsUnique();
        b.Entity<PlatformContent>().HasIndex(x => x.Slug).IsUnique();
        b.Entity<Outbox>().HasIndex(x => x.OperationKey).IsUnique();
        b.Entity<Outbox>().HasIndex(x => new { x.Status, x.AvailableAt });
        b.Entity<ProviderEvent>().HasIndex(x => x.ProviderId).IsUnique();
        b.Entity<UserSession>().HasIndex(x => new { x.UserId, x.ExpiresAt });
        b.Entity<Audit>().HasIndex(x => new { x.ClubId, x.CreatedAt });
    }
    private void ConfigureClub<T>(ModelBuilder b) where T : ClubEntity
    {
        b.Entity<T>().HasBaseType((Type?)null);
        b.Entity<T>().HasKey(x => x.Id);
        b.Entity<T>().HasAlternateKey(x => new { x.ClubId, x.Id });
        b.Entity<T>().HasQueryFilter(x => x.ClubId == CurrentClubId);
        b.Entity<T>().HasOne<Club>().WithMany().HasForeignKey(x => x.ClubId).OnDelete(DeleteBehavior.Restrict);
    }
}
