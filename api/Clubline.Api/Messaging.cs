using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Clubline;

public sealed class MessagingService(AppDb db, Access access, IHubContext<ClubHub> hub, ConnectionRegistry connections)
{
    public async Task<Message> Send(Guid conversationId, SendMessage input)
    {
        await access.Conversation(conversationId); await access.CanWrite();
        Rules.Check(input.ClientMessageId != Guid.Empty, "A client message ID is required.");
        var body = Rules.Required(input.Body, "Message", 4000);
        await using var tx = await db.Database.BeginTransactionAsync();
        _ = await db.Conversations.FromSqlInterpolated($"SELECT * FROM \"Conversations\" WHERE \"Id\" = {conversationId} AND \"ClubId\" = {access.ClubId} FOR UPDATE").SingleAsync();
        var existing = await db.Messages.AsNoTracking().SingleOrDefaultAsync(m => m.SenderId == access.UserId && m.ClientMessageId == input.ClientMessageId);
        if (existing is not null) { Rules.Check(existing.ConversationId == conversationId && existing.Body == body, "This client message ID has already been used for different content.", 409); return existing; }
        var message = new Message { ClubId = access.ClubId, ConversationId = conversationId, SenderId = access.UserId, ClientMessageId = input.ClientMessageId, Body = body };
        db.Messages.Add(message);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" })
        {
            await tx.RollbackAsync(); db.Entry(message).State = EntityState.Detached;
            existing = await db.Messages.AsNoTracking().SingleAsync(m => m.SenderId == access.UserId && m.ClientMessageId == input.ClientMessageId);
            Rules.Check(existing.ConversationId == conversationId && existing.Body == body, "This client message ID is already in use.", 409); return existing;
        }
        await tx.CommitAsync();
        // Fanout is per active recipient, rather than trusting previously joined groups.
        var recipients = await (from p in db.Participants join m in db.Memberships on p.UserId equals m.UserId where p.ConversationId == conversationId && p.Active && m.Active select p.UserId).Distinct().ToListAsync();
        var sessions = await db.Sessions.Where(x => recipients.Contains(x.UserId) && x.RevokedAt == null && x.ExpiresAt > DateTimeOffset.UtcNow).Select(x => x.Id).ToListAsync();
        await hub.Clients.Clients(connections.Active(sessions)).SendAsync("messageAdded", new { message.ClubId, message.ConversationId, message.Id, message.ClientMessageId, message.Sequence, message.Body, message.SenderId, message.CreatedAt });
        return message;
    }
}
[Authorize]
public sealed class ClubHub(AppDb db, Access access, ConnectionRegistry connections) : Hub
{
    public override Task OnConnectedAsync() { if (!Guid.TryParse(Context.User?.FindFirstValue("sid"), out var sid)) { Context.Abort(); return Task.CompletedTask; } connections.Add(Context.ConnectionId, Context.User!.UserId(), sid, Context.Abort); return base.OnConnectedAsync(); }
    public override Task OnDisconnectedAsync(Exception? exception) { connections.Remove(Context.ConnectionId); return base.OnDisconnectedAsync(exception); }
    public async Task<object> JoinConversation(Guid clubId, Guid conversationId, long after = 0)
    {
        var uid = Context.User!.UserId();
        Rules.Check(Guid.TryParse(Context.User!.FindFirstValue("sid"), out var sid) && await db.Sessions.AnyAsync(x => x.Id == sid && x.UserId == uid && x.RevokedAt == null && x.ExpiresAt > DateTimeOffset.UtcNow), "This session is no longer active.", 401);
        await access.SetClub(clubId, uid); await access.Conversation(conversationId, uid);
        await Groups.AddToGroupAsync(Context.ConnectionId, $"club:{clubId}:conversation:{conversationId}");
        return new { messages = await db.Messages.AsNoTracking().Where(x => x.ConversationId == conversationId && x.Sequence > after).OrderBy(x => x.Sequence).Take(100).Select(x => new { x.Id, x.ClientMessageId, x.Sequence, body = x.HiddenAt == null ? x.Body : "[Message hidden after review]", x.SenderId, x.CreatedAt }).ToListAsync() };
    }
    public Task LeaveConversation(Guid clubId, Guid conversationId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, $"club:{clubId}:conversation:{conversationId}");
}
public static class MessagingEndpoints
{
    public static void MapMessaging(this RouteGroupBuilder g)
    {
        g.MapGet("/conversations", async (AppDb db, Access access) =>
            await (from p in db.Participants join c in db.Conversations on p.ConversationId equals c.Id where p.UserId == access.UserId && p.Active orderby c.CreatedAt descending select new { c.Id, c.Title, c.Kind, c.ActivityId, p.ReadThrough, unreadCount = db.Messages.Count(m => m.ConversationId == c.Id && m.Sequence > p.ReadThrough && m.SenderId != access.UserId) }).Take(100).ToListAsync());
        g.MapPost("/conversations", async (ConversationInput input, AppDb db, Access access) =>
        {
            await access.CanWrite(); Rules.Check(input.Kind is "Private" or "Group", "Choose a private or group conversation.");
            Rules.Check(input.UserIds is { Length: >= 1 and <= 99 }, "Choose between 1 and 99 other participants.");
            var ids = input.UserIds.Append(access.UserId).Distinct().ToArray(); Rules.Check(ids.Length is >= 2 and <= 100 && (input.Kind != "Private" || ids.Length == 2), "Choose between 2 and 100 participants. A private conversation has two.");
            var count = await db.Memberships.CountAsync(m => m.Active && ids.Contains(m.UserId)); Rules.Check(count == ids.Length, "All participants must be active in this club.");
            Rules.Check(!await db.Members.AnyAsync(m => m.Junior && m.UserId != null && ids.Contains(m.UserId)), "Use guardian-linked communication for junior members.", 403);
            var conversation = new Conversation { ClubId = access.ClubId, Title = Rules.Required(input.Title, "Conversation title"), Kind = input.Kind, CreatedBy = access.UserId };
            db.Conversations.Add(conversation); db.Participants.AddRange(ids.Select(uid => new Participant { ClubId = access.ClubId, ConversationId = conversation.Id, UserId = uid })); access.Audit("Created conversation", conversation.Id); await db.SaveChangesAsync(); return Results.Ok(conversation);
        });
        g.MapGet("/conversations/{id:guid}/messages", async (Guid id, long? after, AppDb db, Access access) =>
        {
            await access.Conversation(id);
            var messages = await (from m in db.Messages.AsNoTracking() join u in db.Users on m.SenderId equals u.Id where m.ConversationId == id && m.Sequence > (after ?? 0) orderby m.Sequence select new { m.Id, m.ClientMessageId, m.Sequence, body = m.HiddenAt == null ? m.Body : "[Message hidden after review]", m.SenderId, senderName = u.DisplayName, m.CreatedAt, hidden = m.HiddenAt != null }).Take(100).ToListAsync();
            return Results.Ok(new { messages, nextCursor = messages.LastOrDefault()?.Sequence ?? after ?? 0 });
        });
        g.MapPost("/conversations/{id:guid}/messages", async (Guid id, SendMessage input, MessagingService service) => Results.Ok(await service.Send(id, input)));
        g.MapPost("/conversations/{id:guid}/read", async (Guid id, ReadMessage input, AppDb db, Access access) =>
        {
            await access.Conversation(id); var max = await db.Messages.Where(x => x.ConversationId == id).MaxAsync(x => (long?)x.Sequence) ?? 0; var through = Math.Clamp(input.Through, 0, max);
            await db.Participants.Where(x => x.ConversationId == id && x.UserId == access.UserId).ExecuteUpdateAsync(s => s.SetProperty(x => x.ReadThrough, x => x.ReadThrough < through ? through : x.ReadThrough)); return Results.NoContent();
        });
        g.MapDelete("/conversations/{id:guid}/participants/{userId}", async (Guid id, string userId, AppDb db, Access access) =>
        {
            await access.Conversation(id); var conversation = await db.Conversations.SingleAsync(x => x.Id == id); Rules.Check(userId == access.UserId || conversation.CreatedBy == access.UserId, "Only the creator can remove another participant.", 403);
            var p = await db.Participants.SingleOrDefaultAsync(x => x.ConversationId == id && x.UserId == userId) ?? throw new DomainError(404, "Participant not found."); p.Active = false; access.Audit("Removed conversation participant", id); await db.SaveChangesAsync(); return Results.NoContent();
        });
        g.MapPost("/messages/{id:guid}/report", async (Guid id, ReportInput input, AppDb db, Access access) =>
        {
            var m = await db.Messages.SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError(404, "Message not found."); await access.Conversation(m.ConversationId);
            var report = new MessageReport { ClubId = access.ClubId, MessageId = id, ReporterId = access.UserId, Reason = Rules.Required(input.Reason, "Report reason", 1000) }; db.Reports.Add(report); access.Audit("Reported message", id); await db.SaveChangesAsync(); return Results.Ok(new { report.Id, report.Status });
        });
        g.MapGet("/moderation", async (AppDb db, Access access) =>
        {
            access.Manage(); return Results.Ok(await (from r in db.Reports join m in db.Messages on r.MessageId equals m.Id orderby r.CreatedAt descending select new { r.Id, r.MessageId, r.Reason, r.Status, r.CreatedAt, message = m.Body, m.ConversationId }).Take(100).ToListAsync());
        });
        g.MapPost("/moderation/{id:guid}", async (Guid id, ModerateInput input, AppDb db, Access access) =>
        {
            access.Manage(); Rules.Required(input.Reason, "Review reason", 1000); var report = await db.Reports.SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError(404, "Report not found."); var message = await db.Messages.SingleAsync(x => x.Id == report.MessageId); if (input.Hide) message.HiddenAt = DateTimeOffset.UtcNow; report.Status = input.Hide ? "Hidden" : "Reviewed"; access.Audit("Reviewed message report: " + report.Status, id); await db.SaveChangesAsync(); return Results.NoContent();
        });
        g.MapGet("/notifications", async (AppDb db, Access access) => await db.Notifications.AsNoTracking().Where(n => n.UserId == access.UserId).OrderByDescending(n => n.CreatedAt).Take(100).ToListAsync());
        g.MapPost("/notifications/read", async (AppDb db, Access access) => { await db.Notifications.Where(x => x.UserId == access.UserId && x.ReadAt == null).ExecuteUpdateAsync(s => s.SetProperty(x => x.ReadAt, DateTimeOffset.UtcNow)); return Results.NoContent(); });
        g.MapGet("/preferences", async (AppDb db, Access access) => Results.Ok(await db.Preferences.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == access.UserId) ?? new Preference { ClubId = access.ClubId, UserId = access.UserId }));
        g.MapPut("/preferences", async (PreferenceInput input, AppDb db, Access access) =>
        {
            Rules.Check(input.Language == "en", "English is the supported interface language at launch.");
            try { _ = TimeZoneInfo.FindSystemTimeZoneById(Rules.Required(input.TimeZone, "Time zone", 100)); } catch (TimeZoneNotFoundException) { throw new DomainError(400, "Choose a valid time zone."); }
            var p = await db.Preferences.SingleOrDefaultAsync(x => x.UserId == access.UserId);
            if (p is null) { p = new Preference { ClubId = access.ClubId, UserId = access.UserId }; db.Preferences.Add(p); }
            p.Email = input.Email; p.Push = input.Push; p.Digest = input.Digest; p.Language = input.Language; p.TimeZone = input.TimeZone;
            if (!input.Push) await db.PushSubscriptions.Where(x => x.UserId == access.UserId).ExecuteUpdateAsync(s => s.SetProperty(x => x.Active, false));
            await db.SaveChangesAsync(); return Results.Ok(p);
        });
        g.MapPost("/push-subscriptions", async (PushInput input, AppDb db, Access access, IConfiguration config) =>
        {
            Rules.Check(!string.IsNullOrWhiteSpace(config["Push:PublicKey"]) && !string.IsNullOrWhiteSpace(config["Push:PrivateKey"]), "Web push is not configured. Email and in-app notifications remain available.", 503);
            Rules.Check(Uri.TryCreate(input.Endpoint, UriKind.Absolute, out var uri) && uri.Scheme == "https" && new[] { "fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com" }.Contains(uri.Host), "This push service is not supported.");
            Rules.Required(input.P256dh, "Subscription key", 256); Rules.Required(input.Auth, "Subscription authentication key", 256);
            var p = await db.PushSubscriptions.SingleOrDefaultAsync(x => x.UserId == access.UserId && x.Endpoint == input.Endpoint);
            if (p is null) { p = new PushSubscription { ClubId = access.ClubId, UserId = access.UserId, Endpoint = input.Endpoint }; db.PushSubscriptions.Add(p); }
            p.P256dh = input.P256dh; p.Auth = input.Auth; p.Active = true; await db.SaveChangesAsync(); return Results.NoContent();
        });
        g.MapPost("/files", async (HttpRequest request, AppDb db, Access access, IConfiguration cfg) =>
        {
            await access.CanWrite(); var form = await request.ReadFormAsync(); var file = form.Files.GetFile("file"); Rules.Check(file is not null && file.Length is > 0 and <= 10485760, "Choose a file between 1 byte and 10 MB.");
            Rules.Check(new[] { "image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain" }.Contains(file!.ContentType), "Supported files: PNG, JPEG, WebP, PDF and plain text.");
            Guid? conversation = Guid.TryParse(form["conversationId"], out var cid) ? cid : null; if (conversation is not null) await access.Conversation(conversation.Value);
            var key = Guid.NewGuid().ToString("N"); var folder = Path.Combine(cfg["App:DataPath"] ?? "data", "files"); Directory.CreateDirectory(folder);
            await using (var target = File.Create(Path.Combine(folder, key))) await file.CopyToAsync(target);
            var stored = new StoredFile { ClubId = access.ClubId, UserId = access.UserId, ConversationId = conversation, Name = Path.GetFileName(file.FileName)[..Math.Min(Path.GetFileName(file.FileName).Length, 160)], StorageKey = key, ContentType = file.ContentType, Length = file.Length }; db.Files.Add(stored); try { await db.SaveChangesAsync(); } catch { File.Delete(Path.Combine(folder, key)); throw; } return Results.Ok(new { stored.Id, stored.Name, stored.Length, stored.ContentType });
        }).DisableAntiforgery(); // Custom global token validation covers multipart requests as well.
        g.MapGet("/files/{id:guid}", async (Guid id, AppDb db, Access access, IConfiguration cfg, HttpResponse response) =>
        {
            var f = await db.Files.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError(404, "File not found.");
            if (f.ConversationId is not null) await access.Conversation(f.ConversationId.Value); else Rules.Check(f.UserId == access.UserId, "File access is not permitted.", 403);
            response.Headers.XContentTypeOptions = "nosniff";
            return Results.File(Path.GetFullPath(Path.Combine(cfg["App:DataPath"] ?? "data", "files", f.StorageKey)), f.ContentType, f.Name);
        });
    }
}
