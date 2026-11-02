using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace Clubline;

public sealed class StripeGateway(IHttpClientFactory clients, IConfiguration config)
{
    public bool Configured => !string.IsNullOrWhiteSpace(config["Billing:SecretKey"]);
    public async Task<JsonElement> Request(string path, Dictionary<string, string> data, string key, string? account = null)
    {
        Rules.Check(Configured, "Online billing is not configured. Contact the club or platform team.", 503);
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.stripe.com/v1/" + path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", config["Billing:SecretKey"]);
        request.Headers.Add("Stripe-Version", "2024-06-20"); request.Headers.Add("Idempotency-Key", Rules.Hash(key));
        if (account is not null) request.Headers.Add("Stripe-Account", account);
        request.Content = new FormUrlEncodedContent(data);
        using var response = await clients.CreateClient("providers").SendAsync(request);
        Rules.Check(response.IsSuccessStatusCode, "The payment provider could not complete this request. Your payment has not been marked successful.", 502);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();
    }
    public async Task<JsonElement> Retrieve(string path, string? account = null)
    {
        Rules.Check(Configured, "Online billing is not configured.", 503); using var request = new HttpRequestMessage(HttpMethod.Get, "https://api.stripe.com/v1/" + path); request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", config["Billing:SecretKey"]); request.Headers.Add("Stripe-Version", "2024-06-20"); if (account is not null) request.Headers.Add("Stripe-Account", account); using var response = await clients.CreateClient("providers").SendAsync(request); Rules.Check(response.IsSuccessStatusCode, "Provider state could not be verified. The event will be retried.", 502); using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync()); return doc.RootElement.Clone();
    }
    public static void VerifySignature(string body, string header, string secret, DateTimeOffset now)
    {
        Rules.Check(!string.IsNullOrWhiteSpace(secret), "Payment webhook is not configured.", 503);
        var parts = header.Split(',').Select(x => x.Split('=', 2)).Where(x => x.Length == 2).ToList();
        var timestamp = parts.FirstOrDefault(x => x[0] == "t")?.ElementAtOrDefault(1);
        Rules.Check(long.TryParse(timestamp, out var ts) && Math.Abs(now.ToUnixTimeSeconds() - ts) <= 300, "Invalid payment webhook timestamp.");
        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(timestamp + "." + body));
        var valid = false;
        foreach (var candidate in parts.Where(x => x[0] == "v1"))
        {
            try { valid |= CryptographicOperations.FixedTimeEquals(expected, Convert.FromHexString(candidate[1])); }
            catch (FormatException) { }
        }
        Rules.Check(valid, "Invalid payment webhook signature.");
    }
}
public static class BillingEndpoints
{
    public static void MapBilling(this RouteGroupBuilder g)
    {
        g.MapGet("/billing", async (AppDb db, Access access, StripeGateway stripe, IConfiguration config) =>
        {
            access.Manage(); return Results.Ok(new { subscription = await db.Subscriptions.AsNoTracking().SingleAsync(), invoices = await db.Invoices.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(50).ToListAsync(), onlineBillingAvailable = stripe.Configured && !string.IsNullOrWhiteSpace(config["Billing:ClubPriceId"]), memberFeesAreSeparate = true });
        });
        g.MapPost("/billing/checkout", async (SubscriptionInput input, AppDb db, Access access, StripeGateway stripe, Jobs jobs, IConfiguration config) =>
        {
            access.Roles("Owner"); Rules.Check(input.Plan is "Community" or "Club", "Choose a supported plan."); Rules.Required(input.OperationKey, "Operation key", 100);
            var price = config[$"Billing:{input.Plan}PriceId"]; Rules.Check(!string.IsNullOrWhiteSpace(price), "This plan is not configured for checkout.", 503);
            Rules.Check(stripe.Configured, "Online subscription checkout is not configured.", 503);
            await using var tx = await db.Database.BeginTransactionAsync();
            var sub = await db.Subscriptions.FromSqlInterpolated($"SELECT * FROM \"Subscriptions\" WHERE \"ClubId\" = {access.ClubId} FOR UPDATE").SingleAsync();
            if (sub.ProviderId is not null) {
                var current = await stripe.Retrieve("subscriptions/" + Uri.EscapeDataString(sub.ProviderId)); var state = current.GetProperty("status").GetString();
                if (state is "canceled" or "incomplete_expired") { sub.ProviderId = null; sub.CheckoutKey = null; sub.CheckoutUrl = null; sub.CheckoutExpiresAt = null; }
                else if (state == "incomplete" && sub.CheckoutUrl is not null && sub.CheckoutExpiresAt > DateTimeOffset.UtcNow) return Results.Ok(new { url = sub.CheckoutUrl, status = "AwaitingProviderConfirmation" });
                else throw new DomainError(409, "Manage or recover the existing subscription through the billing portal or support.");
            }
            if (sub.CheckoutKey is not null && sub.CheckoutExpiresAt > DateTimeOffset.UtcNow) { Rules.Check(sub.CheckoutPlan == input.Plan, "A different plan checkout is already pending. Complete it or wait for its expiry before selecting a different plan.", 409); }
            else { sub.CheckoutKey = "subscription-checkout:" + Guid.NewGuid(); sub.CheckoutPlan = input.Plan; sub.CheckoutExpiresAt = DateTimeOffset.UtcNow.AddHours(23); sub.CheckoutUrl = null; }
            await db.SaveChangesAsync(); await tx.CommitAsync();
            if (sub.CheckoutUrl is not null) return Results.Ok(new { url = sub.CheckoutUrl, status = "AwaitingProviderConfirmation" });
            // Persist the provider key before the external call so a lost response can be retried safely.
            var fields = new Dictionary<string, string>() { ["mode"] = "subscription", ["line_items[0][price]"] = price!, ["line_items[0][quantity]"] = "1", ["success_url"] = $"{jobs.PublicUrl}/app/{access.ClubId}/billing?checkout=returned", ["cancel_url"] = $"{jobs.PublicUrl}/app/{access.ClubId}/billing", ["metadata[clubId]"] = access.ClubId.ToString(), ["metadata[plan]"] = input.Plan, ["subscription_data[metadata][clubId]"] = access.ClubId.ToString(), ["subscription_data[metadata][plan]"] = input.Plan, ["subscription_data[metadata][checkoutKey]"] = sub.CheckoutKey!, ["expires_at"] = sub.CheckoutExpiresAt!.Value.ToUnixTimeSeconds().ToString() };
            if (sub.CustomerId is not null) fields["customer"] = sub.CustomerId;
            var session = await stripe.Request("checkout/sessions", fields, sub.CheckoutKey!);
            sub.CheckoutUrl = session.GetProperty("url").GetString(); access.Audit("Created or recovered subscription checkout"); await db.SaveChangesAsync(); return Results.Ok(new { url = sub.CheckoutUrl, status = "AwaitingProviderConfirmation" });
        });
        g.MapPost("/billing/portal", async (AppDb db, Access access, StripeGateway stripe, Jobs jobs) => { access.Roles("Owner"); var sub = await db.Subscriptions.SingleAsync(); Rules.Check(sub.CustomerId is not null, "No provider billing customer exists for this club.", 409); var result = await stripe.Request("billing_portal/sessions", new() { ["customer"] = sub.CustomerId!, ["return_url"] = $"{jobs.PublicUrl}/app/{access.ClubId}/billing" }, "portal:" + Guid.NewGuid()); return Results.Ok(new { url = result.GetProperty("url").GetString() }); });
        g.MapPost("/billing/merchant-onboarding", async (AppDb db, Access access, StripeGateway stripe, Jobs jobs) => { access.Roles("Owner"); await using var tx = await db.Database.BeginTransactionAsync(); var club = await db.Clubs.FromSqlInterpolated($"SELECT * FROM \"Clubs\" WHERE \"Id\" = {access.ClubId} FOR UPDATE").SingleAsync(); if (club.StripeAccountId is null) { var account = await stripe.Request("accounts", new() { ["type"] = "express", ["country"] = club.Country, ["capabilities[card_payments][requested]"] = "true", ["capabilities[transfers][requested]"] = "true", ["metadata[clubId]"] = club.Id.ToString() }, "merchant:" + club.Id); club.StripeAccountId = account.GetProperty("id").GetString(); await db.SaveChangesAsync(); } await tx.CommitAsync(); var link = await stripe.Request("account_links", new() { ["account"] = club.StripeAccountId!, ["type"] = "account_onboarding", ["refresh_url"] = $"{jobs.PublicUrl}/app/{club.Id}/billing", ["return_url"] = $"{jobs.PublicUrl}/app/{club.Id}/billing" }, "merchant-link:" + Guid.NewGuid()); return Results.Ok(new { url = link.GetProperty("url").GetString() }); });
        g.MapPost("/billing/cancel", async (AppDb db, Access access, StripeGateway stripe) =>
        {
            access.Roles("Owner"); var sub = await db.Subscriptions.SingleAsync();
            if (sub.ProviderId is not null) await stripe.Request("subscriptions/" + Uri.EscapeDataString(sub.ProviderId), new() { ["cancel_at_period_end"] = "true" }, "cancel-subscription:" + sub.ProviderId);
            sub.CancelAtPeriodEnd = true; access.Audit("Scheduled subscription cancellation at period end"); await db.SaveChangesAsync(); return Results.Ok(new { sub.Status, sub.PeriodEnd, sub.CancelAtPeriodEnd });
        });
        g.MapGet("/payments", async (AppDb db, Access access) => { access.Finance(); return Results.Ok(await db.Payments.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(100).ToListAsync()); });
        g.MapGet("/my-payments", async (AppDb db, Access access) => await db.Payments.AsNoTracking().Where(x => x.UserId == access.UserId).OrderByDescending(x => x.CreatedAt).Take(50).ToListAsync());
        g.MapPost("/registrations/{id:guid}/checkout", async (Guid id, AppDb db, Access access, StripeGateway stripe, Jobs jobs) =>
        {
            var r = await db.Registrations.SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError(404, "Registration not found."); Rules.Check(await access.CanActFor(r.MemberId), "This registration does not belong to you or a linked junior.", 403);
            await using var tx = await db.Database.BeginTransactionAsync();
            _ = await db.Activities.FromSqlInterpolated($"SELECT *, xmin FROM \"Activities\" WHERE \"Id\" = {r.ActivityId} AND \"ClubId\" = {access.ClubId} FOR UPDATE").SingleAsync();
            await db.Entry(r).ReloadAsync();
            Rules.Check(r.Status == "PendingPayment" && r.ReservationExpiresAt > DateTimeOffset.UtcNow, "This registration is not awaiting payment or the reservation expired.", 409);
            var club = await db.Clubs.SingleAsync(x => x.Id == access.ClubId); Rules.Check(stripe.Configured && club.ChargesEnabled && club.StripeAccountId is not null, "Online payments are not available for this club. Contact its treasurer about supported offline payments.", 503);
            var key = "registration:" + r.Id + ":" + r.AttemptId; var payment = await db.Payments.SingleOrDefaultAsync(x => x.OperationKey == key);
            if (payment?.CheckoutUrl is not null) return Results.Ok(new { url = payment.CheckoutUrl, payment.Id });
            if (payment is null) { payment = new Payment { ClubId = access.ClubId, RegistrationId = r.Id, RegistrationAttemptId = r.AttemptId, UserId = access.UserId, AmountMinor = r.AmountMinor, Currency = club.Currency, OperationKey = key }; db.Payments.Add(payment); r.ReservationExpiresAt = payment.CreatedAt.AddHours(1); await db.SaveChangesAsync(); }
            var checkoutExpiresAt = payment.CreatedAt.AddHours(1);
            Rules.Check(checkoutExpiresAt > DateTimeOffset.UtcNow.AddMinutes(31), "The checkout recovery window expired. Cancel this reservation and register again.", 409);
            await tx.CommitAsync();
            var a = await db.Activities.SingleAsync(x => x.Id == r.ActivityId);
            var session = await stripe.Request("checkout/sessions", new() { ["mode"] = "payment", ["payment_method_types[0]"] = "card", ["line_items[0][price_data][currency]"] = club.Currency.ToLowerInvariant(), ["line_items[0][price_data][unit_amount]"] = StripeAmounts.ToProvider(payment.AmountMinor, payment.Currency).ToString(System.Globalization.CultureInfo.InvariantCulture), ["line_items[0][price_data][product_data][name]"] = a.Title, ["line_items[0][quantity]"] = "1", ["metadata[paymentId]"] = payment.Id.ToString(), ["metadata[clubId]"] = access.ClubId.ToString(), ["success_url"] = $"{jobs.PublicUrl}/app/{access.ClubId}/activities/{a.Id}?payment=returned", ["cancel_url"] = $"{jobs.PublicUrl}/app/{access.ClubId}/activities/{a.Id}", ["expires_at"] = checkoutExpiresAt.ToUnixTimeSeconds().ToString() }, key, club.StripeAccountId);
            payment.ProviderId = session.GetProperty("id").GetString(); payment.CheckoutUrl = session.GetProperty("url").GetString(); await db.SaveChangesAsync(); return Results.Ok(new { url = payment.CheckoutUrl, payment.Id });
        });
        g.MapPost("/payments/offline", async (OfflinePayment input, AppDb db, Access access) =>
        {
            access.Finance(); Rules.Required(input.OperationKey, "Operation key", 100); var reference = Rules.Required(input.Reference, "Verified payment reference", 160);
            await using var tx = await db.Database.BeginTransactionAsync();
            var r = await db.Registrations.FromSqlInterpolated($"SELECT * FROM \"Registrations\" WHERE \"Id\" = {input.RegistrationId} AND \"ClubId\" = {access.ClubId} FOR UPDATE").SingleOrDefaultAsync() ?? throw new DomainError(404, "Registration not found.");
            var existing = await db.Payments.SingleOrDefaultAsync(p => p.OperationKey == input.OperationKey + ":" + r.AttemptId); if (existing is not null) { Rules.Check(existing.RegistrationId == r.Id && existing.RegistrationAttemptId == r.AttemptId && existing.Reference == reference, "The operation key is already in use.", 409); return Results.Ok(existing); }
            Rules.Check(r.Status == "PendingPayment" && r.ReservationExpiresAt > DateTimeOffset.UtcNow, "The registration reservation must still be valid.", 409);
            Rules.Check(!await db.Payments.AnyAsync(p => p.RegistrationId == r.Id && p.RegistrationAttemptId == r.AttemptId), "Resolve the existing online payment attempt before recording an offline payment.", 409);
            var club = await db.Clubs.SingleAsync(c => c.Id == access.ClubId);
            var p = new Payment { ClubId = access.ClubId, RegistrationId = r.Id, RegistrationAttemptId = r.AttemptId, UserId = r.BookedBy, AmountMinor = r.AmountMinor, Currency = club.Currency, Purpose = "ActivityOffline", Status = "Paid", OperationKey = input.OperationKey + ":" + r.AttemptId, Reference = reference }; db.Payments.Add(p); r.Status = "Confirmed"; r.ReservationExpiresAt = null; access.Audit("Verified and recorded offline payment", p.Id); await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(p);
        });
        g.MapPost("/payments/{id:guid}/refund", async (Guid id, RefundInput input, AppDb db, Access access, Jobs jobs) =>
        {
            access.Finance(); Rules.Required(input.Reason, "Refund reason", 1000); Rules.Required(input.OperationKey, "Operation key", 100);
            await using var tx = await db.Database.BeginTransactionAsync();
            var p = await db.Payments.FromSqlInterpolated($"SELECT * FROM \"Payments\" WHERE \"Id\" = {id} AND \"ClubId\" = {access.ClubId} FOR UPDATE").SingleOrDefaultAsync() ?? throw new DomainError(404, "Payment not found.");
            var old = await db.Refunds.SingleOrDefaultAsync(x => x.OperationKey == input.OperationKey); if (old is not null) { Rules.Check(old.PaymentId == id && old.AmountMinor == input.AmountMinor, "This operation key was already used.", 409); return Results.Ok(old); }
            var reserved = await db.Refunds.Where(x => x.PaymentId == id && x.Status != "Failed").SumAsync(x => x.AmountMinor);
            Rules.Check(p.Status is "Paid" or "PaidNeedsReview" && input.AmountMinor > 0 && input.AmountMinor <= p.AmountMinor - reserved, "The refund exceeds the remaining refundable amount.", 409);
            var refund = new Refund { ClubId = access.ClubId, PaymentId = id, AmountMinor = input.AmountMinor, Reason = input.Reason, OperationKey = input.OperationKey, Status = p.IntentId is null ? "PendingManual" : "Pending" }; db.Refunds.Add(refund);
            if (p.IntentId is not null) jobs.Enqueue("Refund", new { RefundId = refund.Id }, "refund:" + refund.Id, access.ClubId);
            access.Audit("Requested refund: " + refund.Status, refund.Id); await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(refund);
        });
        g.MapPost("/refunds/{id:guid}/confirm-offline", async (Guid id, ReportInput input, AppDb db, Access access) =>
        {
            access.Finance(); Rules.Required(input.Reason, "Verified offline refund reference", 160); await using var tx = await db.Database.BeginTransactionAsync();
            var refund = await db.Refunds.SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError(404, "Refund not found."); Rules.Check(refund.Status is "PendingManual" or "Confirmed", "Only offline refunds can be manually confirmed.");
            var p = await db.Payments.FromSqlInterpolated($"SELECT * FROM \"Payments\" WHERE \"Id\" = {refund.PaymentId} AND \"ClubId\" = {access.ClubId} FOR UPDATE").SingleAsync(); refund.Status = "Confirmed"; await db.SaveChangesAsync(); p.RefundedMinor = await db.Refunds.Where(x => x.PaymentId == p.Id && x.Status == "Confirmed").SumAsync(x => x.AmountMinor); access.Audit("Verified offline refund reference: " + input.Reason, id); await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(refund);
        });
        g.MapGet("/refunds", async (AppDb db, Access access) => { access.Finance(); return Results.Ok(await db.Refunds.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(100).ToListAsync()); });
    }
    public static void MapWebhooks(this WebApplication app)
    {
        app.MapPost("/api/webhooks/stripe", async (HttpRequest request, AppDb db, TenantContext tenant, IConfiguration cfg, StripeGateway stripe) =>
        {
            using var reader = new StreamReader(request.Body); var body = await reader.ReadToEndAsync(); Rules.Check(body.Length <= 1048576, "Webhook body is too large.", 413);
            var secrets = new[] { cfg["Billing:WebhookSecret"], cfg["Billing:ConnectWebhookSecret"] }.Where(x => !string.IsNullOrWhiteSpace(x)).ToList(); Rules.Check(secrets.Count > 0, "Payment webhook is not configured.", 503);
            var verified = false; foreach (var secret in secrets) { try { StripeGateway.VerifySignature(body, request.Headers["Stripe-Signature"].ToString(), secret!, DateTimeOffset.UtcNow); verified = true; break; } catch (DomainError) { } } Rules.Check(verified, "Invalid payment webhook signature or timestamp.");
            using var doc = JsonDocument.Parse(body); var root = doc.RootElement; Rules.Check(root.TryGetProperty("livemode", out var live) && live.GetBoolean() == cfg.GetValue<bool>("Billing:LiveMode"), "Webhook environment does not match billing configuration."); var providerId = root.GetProperty("id").GetString()!; var kind = root.GetProperty("type").GetString()!;
            await using var tx = await db.Database.BeginTransactionAsync();
            // Lock by provider event hash before the unique insert; duplicate deliveries share this lock.
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({providerId}, 0))");
            if (await db.ProviderEvents.AnyAsync(x => x.ProviderId == providerId)) return Results.Ok(new { duplicate = true });
            var obj = root.GetProperty("data").GetProperty("object");
            if (kind == "checkout.session.completed" && obj.TryGetProperty("metadata", out var meta) && meta.TryGetProperty("paymentId", out var paymentField) && Guid.TryParse(paymentField.GetString(), out var paymentId))
            {
                var payment = await db.Payments.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.Id == paymentId);
                Rules.Check(payment is not null, "Payment reference not found."); tenant.ClubId = payment!.ClubId;
                var club = await db.Clubs.SingleAsync(x => x.Id == payment.ClubId);
                var account = root.TryGetProperty("account", out var acc) ? acc.GetString() : null;
                Rules.Check(account == club.StripeAccountId && account is not null && meta.GetProperty("clubId").GetString() == payment.ClubId.ToString() && obj.GetProperty("id").GetString() == payment.ProviderId && obj.GetProperty("amount_total").GetInt64() == StripeAmounts.ToProvider(payment.AmountMinor, payment.Currency) && string.Equals(obj.GetProperty("currency").GetString(), payment.Currency, StringComparison.OrdinalIgnoreCase), "Payment account, amount or currency does not match.");
                if (obj.GetProperty("payment_status").GetString() == "paid")
                {
                    if (payment.RegistrationId is null) { Rules.Check(payment.Purpose == "MembershipFee" || payment.Purpose == "MembershipOffline", "Unsupported payment purpose."); payment.Status = "Paid"; payment.IntentId = obj.TryGetProperty("payment_intent", out var feeIntent) ? feeIntent.GetString() : null; await FeeEndpoints.Renew(payment, db); }
                    else {
                    var r = await db.Registrations.SingleAsync(x => x.Id == payment.RegistrationId);
                    _ = await db.Activities.FromSqlInterpolated($"SELECT *, xmin FROM \"Activities\" WHERE \"Id\" = {r.ActivityId} AND \"ClubId\" = {tenant.ClubId} FOR UPDATE").SingleAsync();
                    await db.Entry(r).ReloadAsync();
                    payment.Status = "Paid"; payment.IntentId = obj.TryGetProperty("payment_intent", out var pi) ? pi.GetString() : null;
                    if (payment.RegistrationAttemptId == r.AttemptId && r.Status == "PendingPayment" && r.ReservationExpiresAt > DateTimeOffset.UtcNow) { r.Status = "Confirmed"; r.ReservationExpiresAt = null; }
                    else if (payment.RegistrationAttemptId != r.AttemptId || r.Status != "Confirmed") payment.Status = "PaidNeedsReview"; // Expired/cancelled seats never become silently overbooked.
                    }
                }
            }
            else if (kind is "customer.subscription.created" or "customer.subscription.updated" or "customer.subscription.deleted" && !root.TryGetProperty("account", out _) && obj.TryGetProperty("metadata", out var sm) && sm.TryGetProperty("clubId", out var sc) && Guid.TryParse(sc.GetString(), out var cid))
            {
                tenant.ClubId = cid; var sub = await db.Subscriptions.FromSqlInterpolated($"SELECT * FROM \"Subscriptions\" WHERE \"ClubId\" = {cid} FOR UPDATE").SingleOrDefaultAsync();
                if (sub is not null && (obj.GetProperty("id").GetString() == sub.ProviderId || (sub.CheckoutKey is not null && sm.TryGetProperty("checkoutKey", out var intent) && intent.GetString() == sub.CheckoutKey)))
                {
                    // Fetch current state while holding the club subscription lock. Webhooks can arrive out of order.
                    obj = await stripe.Retrieve("subscriptions/" + Uri.EscapeDataString(obj.GetProperty("id").GetString()!)); sm = obj.GetProperty("metadata");
                    Rules.Check(sm.GetProperty("clubId").GetString() == cid.ToString(), "Subscription club metadata mismatch.");
                    sub.ProviderUpdatedAt = Math.Max(sub.ProviderUpdatedAt, root.GetProperty("created").GetInt64());
                    var status = obj.GetProperty("status").GetString(); sub.ProviderId = obj.GetProperty("id").GetString(); sub.CustomerId = obj.GetProperty("customer").GetString();
                    sub.Status = status == "active" ? "Active" : status == "trialing" ? "Trialing" : "Inactive";
                    sub.Plan = sm.TryGetProperty("plan", out var plan) && plan.GetString() == "Community" ? "Community" : "Club"; sub.MemberLimit = sub.Plan == "Community" ? 100 : 500;
                    if (obj.TryGetProperty("current_period_end", out var end)) sub.PeriodEnd = DateTimeOffset.FromUnixTimeSeconds(end.GetInt64());
                    sub.CancelAtPeriodEnd = obj.TryGetProperty("cancel_at_period_end", out var cancel) && cancel.GetBoolean();
                }
            }
            else if (kind == "refund.updated" && obj.TryGetProperty("metadata", out var rm) && rm.TryGetProperty("refundId", out var rf) && Guid.TryParse(rf.GetString(), out var refundId))
            {
                var refund = await db.Refunds.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.Id == refundId); Rules.Check(refund is not null, "Refund not found."); tenant.ClubId = refund!.ClubId;
                var payment = await db.Payments.FromSqlInterpolated($"SELECT * FROM \"Payments\" WHERE \"Id\" = {refund.PaymentId} AND \"ClubId\" = {tenant.ClubId} FOR UPDATE").SingleAsync();
                await db.Entry(refund).ReloadAsync();
                var club = await db.Clubs.SingleAsync(x => x.Id == tenant.ClubId);
                Rules.Check(root.TryGetProperty("account", out var account) && account.GetString() == club.StripeAccountId && obj.GetProperty("amount").GetInt64() == StripeAmounts.ToProvider(refund.AmountMinor, payment.Currency) && obj.GetProperty("payment_intent").GetString() == payment.IntentId, "Refund account or amount does not match.");
                if (refund.Status != "Confirmed" || obj.GetProperty("status").GetString() == "succeeded") refund.Status = obj.GetProperty("status").GetString() == "succeeded" ? "Confirmed" : obj.GetProperty("status").GetString() is "failed" or "canceled" ? "Failed" : "Pending";
                await db.SaveChangesAsync(); payment.RefundedMinor = await db.Refunds.Where(x => x.PaymentId == payment.Id && x.Status == "Confirmed").SumAsync(x => x.AmountMinor);
            }
            else if (kind == "invoice.paid" && !root.TryGetProperty("account", out _))
            {
                var customer = obj.GetProperty("customer").GetString(); var sub = await db.Subscriptions.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.CustomerId == customer);
                if (sub is null && obj.TryGetProperty("subscription", out var invoiceSubscription) && invoiceSubscription.ValueKind == JsonValueKind.String) {
                    var current = await stripe.Retrieve("subscriptions/" + Uri.EscapeDataString(invoiceSubscription.GetString()!));
                    if (current.TryGetProperty("metadata", out var invoiceMeta) && invoiceMeta.TryGetProperty("clubId", out var invoiceClub) && Guid.TryParse(invoiceClub.GetString(), out var invoiceClubId)) {
                        sub = await db.Subscriptions.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.ClubId == invoiceClubId); if (sub is not null) { Rules.Check(current.GetProperty("customer").GetString() == customer, "Invoice customer mismatch."); sub.CustomerId = customer; }
                    }
                }
                if (sub is not null && !await db.Invoices.IgnoreQueryFilters().AnyAsync(x => x.ProviderId == obj.GetProperty("id").GetString())) db.Invoices.Add(new Invoice { ClubId = sub.ClubId, ProviderId = obj.GetProperty("id").GetString()!, AmountMinor = StripeAmounts.FromProvider(obj.GetProperty("amount_paid").GetInt64(), obj.GetProperty("currency").GetString()!), Currency = obj.GetProperty("currency").GetString()!.ToUpperInvariant(), Status = "Paid", HostedUrl = obj.TryGetProperty("hosted_invoice_url", out var url) ? url.GetString() : null });
            }
            if (kind == "account.updated") { var accountId = obj.GetProperty("id").GetString(); var club = await db.Clubs.SingleOrDefaultAsync(x => x.StripeAccountId == accountId); if (club is not null) club.ChargesEnabled = obj.GetProperty("charges_enabled").GetBoolean() && obj.GetProperty("details_submitted").GetBoolean(); }
            db.ProviderEvents.Add(new ProviderEvent { ProviderId = providerId, Kind = kind }); await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(new { received = true });
        }).WithTags("Verified provider events");
    }
}
