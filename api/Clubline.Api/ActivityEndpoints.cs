using Microsoft.EntityFrameworkCore;

namespace Clubline;

public sealed class ActivityService(AppDb db, Access access, Jobs jobs)
{
    public async Task<bool> Visible(Activity a)
    {
        if (access.Manager || a.AuthorId == access.UserId) return true;
        if (a.Status != "Published") return false;
        var members = await db.Members.Where(m => m.UserId == access.UserId || db.Guardians.Any(g => g.GuardianUserId == access.UserId && g.JuniorMemberId == m.Id)).ToListAsync();
        if (a.TeamId is not null && !await db.TeamAssignments.AnyAsync(x => x.TeamId == a.TeamId && members.Select(m => m.Id).Contains(x.MemberId))) return false;
        return a.Audience != "Sport" || members.Any(x => x.Sport == a.Sport);
    }
    public async Task Publish(Guid id)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var a = await Locked(id); await access.ManageActivity(a); await access.CanWrite();
        if (a.Status == "Published") return;
        Rules.Check(a.Status == "Draft", "Only a draft can be published.", 409);
        a.Status = "Published"; a.PublishedAt = DateTimeOffset.UtcNow;
        var members = db.Members.Where(x => x.Status == "Active");
        if (a.Audience == "Sport") members = members.Where(x => x.Sport == a.Sport);
        if (a.TeamId is not null) members = members.Where(x => db.TeamAssignments.Any(t => t.TeamId == a.TeamId && t.MemberId == x.Id));
        var memberIds = await members.Select(x => x.Id).ToListAsync();
        var recipients = await members.Where(x => !x.Junior && x.UserId != null).Select(x => x.UserId!).ToListAsync();
        recipients.AddRange(await db.Guardians.Where(x => memberIds.Contains(x.JuniorMemberId)).Select(x => x.GuardianUserId).ToListAsync());
        recipients.Add(a.AuthorId);
        var active = await db.Memberships.Where(x => x.Active && recipients.Contains(x.UserId)).Select(x => x.UserId).ToListAsync();
        foreach (var uid in active.Distinct()) await jobs.Notify(uid, a.Title, a.Description[..Math.Min(300, a.Description.Length)], $"/app/{a.ClubId}/activities/{a.Id}", "publish:" + a.Id + ":" + uid);
        access.Audit("Published activity and queued notifications", id);
        await db.SaveChangesAsync(); await tx.CommitAsync();
    }
    public async Task<Activity> Locked(Guid id) => await db.Activities.FromSqlInterpolated($"SELECT *, xmin FROM \"Activities\" WHERE \"Id\" = {id} AND \"ClubId\" = {access.ClubId} FOR UPDATE").SingleOrDefaultAsync() ?? throw new DomainError(404, "Activity not found.");
    public async Task<Registration> Register(Guid activityId, RegisterActivity input)
    {
        Rules.Check(input.Consent, "Accept the activity terms and confirm participant or guardian authority.");
        Rules.Check(await access.CanActFor(input.MemberId), "You cannot register this participant.", 403);
        await access.CanWrite(); await using var tx = await db.Database.BeginTransactionAsync();
        var a = await Locked(activityId);
        Rules.Check(a.Kind != "Announcement" && a.Status == "Published" && a.StartsAt > DateTimeOffset.UtcNow && await Visible(a), "Registration is not available for this activity.", 403);
        var participant = await db.Members.SingleAsync(x => x.Id == input.MemberId);
        Rules.Check((a.Audience != "Sport" || participant.Sport == a.Sport) && (a.TeamId == null || await db.TeamAssignments.AnyAsync(x => x.TeamId == a.TeamId && x.MemberId == participant.Id)), "This participant is not eligible for this activity.", 403);
        var existing = await db.Registrations.SingleOrDefaultAsync(x => x.ActivityId == activityId && x.MemberId == input.MemberId);
        if (existing is not null && existing.Status is not ("Cancelled" or "Expired")) return existing;
        var now = DateTimeOffset.UtcNow;
        var count = await db.Registrations.CountAsync(x => x.ActivityId == a.Id && (x.Status == "Confirmed" || x.Status == "PendingPayment" && x.ReservationExpiresAt > now));
        var full = count >= a.Capacity;
        Rules.Check(!full || input.JoinWaitlist, "This activity is full. Join its waitlist to receive an available place.", 409);
        var r = existing ?? new Registration { ClubId = access.ClubId, ActivityId = a.Id, MemberId = input.MemberId, BookedBy = access.UserId };
        if (existing is not null) { r.AttemptId = Guid.NewGuid(); r.CreatedAt = now; } r.BookedBy = access.UserId;
        r.Consent = true; r.Status = full ? "Waitlisted" : a.PriceMinor > 0 ? "PendingPayment" : "Confirmed";
        r.ReservationExpiresAt = r.Status == "PendingPayment" ? now.AddMinutes(30) : null; r.AmountMinor = a.PriceMinor;
        if (existing is null) db.Registrations.Add(r);
        access.Audit("Created " + r.Status + " registration", r.Id);
        await jobs.Notify(access.UserId, full ? "You are on the waitlist" : r.Status == "Confirmed" ? "Registration confirmed" : "Complete your registration payment", a.Title, $"/app/{a.ClubId}/activities/{a.Id}", "registration:" + r.Id + ":" + r.AttemptId + ":" + r.Status);
        await db.SaveChangesAsync(); await tx.CommitAsync(); return r;
    }
    public async Task Promote(Activity a)
    {
        var now = DateTimeOffset.UtcNow;
        var count = await db.Registrations.CountAsync(x => x.ActivityId == a.Id && (x.Status == "Confirmed" || x.Status == "PendingPayment" && x.ReservationExpiresAt > now));
        var available = Math.Max(0, a.Capacity - count);
        var next = await db.Registrations.Where(x => x.ActivityId == a.Id && x.Status == "Waitlisted").OrderBy(x => x.CreatedAt).Take(available).ToListAsync();
        foreach (var r in next)
        {
            r.Status = a.PriceMinor > 0 ? "PendingPayment" : "Confirmed"; r.ReservationExpiresAt = a.PriceMinor > 0 ? now.AddMinutes(30) : null;
            await jobs.Notify(r.BookedBy, "A place is available", a.Title + (a.PriceMinor > 0 ? ". Complete payment within 30 minutes." : ". Your registration is confirmed."), $"/app/{a.ClubId}/activities/{a.Id}", "waitlist-offer:" + r.Id + ":" + r.AttemptId);
        }
    }
}
public static class ActivityEndpoints
{
    public static void MapActivities(this RouteGroupBuilder g)
    {
        g.MapGet("/activities", async (AppDb db, Access access, ActivityService service, string? sport) =>
        {
            var q = db.Activities.AsNoTracking(); if (!string.IsNullOrWhiteSpace(sport)) q = q.Where(x => x.Sport == sport);
            var ownIds = await db.Members.Where(x => x.Status == "Active" && (x.UserId == access.UserId || db.Guardians.Any(g => g.GuardianUserId == access.UserId && g.JuniorMemberId == x.Id))).Select(x => x.Id).ToListAsync();
            if (!access.Manager) q = q.Where(a => a.AuthorId == access.UserId || a.Status == "Published" && (a.TeamId == null || db.TeamAssignments.Any(t => t.TeamId == a.TeamId && ownIds.Contains(t.MemberId))) && (a.Audience != "Sport" || db.Members.Any(m => ownIds.Contains(m.Id) && m.Sport == a.Sport)));
            var now = DateTimeOffset.UtcNow;
            return Results.Ok(await q.OrderByDescending(x => x.CreatedAt).Take(100).Select(a => new { a.Id, a.Title, a.Description, a.Kind, a.Sport, a.StartsAt, a.EndsAt, a.Place, a.Capacity, a.PriceMinor, a.TeamId, a.Audience, a.Status, registeredCount = db.Registrations.Count(x => x.ActivityId == a.Id && (x.Status == "Confirmed" || x.Status == "PendingPayment" && x.ReservationExpiresAt > now)) }).ToListAsync());
        });
        g.MapGet("/activities/{id:guid}", async (Guid id, AppDb db, ActivityService service, Access access) =>
        {
            var a = await db.Activities.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError(404, "Activity not found."); Rules.Check(await service.Visible(a), "Activity access is not permitted.", 403);
            var own = await db.Members.Where(x => x.UserId == access.UserId || db.Guardians.Any(l => l.GuardianUserId == access.UserId && l.JuniorMemberId == x.Id)).Select(x => new { x.Id, x.Name, x.Junior }).ToListAsync();
            var bookings = await db.Registrations.Where(x => x.ActivityId == id && own.Select(m => m.Id).Contains(x.MemberId)).AsNoTracking().ToListAsync();
            var canManage = access.Manager || (access.Role == "Caterer" && a.AuthorId == access.UserId && a.Kind is "Social" or "Promotion" or "Announcement") || (access.Role == "ProShop" && a.AuthorId == access.UserId && a.Kind is "Coaching" or "Promotion" or "Announcement") || (access.Role == "Coach" && a.Kind is "Coaching" or "Training" && await access.Assigned(a.TeamId));
            return Results.Ok(new { activity = await Summary(db, a), participants = own, registrations = bookings, canManage });
        });
        g.MapPost("/activities", async (ActivityInput input, AppDb db, Access access) =>
        {
            await access.CanWrite(); var a = FromInput(input, access.ClubId, access.UserId); await access.ManageActivity(a);
            db.Activities.Add(a); access.Audit("Created activity draft", a.Id); await db.SaveChangesAsync(); return Results.Created($"activities/{a.Id}", a);
        });
        g.MapPut("/activities/{id:guid}", async (Guid id, ActivityInput input, AppDb db, Access access) =>
        {
            var a = await db.Activities.SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError(404, "Activity not found."); await access.ManageActivity(a); await access.CanWrite(); Rules.Check(a.Status == "Draft", "Published activities require cancellation or a separate update announcement.", 409);
            var values = FromInput(input, access.ClubId, access.UserId); await access.ManageActivity(values);
            a.Title = values.Title; a.Description = values.Description; a.Kind = values.Kind; a.Sport = values.Sport; a.StartsAt = values.StartsAt; a.EndsAt = values.EndsAt; a.Place = values.Place; a.Capacity = values.Capacity; a.PriceMinor = values.PriceMinor; a.TeamId = values.TeamId; a.Audience = values.Audience;
            access.Audit("Edited activity draft", id); await db.SaveChangesAsync(); return Results.Ok(a);
        });
        g.MapPost("/activities/{id:guid}/publish", async (Guid id, ActivityService service) => { await service.Publish(id); return Results.Ok(new { status = "Published", notifications = "Queued" }); });
        g.MapPost("/activities/{id:guid}/cancel", async (Guid id, AppDb db, ActivityService service, Access access, Jobs jobs) => { await using var tx = await db.Database.BeginTransactionAsync(); var a = await service.Locked(id); await access.ManageActivity(a); if (a.Status == "Cancelled") return Results.NoContent(); a.Status = "Cancelled"; var registrations = await db.Registrations.Where(x => x.ActivityId == id && x.Status != "Cancelled").ToListAsync(); foreach (var r in registrations) { r.Status = "Cancelled"; r.ReservationExpiresAt = null; await jobs.Notify(r.BookedBy, "Activity cancelled: " + a.Title, "Contact the club about any paid fee or refund review.", $"/app/{a.ClubId}/activities/{id}", "cancel-activity:" + id + ":" + r.BookedBy); } access.Audit("Cancelled activity; paid fees require finance review", id); await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.NoContent(); });
        g.MapPost("/activities/{id:guid}/register", async (Guid id, RegisterActivity input, ActivityService service) => Results.Ok(await service.Register(id, input)));
        g.MapGet("/activities/{id:guid}/registrations", async (Guid id, AppDb db, Access access) =>
        {
            var a = await db.Activities.SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError(404, "Activity not found."); await access.ManageActivity(a);
            return Results.Ok(await (from r in db.Registrations join m in db.Members on r.MemberId equals m.Id where r.ActivityId == id orderby r.CreatedAt select new { r.Id, r.MemberId, memberName = m.Name, r.Status, r.Attendance, r.AmountMinor, r.ReservationExpiresAt }).ToListAsync());
        });
        g.MapPost("/registrations/{id:guid}/attendance", async (Guid id, AttendanceInput input, AppDb db, Access access) =>
        {
            Rules.Check(input.Status is "Present" or "Absent" or "NotCheckedIn", "Choose a valid attendance state.");
            var r = await db.Registrations.SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError(404, "Registration not found."); var a = await db.Activities.SingleAsync(x => x.Id == r.ActivityId); await access.ManageActivity(a); Rules.Check(r.Status == "Confirmed", "Only confirmed registrations can be checked in.", 409);
            r.Attendance = input.Status; access.Audit("Attendance: " + input.Status, id); await db.SaveChangesAsync(); return Results.Ok(r);
        });
        g.MapPost("/registrations/{id:guid}/cancel", async (Guid id, AppDb db, Access access, ActivityService service) =>
        {
            var r = await db.Registrations.SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError(404, "Registration not found."); Rules.Check(await access.CanActFor(r.MemberId), "You cannot cancel this participant's registration.", 403);
            await using var tx = await db.Database.BeginTransactionAsync(); var a = await service.Locked(r.ActivityId); await db.Entry(r).ReloadAsync(); Rules.Check(a.StartsAt > DateTimeOffset.UtcNow, "Contact the club to cancel after the activity has started.", 409);
            r.Status = "Cancelled"; await db.SaveChangesAsync(); await service.Promote(a); access.Audit("Cancelled registration; paid refunds require staff review", id); await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.NoContent();
        });
        g.MapGet("/resources", async (AppDb db) => await db.Resources.AsNoTracking().OrderBy(x => x.Name).ToListAsync());
        g.MapPost("/resources", async (ResourceInput input, AppDb db, Access access) =>
        {
            access.Manage(); await access.CanWrite(); Rules.Check(input.SlotMinutes is >= 15 and <= 1440, "Resource slot length must be between 15 and 1440 minutes."); var resource = new Resource { ClubId = access.ClubId, Name = Rules.Required(input.Name, "Resource name"), Sport = Rules.Required(input.Sport, "Sport"), SlotMinutes = input.SlotMinutes }; db.Resources.Add(resource); access.Audit("Created resource", resource.Id); await db.SaveChangesAsync(); return Results.Ok(resource);
        });
        g.MapGet("/bookings", async (AppDb db) => await db.Bookings.AsNoTracking().Where(x => x.Status == "Confirmed").OrderBy(x => x.StartsAt).Take(100).Select(x => new { x.Id, x.ResourceId, x.Title, x.StartsAt, x.EndsAt, x.UserId }).ToListAsync());
        g.MapPost("/bookings", async (BookingInput input, AppDb db, Access access) =>
        {
            await access.CanWrite(); Rules.Check(input.StartsAt > DateTimeOffset.UtcNow && input.EndsAt > input.StartsAt && input.EndsAt - input.StartsAt <= TimeSpan.FromHours(8), "Choose a future booking lasting no more than 8 hours.");
            await using var tx = await db.Database.BeginTransactionAsync();
            _ = await db.Resources.FromSqlInterpolated($"SELECT * FROM \"Resources\" WHERE \"Id\" = {input.ResourceId} AND \"ClubId\" = {access.ClubId} FOR UPDATE").SingleOrDefaultAsync() ?? throw new DomainError(404, "Resource not found.");
            Rules.Check(!await db.Bookings.AnyAsync(x => x.ResourceId == input.ResourceId && x.Status == "Confirmed" && x.StartsAt < input.EndsAt && x.EndsAt > input.StartsAt), "This resource is already booked for that time.", 409);
            var b = new Booking { ClubId = access.ClubId, ResourceId = input.ResourceId, UserId = access.UserId, Title = Rules.Required(input.Title, "Booking title"), StartsAt = input.StartsAt.ToUniversalTime(), EndsAt = input.EndsAt.ToUniversalTime() }; db.Bookings.Add(b); access.Audit("Reserved resource", b.Id); await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(b);
        });
        g.MapPost("/bookings/{id:guid}/cancel", async (Guid id, AppDb db, Access access) => { var b = await db.Bookings.SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError(404, "Booking not found."); Rules.Check(b.UserId == access.UserId || access.Manager, "Only the booker or manager can cancel this booking.", 403); b.Status = "Cancelled"; access.Audit("Cancelled resource booking", id); await db.SaveChangesAsync(); return Results.NoContent(); });
    }
    public static async Task<object> Summary(AppDb db, Activity a)
    {
        var now = DateTimeOffset.UtcNow; var count = await db.Registrations.CountAsync(x => x.ActivityId == a.Id && (x.Status == "Confirmed" || x.Status == "PendingPayment" && x.ReservationExpiresAt > now));
        return new { a.Id, a.Title, a.Description, a.Kind, a.Sport, a.StartsAt, a.EndsAt, a.Place, a.Capacity, a.PriceMinor, a.TeamId, a.Audience, a.Status, a.PublishedAt, a.Version, registeredCount = count };
    }
    private static Activity FromInput(ActivityInput input, Guid clubId, string userId)
    {
        Rules.Check(Rules.ActivityKinds.Contains(input.Kind), "Choose a supported activity kind."); Rules.Check(input.Audience is "All" or "Sport" or "Public", "Choose a valid audience.");
        Rules.Check(input.Capacity is >= 1 and <= 100000 && input.PriceMinor is >= 0 and <= 1000000000, "Review capacity and price.");
        Rules.Check(input.Kind == "Announcement" || input.EndsAt > input.StartsAt && input.StartsAt > DateTimeOffset.UtcNow.AddMinutes(-5), "Choose a future start and a later end time.");
        return new Activity { ClubId = clubId, Title = Rules.Required(input.Title, "Title"), Description = Rules.Required(input.Description, "Description", 8000), Kind = input.Kind, Sport = Rules.Required(input.Sport, "Sport", 80), StartsAt = input.StartsAt.ToUniversalTime(), EndsAt = input.EndsAt.ToUniversalTime(), Place = Rules.Required(input.Place, "Place"), Capacity = input.Capacity, PriceMinor = input.Kind == "Announcement" ? 0 : input.PriceMinor, TeamId = input.TeamId, Audience = input.Audience, AuthorId = userId };
    }
}
