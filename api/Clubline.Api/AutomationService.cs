using Microsoft.EntityFrameworkCore;
namespace Clubline;
public sealed class AutomationService(AppDb db, TenantContext tenant, Jobs jobs)
{
    public async Task Run(CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var ids = await db.AutomationRules.IgnoreQueryFilters().Where(x => x.Enabled && x.Kind != "Welcome" && (x.LastRunAt == null || x.LastRunAt < now.AddMinutes(-1))).Select(x => x.Id).Take(25).ToListAsync(ct);
        foreach (var id in ids)
        {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var rule = await db.AutomationRules.FromSqlInterpolated($"SELECT * FROM \"AutomationRules\" WHERE \"Id\" = {id} FOR UPDATE SKIP LOCKED").IgnoreQueryFilters().SingleOrDefaultAsync(ct);
            if (rule is null || !rule.Enabled || rule.LastRunAt > now.AddMinutes(-1)) continue;
            tenant.ClubId = rule.ClubId;
            var club = await db.Clubs.SingleAsync(x => x.Id == rule.ClubId, ct);
            var sub = await db.Subscriptions.SingleAsync(ct);
            if (club.Suspended || sub.Status is not ("Active" or "Trialing") || sub.PeriodEnd < now) { rule.LastRunAt = now; await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); continue; }
            var text = rule.Template.Replace("{club}", club.Name);
            if (rule.Kind == "Reminder")
            {
                var targets = await (from r in db.Registrations join a in db.Activities on r.ActivityId equals a.Id join m in db.Memberships on r.BookedBy equals m.UserId where m.Active && r.Status == "Confirmed" && a.Status == "Published" && a.StartsAt > now && a.StartsAt <= now.AddHours(rule.OffsetHours) select new { r.Id, r.BookedBy, ActivityId = a.Id, a.Title }).ToListAsync(ct);
                foreach (var target in targets) await jobs.Notify(target.BookedBy, "Coming up: " + target.Title, text, $"/app/{club.Id}/activities/{target.ActivityId}", "reminder:" + target.Id);
            }
            if (rule.Kind == "Digest")
            {
                var local = TimeZoneInfo.ConvertTime(now, TimeZoneInfo.FindSystemTimeZoneById(club.TimeZone));
                if (local.DayOfWeek == DayOfWeek.Monday && local.Hour >= 9)
                {
                    var titles = await db.Activities.Where(x => x.Status == "Published" && x.TeamId == null && x.Audience != "Sport" && x.StartsAt > now && x.StartsAt < now.AddDays(7)).OrderBy(x => x.StartsAt).Select(x => x.Title).Take(6).ToListAsync(ct);
                    var users = await (from m in db.Memberships join p in db.Preferences on m.UserId equals p.UserId where m.Active && p.Digest select m.UserId).ToListAsync(ct);
                    foreach (var uid in users) await jobs.Notify(uid, "Your week at " + club.Name, text + "\n" + string.Join("\n", titles), $"/app/{club.Id}/activities", "digest:" + club.Id + ":" + uid + ":" + local.ToString("yyyy-MM-dd"));
                }
            }
            rule.LastRunAt = now; await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        }
    }
}
