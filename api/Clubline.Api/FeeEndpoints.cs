using Microsoft.EntityFrameworkCore;
namespace Clubline;
public record FeeInput(Guid MemberId, long AmountMinor, string Description, DateTimeOffset? RenewalUntil, string OperationKey);
public static class FeeEndpoints
{
    public static void MapFees(this RouteGroupBuilder g)
    {
        g.MapPost("/fees", async (FeeInput input, AppDb db, Access access, Jobs jobs) => {
            access.Finance(); await access.CanWrite(); Rules.Required(input.OperationKey, "Operation key", 100); Rules.Check(input.AmountMinor is > 0 and <= 1000000000, "Choose a valid fee amount."); var description = Rules.Required(input.Description, "Fee description", 500);
            var old = await db.Payments.SingleOrDefaultAsync(x => x.OperationKey == "fee:" + input.OperationKey); if (old is not null) { Rules.Check(old.MemberId == input.MemberId && old.AmountMinor == input.AmountMinor && old.Description == description, "This operation key is already in use.", 409); return Results.Ok(old); }
            var m = await db.Members.SingleOrDefaultAsync(x => x.Id == input.MemberId && x.Status == "Active") ?? throw new DomainError(404, "Active member not found.");
            var payer = !m.Junior ? m.UserId : await db.Guardians.Where(x => x.JuniorMemberId == m.Id && db.Memberships.Any(active => active.UserId == x.GuardianUserId && active.Active)).OrderBy(x => x.CreatedAt).Select(x => x.GuardianUserId).FirstOrDefaultAsync();
            Rules.Check(payer is not null && await db.Memberships.AnyAsync(x => x.UserId == payer && x.Active), "An active adult account or verified guardian is required before assigning a fee.");
            Rules.Check(input.RenewalUntil is null || input.RenewalUntil > DateTimeOffset.UtcNow, "Choose a future membership expiry.");
            var club = await db.Clubs.SingleAsync(x => x.Id == access.ClubId); var payment = new Payment { ClubId = club.Id, MemberId = m.Id, UserId = payer!, AmountMinor = input.AmountMinor, Currency = club.Currency, Purpose = "MembershipFee", Description = description, RenewalUntil = input.RenewalUntil?.ToUniversalTime(), OperationKey = "fee:" + input.OperationKey };
            db.Payments.Add(payment); await jobs.Notify(payer!, "A club fee is ready to review", description, $"/app/{club.Id}/membership", "fee:" + payment.Id + ":" + payer); access.Audit("Assigned membership fee", payment.Id); await db.SaveChangesAsync(); return Results.Ok(payment);
        });
        g.MapPost("/payments/{id:guid}/verify-offline", async (Guid id, ReportInput input, AppDb db, Access access) => {
            access.Finance(); var reference = Rules.Required(input.Reason, "Verified payment reference", 160); await using var tx = await db.Database.BeginTransactionAsync();
            var p = await db.Payments.FromSqlInterpolated($"SELECT * FROM \"Payments\" WHERE \"Id\" = {id} AND \"ClubId\" = {access.ClubId} FOR UPDATE").SingleOrDefaultAsync() ?? throw new DomainError(404, "Fee not found.");
            if (p.Status == "Paid") { Rules.Check(p.Reference == reference, "This fee already has a different verified reference.", 409); return Results.Ok(p); }
            Rules.Check(p.Purpose == "MembershipFee" && p.ProviderId is null && p.IntentId is null && p.Status == "Pending", "Resolve existing provider attempts before recording an offline fee payment.", 409);
            p.Status = "Paid"; p.Purpose = "MembershipOffline"; p.Reference = reference; await Renew(p, db); access.Audit("Verified membership fee payment", p.Id); await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(p);
        });
        g.MapPost("/payments/{id:guid}/checkout", async (Guid id, AppDb db, Access access, StripeGateway stripe, Jobs jobs) => {
            await using var tx = await db.Database.BeginTransactionAsync();
            var p = await db.Payments.FromSqlInterpolated($"SELECT * FROM \"Payments\" WHERE \"Id\" = {id} AND \"ClubId\" = {access.ClubId} AND \"UserId\" = {access.UserId} FOR UPDATE").SingleOrDefaultAsync() ?? throw new DomainError(404, "Fee not found."); Rules.Check(p.Purpose == "MembershipFee" && p.Status == "Pending", "This fee is not awaiting payment.", 409);
            var club = await db.Clubs.SingleAsync(x => x.Id == access.ClubId); Rules.Check(club.ChargesEnabled && club.StripeAccountId is not null, "Online club payments are unavailable. Contact the club about verified offline payments.", 503);
            if (p.CheckoutUrl is not null && p.ProviderId is not null) {
                var current = await stripe.Retrieve("checkout/sessions/" + Uri.EscapeDataString(p.ProviderId), club.StripeAccountId);
                var state = current.GetProperty("status").GetString();
                if (state == "open") return Results.Ok(new { url = p.CheckoutUrl });
                Rules.Check(state == "expired", "Payment confirmation is pending. Refresh your payment history before trying again.", 409);
            }
            var session = await stripe.Request("checkout/sessions", new() { ["mode"] = "payment", ["payment_method_types[0]"] = "card", ["line_items[0][price_data][currency]"] = p.Currency.ToLowerInvariant(), ["line_items[0][price_data][unit_amount]"] = StripeAmounts.ToProvider(p.AmountMinor, p.Currency).ToString(System.Globalization.CultureInfo.InvariantCulture), ["line_items[0][price_data][product_data][name]"] = p.Description, ["line_items[0][quantity]"] = "1", ["metadata[paymentId]"] = p.Id.ToString(), ["metadata[clubId]"] = club.Id.ToString(), ["success_url"] = $"{jobs.PublicUrl}/app/{club.Id}/membership?payment=returned", ["cancel_url"] = $"{jobs.PublicUrl}/app/{club.Id}/membership" }, "membership-checkout:" + p.Id + ":" + (p.ProviderId ?? "initial"), club.StripeAccountId);
            p.ProviderId = session.GetProperty("id").GetString(); p.CheckoutUrl = session.GetProperty("url").GetString(); await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(new { url = p.CheckoutUrl });
        });
    }
    public static async Task Renew(Payment p, AppDb db) { if (p.MemberId is not null && p.RenewalUntil is not null) { var member = await db.Members.SingleAsync(x => x.Id == p.MemberId); if (member.RenewalAt is null || member.RenewalAt < p.RenewalUntil) member.RenewalAt = p.RenewalUntil; } }
}
