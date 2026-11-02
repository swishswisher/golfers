using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using WebPush;

namespace Clubline;

public record MailPayload(string To, string Subject, string Body, string? UserId = null);
public record PushPayload(Guid SubscriptionId, string Title, string Body, string Link, string NotificationId);
public sealed class Jobs(AppDb db, TenantContext tenant, IDataProtectionProvider protection, IConfiguration config)
{
    public string PublicUrl => (config["App:PublicUrl"] ?? "http://localhost:3000").TrimEnd('/');
    public IDataProtector Protector => protection.CreateProtector("Clubline.Outbox.v1");
    public void Email(string to, string subject, string body, string key, Guid? clubId = null, string? userId = null) => Enqueue("Email", new MailPayload(to, subject, body, userId), key, clubId);
    public void Enqueue(string kind, object payload, string key, Guid? clubId) => db.Outbox.Add(new Outbox { ClubId = clubId, Kind = kind, OperationKey = key, ProtectedPayload = Protector.Protect(JsonSerializer.Serialize(payload)) });
    public async Task Notify(string userId, string title, string body, string link, string key)
    {
        if (db.Notifications.Local.Any(n => n.ClubId == tenant.ClubId && n.UserId == userId && n.OperationKey == key) || await db.Notifications.AnyAsync(n => n.UserId == userId && n.OperationKey == key)) return;
        var n = new Notification { ClubId = tenant.ClubId, UserId = userId, Title = title, Body = body, Link = link, OperationKey = key }; db.Notifications.Add(n);
        var preference = await db.Preferences.AsNoTracking().SingleOrDefaultAsync(p => p.UserId == userId);
        var user = await db.Users.AsNoTracking().SingleAsync(x => x.Id == userId);
        if (preference?.Email != false && user.EmailConfirmed) Email(user.Email!, title, body + "\n\n" + PublicUrl + link, "email:" + key, tenant.ClubId, userId);
        if (preference?.Push == true)
        {
            var subscriptions = await db.PushSubscriptions.Where(p => p.UserId == userId && p.Active).ToListAsync();
            foreach (var sub in subscriptions) Enqueue("Push", new PushPayload(sub.Id, title, body, link, n.Id.ToString()), "push:" + key + ":" + sub.Id, tenant.ClubId);
        }
    }
}
public sealed class JobWorker(IServiceScopeFactory scopes, IHttpClientFactory clients, IConfiguration config, IWebHostEnvironment env, ILogger<JobWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { for (var batch = 0; batch < 20; batch++) if (!await Dispatch(stoppingToken)) break; await ExpireReservations(stoppingToken); using var automationScope = scopes.CreateScope(); await automationScope.ServiceProvider.GetRequiredService<AutomationService>().Run(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Background processing failed; retained jobs will be retried"); }
            await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
        }
    }
    public async Task<bool> Dispatch(CancellationToken cancellationToken)
    {
        using var scope = scopes.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDb>(); var jobs = scope.ServiceProvider.GetRequiredService<Jobs>();
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var job = await db.Outbox.FromSqlInterpolated($"SELECT * FROM \"Outbox\" WHERE ((\"Status\" = 'Queued' AND \"AvailableAt\" <= {now}) OR (\"Status\" = 'Processing' AND \"LeaseUntil\" < {now})) AND \"Attempts\" < 8 ORDER BY \"CreatedAt\" LIMIT 1 FOR UPDATE SKIP LOCKED").FirstOrDefaultAsync(cancellationToken);
        if (job is null) return false;
        job.Status = "Processing"; job.Attempts++; job.LeaseUntil = now.AddMinutes(3); await db.SaveChangesAsync(cancellationToken); await tx.CommitAsync(cancellationToken);
        try
        {
            var payload = jobs.Protector.Unprotect(job.ProtectedPayload);
            if (job.Kind == "Email")
            {
                var mail = JsonSerializer.Deserialize<MailPayload>(payload)!;
                var optedOut = mail.UserId is not null && (!await db.Memberships.IgnoreQueryFilters().AnyAsync(x => x.ClubId == job.ClubId && x.UserId == mail.UserId && x.Active, cancellationToken) || await db.Preferences.IgnoreQueryFilters().AnyAsync(x => x.ClubId == job.ClubId && x.UserId == mail.UserId && !x.Email, cancellationToken) || await db.Clubs.AnyAsync(x => x.Id == job.ClubId && x.Suspended, cancellationToken));
                if (optedOut) job.Status = "Skipped";
                else if (env.IsDevelopment() && config.GetValue<bool>("App:DevelopmentInbox"))
                {
                    db.DevelopmentMail.Add(new DevelopmentMail { Recipient = mail.To, Subject = mail.Subject, Body = mail.Body }); job.Status = "DevelopmentInbox";
                }
                else
                {
                    var key = config["Email:ApiKey"]; var sender = config["Email:From"];
                    if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(sender)) throw new ProviderNotConfigured("Email provider configuration is missing.");
                    using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails"); request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key); request.Headers.Add("Idempotency-Key", Rules.Hash(job.OperationKey));
                    request.Content = JsonContent.Create(new { from = sender, to = new[] { mail.To }, subject = mail.Subject, text = mail.Body });
                    using var response = await clients.CreateClient("providers").SendAsync(request, cancellationToken); response.EnsureSuccessStatusCode(); job.Status = "Accepted";
                }
            }
            else if (job.Kind == "Push")
            {
                var p = JsonSerializer.Deserialize<PushPayload>(payload)!;
                var sub = await db.PushSubscriptions.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.Id == p.SubscriptionId && x.ClubId == job.ClubId && x.Active, cancellationToken);
                if (sub is null || !await db.Preferences.IgnoreQueryFilters().AnyAsync(x => x.ClubId == job.ClubId && x.UserId == sub.UserId && x.Push, cancellationToken) || !await db.Memberships.IgnoreQueryFilters().AnyAsync(x => x.ClubId == job.ClubId && x.UserId == sub.UserId && x.Active, cancellationToken)) job.Status = "Skipped";
                else
                {
                    if (string.IsNullOrWhiteSpace(config["Push:PrivateKey"])) throw new ProviderNotConfigured("Web push configuration is missing.");
                    using var client = new WebPushClient();
                    var subscription = new WebPush.PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth);
                    var vapid = new VapidDetails(config["Push:Subject"] ?? "mailto:support@example.invalid", config["Push:PublicKey"], config["Push:PrivateKey"]);
                    await client.SendNotificationAsync(subscription, JsonSerializer.Serialize(new { title = p.Title, body = p.Body, url = p.Link, id = p.NotificationId }), vapid, cancellationToken); job.Status = "Accepted";
                }
            }
            else if (job.Kind == "Refund")
            {
                var id = JsonDocument.Parse(payload).RootElement.GetProperty("RefundId").GetGuid();
                var refund = await db.Refunds.IgnoreQueryFilters().SingleAsync(x => x.Id == id && x.ClubId == job.ClubId, cancellationToken);
                var payment = await db.Payments.IgnoreQueryFilters().SingleAsync(x => x.Id == refund.PaymentId && x.ClubId == job.ClubId, cancellationToken);
                var club = await db.Clubs.SingleAsync(x => x.Id == job.ClubId, cancellationToken);
                if (refund.Status == "Confirmed") job.Status = "Accepted";
                else { var stripe = scope.ServiceProvider.GetRequiredService<StripeGateway>(); if (!stripe.Configured) throw new ProviderNotConfigured("Payment provider configuration is missing."); var result = await stripe.Request("refunds", new() { ["payment_intent"] = payment.IntentId!, ["amount"] = StripeAmounts.ToProvider(refund.AmountMinor, payment.Currency).ToString(System.Globalization.CultureInfo.InvariantCulture), ["metadata[refundId]"] = refund.Id.ToString(), ["metadata[clubId]"] = club.Id.ToString() }, "refund:" + refund.Id, club.StripeAccountId); var providerId = result.GetProperty("id").GetString(); await db.Refunds.IgnoreQueryFilters().Where(x => x.Id == refund.Id && x.ClubId == job.ClubId).ExecuteUpdateAsync(s => s.SetProperty(x => x.ProviderId, providerId).SetProperty(x => x.Status, x => x.Status == "Confirmed" ? "Confirmed" : "Accepted"), cancellationToken); db.Entry(refund).State = EntityState.Detached; job.Status = "Accepted"; }
            }
            else throw new InvalidOperationException("Unknown outbox operation.");
            job.LastError = null;
        }
        catch (ProviderNotConfigured ex) { job.Status = "Blocked"; job.LastError = ex.Message; }
        catch (WebPushException ex) when ((int)ex.StatusCode is 404 or 410)
        {
            job.Status = "ExpiredSubscription"; job.LastError = "The browser subscription expired.";
            var p = JsonSerializer.Deserialize<PushPayload>(jobs.Protector.Unprotect(job.ProtectedPayload))!;
            await db.PushSubscriptions.IgnoreQueryFilters().Where(x => x.Id == p.SubscriptionId && x.ClubId == job.ClubId).ExecuteUpdateAsync(s => s.SetProperty(x => x.Active, false), cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            job.Status = job.Attempts >= 8 ? "Failed" : "Queued"; job.AvailableAt = DateTimeOffset.UtcNow.AddSeconds(Math.Min(3600, Math.Pow(2, job.Attempts) * 5)); job.LastError = "Provider request failed; inspect correlation logs.";
            logger.LogWarning("Outbox {JobId} attempt {Attempt} failed ({ErrorType})", job.Id, job.Attempts, ex.GetType().Name);
        }
        job.LeaseUntil = null; await db.SaveChangesAsync(cancellationToken); return true;
    }
    private async Task ExpireReservations(CancellationToken ct)
    {
        using var lookup = scopes.CreateScope(); var lookupDb = lookup.ServiceProvider.GetRequiredService<AppDb>(); var now = DateTimeOffset.UtcNow;
        var items = await lookupDb.Registrations.IgnoreQueryFilters().Where(x => x.Status == "PendingPayment" && x.ReservationExpiresAt < now).Select(x => new { x.ClubId, x.ActivityId }).Distinct().Take(20).ToListAsync(ct);
        foreach (var item in items)
        {
            using var scope = scopes.CreateScope(); scope.ServiceProvider.GetRequiredService<TenantContext>().ClubId = item.ClubId;
            var db = scope.ServiceProvider.GetRequiredService<AppDb>(); var service = scope.ServiceProvider.GetRequiredService<ActivityService>();
            await using var tx = await db.Database.BeginTransactionAsync(ct); var a = await service.Locked(item.ActivityId);
            await db.Registrations.Where(x => x.ActivityId == a.Id && x.Status == "PendingPayment" && x.ReservationExpiresAt < now).ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "Expired"), ct);
            if (a.StartsAt > now && a.Status == "Published") await service.Promote(a);
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        }
    }
}
public sealed class ProviderNotConfigured(string message) : Exception(message);
