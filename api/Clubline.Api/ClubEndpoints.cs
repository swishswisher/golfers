using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;

namespace Clubline;

public static class ClubEndpoints
{
    public static void MapClubCreation(this WebApplication app)
    {
        app.MapPost("/api/clubs", async (CreateClub input, HttpContext http, AppDb db, TenantContext scope) =>
        {
            ValidateClub(input);
            var id = Guid.NewGuid();
            var slug = Regex.Replace(input.Name.ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
            if (slug.Length > 60) slug = slug[..60];
            var club = new Club { Id = id, Name = input.Name.Trim(), Country = input.Country.ToUpperInvariant(), Currency = input.Currency.ToUpperInvariant(), TimeZone = input.TimeZone, Sports = input.Sports.Distinct().ToArray(), BrandColor = input.BrandColor ?? "#235c45", Slug = (slug.Length > 0 ? slug : "club") + "-" + id.ToString("N")[..8] };
            scope.ClubId = id;
            db.Clubs.Add(club);
            var uid = http.User.UserId(); var user = await db.Users.SingleAsync(x => x.Id == uid);
            db.Memberships.Add(new Membership { ClubId = id, UserId = uid, Role = "Owner" });
            db.Members.Add(new Member { ClubId = id, Name = user.DisplayName, Email = user.Email!, UserId = uid });
            db.Subscriptions.Add(new ClubSubscription { ClubId = id });
            db.Preferences.Add(new Preference { ClubId = id, UserId = uid, TimeZone = club.TimeZone });
            db.Audits.Add(new Audit { ClubId = id, ActorId = uid, Action = "Created club and 14-day trial" });
            await db.SaveChangesAsync(); return Results.Created($"/api/clubs/{id}", club);
        }).RequireAuthorization().WithTags("Clubs");
        app.MapPost("/api/invitations/accept", async (AcceptInvite input, HttpContext http, AppDb db, TenantContext tenant, Jobs jobs) =>
        {
            var hash = Rules.Hash(Rules.Required(input.Token, "Invitation token", 128));
            await using var tx = await db.Database.BeginTransactionAsync();
            var invite = await db.Invitations.FromSqlInterpolated($"SELECT * FROM \"Invitations\" WHERE \"TokenHash\" = {hash} FOR UPDATE").IgnoreQueryFilters().SingleOrDefaultAsync();
            Rules.Check(invite is not null && invite.RevokedAt is null && invite.ExpiresAt > DateTimeOffset.UtcNow, "This invitation is invalid, revoked or expired.");
            var uid = http.User.UserId(); var user = await db.Users.SingleAsync(x => x.Id == uid);
            Rules.Check(user.EmailConfirmed && string.Equals(user.Email, invite!.Email, StringComparison.OrdinalIgnoreCase), "Sign in using the verified email address this invitation was sent to.", 403);
            tenant.ClubId = invite!.ClubId;
            var subscription = await db.Subscriptions.FromSqlInterpolated($"SELECT * FROM \"Subscriptions\" WHERE \"ClubId\" = {tenant.ClubId} FOR UPDATE").SingleAsync();
            Rules.Check(subscription.Status is "Active" or "Trialing" && subscription.PeriodEnd > DateTimeOffset.UtcNow, "This club subscription needs attention before accepting new members.", 402);
            var existing = await db.Memberships.SingleOrDefaultAsync(x => x.UserId == uid);
            if (invite.AcceptedAt is not null) { Rules.Check(existing?.Active == true, "This invitation was already used.", 409); return Results.Ok(new { invite.ClubId }); }
            Rules.Check(existing is null || existing.Active, "A manager must reactivate this membership.", 403);
            if (existing is null) db.Memberships.Add(new Membership { ClubId = invite.ClubId, UserId = uid, Role = invite.Role });
            var member = await db.Members.SingleOrDefaultAsync(x => x.Email == invite.Email && !x.Junior && x.UserId == null);
            if (!await db.Members.AnyAsync(x => x.UserId == uid))
            {
                if (member is null) { await CheckLimit(db, 1); db.Members.Add(new Member { ClubId = invite.ClubId, UserId = uid, Name = user.DisplayName, Email = user.Email! }); }
                else { if (member.Status != "Active") await CheckLimit(db, 1); member.UserId = uid; member.Status = "Active"; }
            }
            invite.AcceptedAt = DateTimeOffset.UtcNow;
            var welcome = await db.AutomationRules.SingleOrDefaultAsync(x => x.Kind == "Welcome" && x.Enabled);
            if (welcome is not null) { var club = await db.Clubs.SingleAsync(x => x.Id == invite.ClubId); await jobs.Notify(uid, "Welcome to " + club.Name, welcome.Template.Replace("{club}", club.Name), $"/app/{club.Id}/feed", "welcome:" + invite.Id); }

            await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(new { invite.ClubId });
        }).RequireAuthorization().WithTags("Invitations");
    }
    public static void MapClubs(this RouteGroupBuilder g)
    {
        g.MapGet("/", async (AppDb db, Access access) => await db.Clubs.AsNoTracking().SingleAsync(x => x.Id == access.ClubId));
        g.MapPut("/settings", async (CreateClub input, AppDb db, Access access) =>
        {
            access.Manage(); await access.CanWrite(); ValidateClub(input);
            await using var tx = await db.Database.BeginTransactionAsync();
            var club = await db.Clubs.FromSqlInterpolated($"SELECT * FROM \"Clubs\" WHERE \"Id\" = {access.ClubId} FOR UPDATE").SingleAsync();
            Rules.Check(club.Country == input.Country.ToUpperInvariant() || club.StripeAccountId is null, "Country cannot change after merchant onboarding. Contact support for a migration.", 409);
            Rules.Check(club.Currency == input.Currency.ToUpperInvariant() || (!await db.Payments.AnyAsync() && !await db.Activities.AnyAsync(x => x.PriceMinor > 0)), "Currency cannot change after priced activities or financial records exist.", 409);
            club.Name = input.Name.Trim(); club.Country = input.Country.ToUpperInvariant(); club.Currency = input.Currency.ToUpperInvariant(); club.TimeZone = input.TimeZone; club.Sports = input.Sports.Distinct().ToArray(); club.BrandColor = input.BrandColor ?? club.BrandColor;
            access.Audit("Updated club settings"); await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(club);
        });
        g.MapGet("/members", async (AppDb db, Access access, string? search, int? limit) =>
        {
            access.Manage(); var query = db.Members.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Name.ToLower().Contains(search.ToLower()) || x.Email.ToLower().Contains(search.ToLower()));
            return Results.Ok(await query.OrderBy(x => x.Name).Take(Math.Clamp(limit ?? 100, 1, 1000)).ToListAsync());
        });
        g.MapGet("/directory", async (AppDb db, string? search) => { var query = db.Members.AsNoTracking().Where(x => x.DirectoryVisible && !x.Junior && x.Status == "Active"); if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Name.ToLower().Contains(search.ToLower()) || x.Sport.ToLower().Contains(search.ToLower())); return Results.Ok(await query.OrderBy(x => x.Name).Select(x => new { x.Id, x.Name, x.Sport, x.UserId }).Take(100).ToListAsync()); });
        g.MapPost("/members", async (MemberInput input, AppDb db, Access access) =>
        {
            access.Manage(); await access.CanWrite(); await using var tx = await db.Database.BeginTransactionAsync(); _ = await db.Subscriptions.FromSqlInterpolated($"SELECT * FROM \"Subscriptions\" WHERE \"ClubId\" = {access.ClubId} FOR UPDATE").SingleAsync(); await CheckLimit(db, input.Status == "Inactive" ? 0 : 1);
            var member = ToMember(input, access.ClubId); db.Members.Add(member); access.Audit("Added member", member.Id); await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Created($"members/{member.Id}", member);
        });
        g.MapPut("/members/{id:guid}", async (Guid id, MemberInput input, AppDb db, Access access, ConnectionRegistry connections) =>
        {
            access.Manage(); await using var tx = await db.Database.BeginTransactionAsync(); _ = await db.Subscriptions.FromSqlInterpolated($"SELECT * FROM \"Subscriptions\" WHERE \"ClubId\" = {access.ClubId} FOR UPDATE").SingleAsync(); var member = await db.Members.SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError(404, "Member not found.");
            Rules.Check(member.Junior == input.Junior, "Junior classification is set when the member is created. Contact support for a correction.", 409);
            var previousStatus = member.Status; if (previousStatus != "Active" && input.Status != "Inactive") { await access.CanWrite(); await CheckLimit(db, 1); }
            var values = ToMember(input, access.ClubId); member.Name = values.Name; member.Email = values.Email; member.Sport = values.Sport; member.DirectoryVisible = !member.Junior && values.DirectoryVisible; member.EmergencyContact = values.EmergencyContact; member.Status = values.Status;
            if (member.UserId is not null) { var membership = await db.Memberships.SingleOrDefaultAsync(x => x.UserId == member.UserId); if (membership is not null) { Rules.Check(access.Role == "Owner" || membership.Role is "Member" or "Guardian" || member.Status == previousStatus, "Only the owner can deactivate staff accounts.", 403); Rules.Check(membership.Role != "Owner" || member.Status == "Active", "The owner membership must remain active."); membership.Active = member.Status == "Active"; if (!membership.Active) connections.RevokeUser(member.UserId); } }
            access.Audit("Updated member", id); await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(member);
        });
        g.MapPost("/members/import", async (MemberBatch input, AppDb db, Access access) =>
        {
            access.Manage(); await access.CanWrite(); Rules.Check(input.Rows is { Length: > 0 and <= 500 }, "Import between 1 and 500 rows at a time.");
            var members = input.Rows.Select(r => ToMember(r, access.ClubId)).ToList();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var existing = await db.Members.Select(x => new { x.Name, x.Email }).ToListAsync();
            var rows = members.Select((m, i) => new { row = i + 1, m.Name, m.Email, valid = seen.Add(m.Name + "|" + m.Email) && !existing.Any(x => x.Email == m.Email && x.Name == m.Name) }).ToList();
            if (!input.Commit) return Results.Ok(new { rows, committed = false });
            Rules.Check(rows.All(x => x.valid), "Resolve duplicates before committing the import.", 409);
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.Subscriptions.FromSqlInterpolated($"SELECT * FROM \"Subscriptions\" WHERE \"ClubId\" = {access.ClubId} FOR UPDATE").SingleAsync();
            await CheckLimit(db, members.Count(x => x.Status == "Active")); db.Members.AddRange(members); access.Audit($"Imported {members.Count} reviewed members"); await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(new { rows, committed = true });
        });
        g.MapGet("/family", async (AppDb db, Access access) => await (from link in db.Guardians join member in db.Members on link.JuniorMemberId equals member.Id where link.GuardianUserId == access.UserId select new { member.Id, member.Name, member.Sport, member.Status }).ToListAsync());
        g.MapPost("/guardians", async (GuardianInput input, AppDb db, Access access) =>
        {
            access.Manage(); Rules.Check(await db.Members.AnyAsync(x => x.Id == input.JuniorMemberId && x.Junior), "Choose a junior member in this club.");
            Rules.Check(await db.Memberships.AnyAsync(x => x.UserId == input.GuardianUserId && x.Active), "The guardian must have an active account in this club.");
            db.Guardians.Add(new GuardianLink { ClubId = access.ClubId, JuniorMemberId = input.JuniorMemberId, GuardianUserId = input.GuardianUserId, VerifiedBy = access.UserId }); access.Audit("Verified guardian link", input.JuniorMemberId); await db.SaveChangesAsync(); return Results.NoContent();
        });
        g.MapGet("/invitations", async (AppDb db, Access access) => { access.Manage(); return Results.Ok(await db.Invitations.AsNoTracking().Select(x => new { x.Id, x.Email, x.Role, x.ExpiresAt, x.AcceptedAt, x.RevokedAt }).ToListAsync()); });
        g.MapPost("/invitations", async (InviteMember input, AppDb db, Access access, TenantContext tenant, Jobs jobs) =>
        {
            access.Manage(); await access.CanWrite(); Rules.Check(Rules.Roles.Contains(input.Role) && input.Role != "Owner", "Choose a valid invited role.");
            if (input.Role == "Manager") access.Roles("Owner");
            var token = Rules.Token(); var invite = new Invitation { ClubId = access.ClubId, Email = Rules.Email(input.Email), Role = input.Role, TokenHash = Rules.Hash(token), ExpiresAt = DateTimeOffset.UtcNow.AddDays(7) };
            db.Invitations.Add(invite); jobs.Email(invite.Email, "Join your club on Clubline", $"Accept your invitation: {jobs.PublicUrl}/invitation?token={token}", "invite:" + invite.Id, access.ClubId); access.Audit("Created invitation", invite.Id); await db.SaveChangesAsync();
            return Results.Ok(new { invite.Id, invite.Email, invite.Role, invite.ExpiresAt, delivery = "Queued" });
        });
        g.MapDelete("/invitations/{id:guid}", async (Guid id, AppDb db, Access access) => { access.Manage(); var invite = await db.Invitations.SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError(404, "Invitation not found."); invite.RevokedAt = DateTimeOffset.UtcNow; access.Audit("Revoked invitation", id); await db.SaveChangesAsync(); return Results.NoContent(); });
        g.MapPatch("/staff/{id:guid}", async (Guid id, InviteMember input, AppDb db, Access access) =>
        {
            access.Roles("Owner"); Rules.Check(Rules.Roles.Contains(input.Role) && input.Role != "Owner", "Choose a staff role other than owner.");
            var m = await db.Memberships.SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError(404, "Membership not found."); Rules.Check(m.Role != "Owner", "Ownership cannot be changed through staff administration."); m.Role = input.Role; access.Audit("Changed staff permission", id); await db.SaveChangesAsync(); return Results.NoContent();
        });
        g.MapGet("/teams", async (AppDb db, Access access) =>
        {
            var own = await db.Members.Where(x => x.UserId == access.UserId).Select(x => x.Id).ToListAsync();
            return Results.Ok(await db.Teams.Where(t => access.Manager || db.TeamAssignments.Any(a => a.TeamId == t.Id && own.Contains(a.MemberId))).OrderBy(x => x.Name).ToListAsync());
        });
        g.MapPost("/teams", async (TeamInput input, AppDb db, Access access) => { access.Manage(); await access.CanWrite(); var team = new Team { ClubId = access.ClubId, Name = Rules.Required(input.Name, "Team name"), Sport = Rules.Required(input.Sport, "Sport") }; db.Teams.Add(team); access.Audit("Created team", team.Id); await db.SaveChangesAsync(); return Results.Ok(team); });
        g.MapPost("/teams/{id:guid}/members", async (Guid id, TeamAssignmentInput input, AppDb db, Access access) =>
        {
            access.Manage(); Rules.Check(await db.Teams.AnyAsync(x => x.Id == id) && await db.Members.AnyAsync(x => x.Id == input.MemberId), "Team and member must belong to this club."); db.TeamAssignments.Add(new TeamAssignment { ClubId = access.ClubId, TeamId = id, MemberId = input.MemberId, Staff = input.Staff }); access.Audit("Assigned team member", id); await db.SaveChangesAsync(); return Results.NoContent();
        });
    }
    private static void ValidateClub(CreateClub input)
    {
        Rules.Required(input.Name, "Club name"); Rules.Check(Regex.IsMatch(input.Country ?? "", "^[A-Za-z]{2}$"), "Use a two-letter country code."); Rules.Check(Regex.IsMatch(input.Currency ?? "", "^[A-Za-z]{3}$"), "Use a three-letter currency code.");
        try { _ = TimeZoneInfo.FindSystemTimeZoneById(Rules.Required(input.TimeZone, "Time zone", 100)); } catch (TimeZoneNotFoundException) { throw new DomainError(400, "Choose a valid IANA time zone."); }
        Rules.Check(input.Sports is { Length: > 0 and <= 20 } && input.Sports.All(s => !string.IsNullOrWhiteSpace(s) && s.Length <= 80), "Choose between 1 and 20 sports.");
        Rules.Check(input.BrandColor is null || Regex.IsMatch(input.BrandColor, "^#[0-9a-fA-F]{6}$"), "Choose a valid brand colour.");
    }
    private static Member ToMember(MemberInput input, Guid clubId) => new() { ClubId = clubId, Name = Rules.Required(input.Name, "Member name"), Email = Rules.Email(input.Email), Sport = Rules.Required(input.Sport, "Sport", 80), Junior = input.Junior, DirectoryVisible = !input.Junior && input.DirectoryVisible, EmergencyContact = input.EmergencyContact is { Length: <= 300 } ? input.EmergencyContact : "", Status = input.Status is "Inactive" ? "Inactive" : "Active" };
    private static async Task CheckLimit(AppDb db, int additions) { var sub = await db.Subscriptions.SingleAsync(); Rules.Check(await db.Members.CountAsync(x => x.Status == "Active") + additions <= sub.MemberLimit, "This club has reached its membership allowance.", 409); }
}
