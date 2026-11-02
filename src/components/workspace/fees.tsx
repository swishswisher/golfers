"use client";
import { useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Club, Member, Payment } from "@/lib/contracts";
import { money } from "@/lib/contracts";
import { post } from "@/lib/api";
import { useTask } from "@/lib/use-task";
import {
  Button,
  Card,
  CheckField,
  Field,
  Notice,
  Select,
  TextArea,
} from "@/components/ui";
export function FeeManagement({
  club,
  members,
  payments,
}: {
  club: Club;
  members: Member[];
  payments: Payment[];
}) {
  const task = useTask(),
    router = useRouter(),
    operation = useRef<string | null>(null);
  async function assign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget,
      d = Object.fromEntries(new FormData(f));
    await task.run(async () => {
      operation.current ??= crypto.randomUUID();
      const digits =
        new Intl.NumberFormat("en", {
          style: "currency",
          currency: club.currency,
        }).resolvedOptions().maximumFractionDigits ?? 2;
      await post(`/api/clubs/${club.id}/fees`, {
        memberId: d.memberId,
        description: d.description,
        amountMinor: Math.round(Number(d.amount) * 10 ** digits),
        renewalUntil: d.renewal
          ? new Date(String(d.renewal) + "T23:59:59Z").toISOString()
          : null,
        operationKey: operation.current,
      });
      operation.current = null;
      f.reset();
      router.refresh();
    }, "Membership fee assigned to the member or verified guardian account.");
  }
  return (
    <div className="grid two mt">
      {task.error && <Notice kind="error">{task.error}</Notice>}
      {task.success && <Notice>{task.success}</Notice>}
      <Card title="Assign a membership or renewal fee">
        <form method="post" onSubmit={assign}>
          <Select label="Member for this fee" name="memberId" required>
            <option value="">Choose a member</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.junior ? " · guardian billed" : ""}
              </option>
            ))}
          </Select>
          <div className="formgrid">
            <Field
              label={"Fee amount in " + club.currency}
              name="amount"
              type="number"
              min="1"
              step="any"
              required
            />
            <Field
              label="Renew membership until (optional, UTC)"
              name="renewal"
              type="date"
            />
          </div>
          <TextArea
            label="Fee description and terms"
            name="description"
            required
            maxLength={500}
          />
          <p className="small mt">
            The expiry updates after a verified payment. This creates a fee
            request; it does not charge the member.
          </p>
          <Button className="mt" disabled={task.busy}>
            Assign membership fee
          </Button>
        </form>
      </Card>
      <Card title="Verify an offline membership payment">
        <form
          method="post"
          onSubmit={(e) => {
            e.preventDefault();
            const f = e.currentTarget,
              d = Object.fromEntries(new FormData(f));
            void task.run(async () => {
              await post(
                `/api/clubs/${club.id}/payments/${d.paymentId}/verify-offline`,
                { reason: d.reference },
              );
              f.reset();
              router.refresh();
            }, "Verified membership payment recorded.");
          }}
        >
          <Select label="Pending membership fee" name="paymentId" required>
            <option value="">Choose a fee</option>
            {payments
              .filter(
                (p) => p.status === "Pending" && p.purpose === "MembershipFee",
              )
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.description} · {money(p.amountMinor, p.currency)}
                </option>
              ))}
          </Select>
          <Field
            label="Independently verified transfer reference"
            name="reference"
            required
          />
          <CheckField
            label="I have verified the money reached the club."
            required
          />
          <Button className="mt" disabled={task.busy}>
            Record verified membership payment
          </Button>
        </form>
      </Card>
    </div>
  );
}
