using Microsoft.EntityFrameworkCore;

namespace Clubline;

public record AccountInput(string Name, string Sport, bool DirectoryVisible, string EmergencyContact);
public record AutomationInput(bool Enabled, int OffsetHours, string Template);
public static class AccountEndpoints
{
    public static void MapAccounts(this RouteGroupBuilder g)
    {
        g.MapGet("/account", async (AppDb db, Access access) => new { member = await db.Members.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == access.UserId), children = await (from l in db.Guardians join m in db.Members on l.JuniorMemberId equals m.Id where l.GuardianUserId == access.UserId select new { m.Id, m.Name, m.Sport, m.Status }).ToListAsync() });
        g.MapPut("/account", async (AccountInput input, AppDb db, Access access) =>
        {
            var member = await db.Members.SingleOrDefaultAsync(x => x.UserId == access.UserId) ?? throw new DomainError(404, "Membership record not found."); member.Name = Rules.Required(input.Name, "Name"); member.Sport = Rules.Required(input.Sport, "Sport", 80); member.DirectoryVisible = !member.Junior && input.DirectoryVisible; member.EmergencyContact = (input.EmergencyContact ?? "").Length <= 300 ? input.EmergencyContact ?? "" : throw new DomainError(400, "Emergency contact is too long."); await db.SaveChangesAsync(); return Results.Ok(member);
        });
        g.MapGet("/staff", async (AppDb db, Access access) => { access.Manage(); return Results.Ok(await (from m in db.Memberships join u in db.Users on m.UserId equals u.Id where m.Active select new { m.Id, m.UserId, m.Role, name = u.DisplayName, u.Email }).ToListAsync()); });
        g.MapGet("/team-rosters", async (AppDb db, Access access) => { access.Roles("Owner", "Manager", "Coach"); var own = db.Members.Where(m => m.UserId == access.UserId).Select(m => m.Id); var teams = db.Teams.Where(t => access.Manager || db.TeamAssignments.Any(a => a.TeamId == t.Id && a.Staff && own.Contains(a.MemberId))).Select(t => t.Id); var rows = await (from a in db.TeamAssignments join m in db.Members on a.MemberId equals m.Id where teams.Contains(a.TeamId) orderby m.Name select new { a.TeamId, m.Id, m.Name, m.Sport, m.Junior, a.Staff }).ToListAsync(); return Results.Ok(rows.GroupBy(x => x.TeamId).ToDictionary(x => x.Key, x => x.Select(m => new { m.Id, m.Name, m.Sport, m.Junior, m.Staff }).ToList())); });
        g.MapGet("/teams/{id:guid}/members", async (Guid id, AppDb db, Access access) =>
        {
            Rules.Check(await access.Assigned(id), "Only managers and assigned coaches can open this roster.", 403);
            return Results.Ok(await (from a in db.TeamAssignments join m in db.Members on a.MemberId equals m.Id where a.TeamId == id select new { m.Id, m.Name, m.Sport, m.Junior, a.Staff }).ToListAsync());
        });
        g.MapGet("/finance/members", async (AppDb db, Access access) => { access.Finance(); return Results.Ok(await db.Members.Where(x => x.Status == "Active").OrderBy(x => x.Name).Select(x => new { x.Id, x.Name, x.Sport, x.Junior }).ToListAsync()); });
        g.MapGet("/finance/registrations", async (AppDb db, Access access) =>
        {
            access.Finance(); return Results.Ok(await (from r in db.Registrations join m in db.Members on r.MemberId equals m.Id join a in db.Activities on r.ActivityId equals a.Id where r.Status == "PendingPayment" && r.ReservationExpiresAt > DateTimeOffset.UtcNow select new { r.Id, memberName = m.Name, activityTitle = a.Title, r.AmountMinor }).Take(100).ToListAsync());
        });
        g.MapGet("/automations", async (AppDb db, Access access) => { access.Manage(); return Results.Ok(await db.AutomationRules.AsNoTracking().OrderBy(x => x.Kind).ToListAsync()); });
        g.MapPut("/automations/{kind}", async (string kind, AutomationInput input, AppDb db, Access access) =>
        {
            access.Manage(); await access.CanWrite(); Rules.Check(kind is "Welcome" or "Reminder" or "Digest", "Choose a supported workflow."); Rules.Check(input.OffsetHours is >= 1 and <= 168, "Use a reminder lead time between 1 and 168 hours.");
            var rule = await db.AutomationRules.SingleOrDefaultAsync(x => x.Kind == kind);
            if (rule is null) { rule = new AutomationRule { ClubId = access.ClubId, Kind = kind }; db.AutomationRules.Add(rule); }
            rule.Enabled = input.Enabled; rule.OffsetHours = input.OffsetHours; rule.Template = Rules.Required(input.Template, "Workflow message", 1000); access.Audit("Configured " + kind + " workflow"); await db.SaveChangesAsync(); return Results.Ok(rule);
        });
    }
}
