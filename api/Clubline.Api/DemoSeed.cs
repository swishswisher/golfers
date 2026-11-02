using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Clubline;

public static class DemoSeed
{
    public static async Task Create(IServiceProvider services)
    {
        var db = services.GetRequiredService<AppDb>(); var tenant = services.GetRequiredService<TenantContext>(); var users = services.GetRequiredService<UserManager<AppUser>>();
        if (await db.Clubs.AnyAsync(c => c.Slug == "demo-harbour")) return;
        var accounts = new Dictionary<string, AppUser>();
        foreach (var (key, name) in new[] { ("manager", "Amina Hassan"), ("coach", "Sam Okello"), ("treasurer", "Daniel Njoroge"), ("caterer", "Priya Shah"), ("member", "Alex Morgan"), ("member2", "Lina Mensah"), ("guardian", "Jo Kamau"), ("outside", "Riverside Owner"), ("platform", "Platform Administrator") })
        {
            var email = key + "@clubline.test"; var u = await users.FindByEmailAsync(email);
            if (u is null) { u = new AppUser { UserName = email, Email = email, EmailConfirmed = true, DisplayName = name, IsPlatformAdmin = key == "platform" }; var result = await users.CreateAsync(u, "ClublineDemo!2026"); if (!result.Succeeded) throw new InvalidOperationException("Development account seed failed."); }
            accounts[key] = u;
        }
        var club = new Club { Name = "Harbour Sports Club", Slug = "demo-harbour", Country = "KE", Currency = "KES", TimeZone = "Africa/Nairobi", Sports = ["Tennis", "Football", "Swimming"], IsDemonstration = true };
        var outside = new Club { Name = "Riverside Running Club", Slug = "demo-riverside", Country = "ZA", Currency = "ZAR", TimeZone = "Africa/Johannesburg", Sports = ["Running"], IsDemonstration = true };
        db.Clubs.AddRange(club, outside); tenant.ClubId = club.Id;
        db.Subscriptions.AddRange(new ClubSubscription { ClubId = club.Id }, new ClubSubscription { ClubId = outside.Id });
        var members = new Dictionary<string, Member>();
        foreach (var (key, role) in new[] { ("manager", "Owner"), ("coach", "Coach"), ("treasurer", "Treasurer"), ("caterer", "Caterer"), ("member", "Member"), ("member2", "Member"), ("guardian", "Guardian") })
        {
            var u = accounts[key]; db.Memberships.Add(new Membership { ClubId = club.Id, UserId = u.Id, Role = role });
            var m = new Member { ClubId = club.Id, UserId = u.Id, Name = u.DisplayName, Email = u.Email!, Sport = key == "coach" ? "Football" : "Tennis", DirectoryVisible = true }; members[key] = m; db.Members.Add(m);
            db.Preferences.Add(new Preference { ClubId = club.Id, UserId = u.Id, Email = false, TimeZone = club.TimeZone });
        }
        db.Memberships.Add(new Membership { ClubId = outside.Id, UserId = accounts["outside"].Id, Role = "Owner" });
        db.Members.Add(new Member { ClubId = outside.Id, UserId = accounts["outside"].Id, Name = "Riverside Owner", Email = "outside@clubline.test", Sport = "Running" });
        var noah = new Member { ClubId = club.Id, Name = "Noah Kamau", Email = "guardian@clubline.test", Sport = "Football", Junior = true, EmergencyContact = "Jo Kamau · demonstration contact" };
        var zoe = new Member { ClubId = club.Id, Name = "Zoe Kamau", Email = "guardian@clubline.test", Sport = "Swimming", Junior = true, EmergencyContact = "Jo Kamau · demonstration contact" };
        db.Members.AddRange(noah, zoe);
        db.Guardians.AddRange(new GuardianLink { ClubId = club.Id, GuardianUserId = accounts["guardian"].Id, JuniorMemberId = noah.Id, VerifiedBy = accounts["manager"].Id }, new GuardianLink { ClubId = club.Id, GuardianUserId = accounts["guardian"].Id, JuniorMemberId = zoe.Id, VerifiedBy = accounts["manager"].Id });
        var team = new Team { ClubId = club.Id, Name = "U16 football", Sport = "Football" }; db.Teams.Add(team);
        db.TeamAssignments.AddRange(new TeamAssignment { ClubId = club.Id, TeamId = team.Id, MemberId = members["coach"].Id, Staff = true }, new TeamAssignment { ClubId = club.Id, TeamId = team.Id, MemberId = noah.Id });
        var start = DateTimeOffset.UtcNow.AddDays(5);
        var tennis = new Activity { ClubId = club.Id, Title = "Saturday tennis clinic", Description = "A relaxed coach-led session to build confidence in your serve and rally. All abilities welcome.", Sport = "Tennis", Kind = "Coaching", StartsAt = start, EndsAt = start.AddHours(1), Place = "Court 2", Capacity = 12, Status = "Published", PublishedAt = DateTimeOffset.UtcNow, AuthorId = accounts["manager"].Id };
        var football = new Activity { ClubId = club.Id, Title = "U16 football training", Description = "Weekly skills and team practice. Guardians can register linked junior players.", Sport = "Football", Kind = "Training", StartsAt = start.AddDays(1), EndsAt = start.AddDays(1).AddHours(1), Place = "Main pitch", Capacity = 18, TeamId = team.Id, Status = "Published", PublishedAt = DateTimeOffset.UtcNow, AuthorId = accounts["coach"].Id };
        var swim = new Activity { ClubId = club.Id, Title = "Junior swim foundations", Description = "Small-group coaching. Bring a cap and arrive ten minutes early.", Sport = "Swimming", Kind = "Coaching", StartsAt = start.AddDays(2), EndsAt = start.AddDays(2).AddHours(1), Place = "Pool, lane 3", Capacity = 8, PriceMinor = 80000, Status = "Published", AuthorId = accounts["manager"].Id, PublishedAt = DateTimeOffset.UtcNow };
        db.Activities.AddRange(tennis, football, swim);
        db.Registrations.AddRange(new Registration { ClubId = club.Id, ActivityId = tennis.Id, MemberId = members["member2"].Id, BookedBy = accounts["member2"].Id, Consent = true }, new Registration { ClubId = club.Id, ActivityId = football.Id, MemberId = noah.Id, BookedBy = accounts["guardian"].Id, Consent = true });
        db.Resources.AddRange(new Resource { ClubId = club.Id, Name = "Court 1", Sport = "Tennis" }, new Resource { ClubId = club.Id, Name = "Court 2", Sport = "Tennis" }, new Resource { ClubId = club.Id, Name = "Main pitch", Sport = "Football" });
        var conversation = new Conversation { ClubId = club.Id, Title = "Saturday tennis clinic", Kind = "Group", ActivityId = tennis.Id, CreatedBy = accounts["coach"].Id }; db.Conversations.Add(conversation);
        foreach (var key in new[] { "manager", "coach", "member", "member2" }) db.Participants.Add(new Participant { ClubId = club.Id, ConversationId = conversation.Id, UserId = accounts[key].Id });
        db.Messages.AddRange(new Message { ClubId = club.Id, ConversationId = conversation.Id, SenderId = accounts["coach"].Id, ClientMessageId = Guid.NewGuid(), Body = "Welcome to the clinic group. Bring your racquet if you have one — we can provide equipment too." }, new Message { ClubId = club.Id, ConversationId = conversation.Id, SenderId = accounts["member2"].Id, ClientMessageId = Guid.NewGuid(), Body = "Thanks, looking forward to the session!" });
        db.ClubContents.AddRange(new ClubContent { ClubId = club.Id, Kind = "Page", Title = "Welcome to Harbour", Body = "Find your people. Play your sport. Explore coaching, training and club life for every stage.", Published = true }, new ClubContent { ClubId = club.Id, Kind = "Menu", Title = "Today’s clubhouse menu", Body = "Soup and bread · Grilled sandwiches · Tea and coffee. Contact catering for ingredient and allergen information.", Published = true });
        if (!await db.PlatformContents.AnyAsync()) db.PlatformContents.Add(new PlatformContent { Slug = "welcoming-first-month", Title = "A welcoming first 30 days", Body = "Give every new member a clear next step. Introduce the coach or organiser before their first session. Follow up and listen to their feedback.", Published = true });
        db.Audits.Add(new Audit { ClubId = club.Id, ActorId = accounts["manager"].Id, Action = "Created isolated, labelled demonstration club records" });
        await db.SaveChangesAsync();
    }
}
