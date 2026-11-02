"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, post, put } from "@/lib/api";
import { useTask } from "@/lib/use-task";
import type {
  Activity,
  Billing,
  Booking,
  Club,
  ClubContent,
  Delivery,
  Member,
  ModerationReport,
  Notification,
  Overview,
  Payment,
  Refund,
  Reports,
  Resource,
  Session,
  Ticket,
} from "@/lib/contracts";
import { currencyStep, dateTime, manager, money } from "@/lib/contracts";
import {
  Action,
  Badge,
  Button,
  Card,
  CheckField,
  DataTable,
  Empty,
  Field,
  Notice,
  PageHead,
  Select,
  TextArea,
} from "@/components/ui";
import { ActivityCards } from "./activities";
export function OverviewView({
  club,
  data,
  activities,
}: {
  club: Club;
  data: Overview;
  activities: Activity[];
}) {
  return (
    <>
      <PageHead
        title="A clear view of your club."
        subtitle="Recorded membership, participation and activity in one place."
        actions={
          <Action href={`/app/${club.id}/activities/new`}>
            Create activity
          </Action>
        }
      />
      <div className="grid four">
        {[
          ["Active members", data.members],
          ["Published activities", data.activities],
          ["Confirmed registrations", data.registrations],
          ["Recorded net payments", money(data.recordedMinor, club.currency)],
        ].map(([t, v]) => (
          <Card key={t}>
            <strong className="small">{t}</strong>
            <div className="price" style={{ fontSize: 32 }}>
              {v}
            </div>
            <p className="small">
              {club.isDemonstration
                ? "From labelled demo records"
                : "From recorded club activity"}
            </p>
          </Card>
        ))}
      </div>
      <div className="split mt">
        <Card title="Coming up at the club">
          {activities
            .filter((a) => a.status === "Published")
            .slice(0, 4)
            .map((a) => (
              <div className="item" key={a.id}>
                <div className="grow">
                  <h3>{a.title}</h3>
                  <p>
                    {dateTime(a.startsAt, club.timeZone)} · {a.place}
                  </p>
                </div>
                <Action
                  href={`/app/${club.id}/activities/${a.id}`}
                  kind="secondary"
                >
                  {a.registeredCount} / {a.capacity}
                </Action>
              </div>
            ))}
        </Card>
        <Card title="Your next steps">
          <div className="actions">
            <Action href={`/app/${club.id}/members`} kind="secondary">
              Welcome your members
            </Action>
            <Action href={`/app/${club.id}/website`} kind="secondary">
              Review your club page
            </Action>
            <Action href={`/app/${club.id}/delivery`} kind="secondary">
              Check delivery status
            </Action>
          </div>
        </Card>
      </div>
      <Card title="Recent club activity" className="mt">
        {data.recent.map((a) => (
          <div className="item" key={a.id}>
            <div>
              <h3>{a.action}</h3>
              <p>{dateTime(a.createdAt, club.timeZone)}</p>
            </div>
          </div>
        ))}
        {!data.recent.length && <p>No staff actions have been recorded yet.</p>}
      </Card>
    </>
  );
}
export function FeedView({
  club,
  session,
  activities,
  content,
}: {
  club: Club;
  session: Session;
  activities: Activity[];
  content: ClubContent[];
}) {
  return (
    <>
      <PageHead
        title="Make it a good club day."
        subtitle={`Welcome, ${session.displayName.split(" ")[0]}. Your activities, conversations and club updates, together.`}
      />
      <ActivityCards
        records={activities
          .filter((a) => a.status === "Published" && a.kind !== "Announcement")
          .slice(0, 3)}
        club={club}
      />
      <div className="grid two mt">
        <Card title="Club announcements">
          {activities
            .filter(
              (a) => a.kind === "Announcement" && a.status === "Published",
            )
            .map((a) => (
              <div className="item" key={a.id}>
                <div>
                  <h3>{a.title}</h3>
                  <p className="plain-text">{a.description}</p>
                </div>
              </div>
            ))}
          {!activities.some((a) => a.kind === "Announcement") && (
            <p>Your club’s published announcements will appear here.</p>
          )}
        </Card>
        <Card title="A welcome that feels personal">
          <p>
            Choose your interests and updates, find a group and make your next
            session part of your week.
          </p>
          <div className="actions">
            <Action href={`/app/${club.id}/preferences`} kind="secondary">
              Update preferences
            </Action>
            <Action href={`/app/${club.id}/messages`} kind="secondary">
              Open conversations
            </Action>
          </div>
        </Card>
      </div>
      {content.length > 0 && (
        <Card title="Around the clubhouse" className="mt">
          {content.map((c) => (
            <div className="item" key={c.id}>
              <div>
                <h3>{c.title}</h3>
                <p className="plain-text">{c.body}</p>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
export function FamilyView({
  club,
  childrenRecords,
}: {
  club: Club;
  childrenRecords: Member[];
}) {
  return (
    <>
      <PageHead
        title="Your family, together."
        subtitle="Juniors verified as linked to your guardian account."
      />
      <div className="grid two">
        {childrenRecords.map((c) => (
          <Card title={c.name} key={c.id}>
            <p>{c.sport}</p>
            <div className="summaryline">
              <span>Membership</span>
              <Badge>{c.status}</Badge>
            </div>
            <p className="small mt">
              Activity consent is reviewed at registration.
            </p>
            <div className="actions">
              <Action href={`/app/${club.id}/activities`}>
                Find an activity
              </Action>
            </div>
          </Card>
        ))}
      </div>
      {!childrenRecords.length && (
        <Empty title="No linked junior accounts yet.">
          Ask the club’s membership team to verify your guardian relationship. A
          self-declared relationship does not grant access.
        </Empty>
      )}
    </>
  );
}
export function NotificationsView({
  club,
  records,
}: {
  club: Club;
  records: Notification[];
}) {
  const task = useTask(),
    router = useRouter();
  return (
    <>
      <PageHead
        title="Your club updates."
        subtitle="Persistent notifications stay here even when push is unavailable."
        actions={
          <Button
            disabled={task.busy}
            kind="secondary"
            onClick={() =>
              task.run(async () => {
                await post(`/api/clubs/${club.id}/notifications/read`);
                router.refresh();
              })
            }
          >
            Mark all read
          </Button>
        }
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      <Card>
        {records.map((n) => (
          <div className="item" key={n.id}>
            <div className="grow">
              <h3>{n.title}</h3>
              <p>{n.body}</p>
              <div className="actions">
                <Action
                  href={
                    n.link.startsWith("/app/") ? n.link : `/app/${club.id}/feed`
                  }
                  kind="ghost"
                >
                  View update
                </Action>
              </div>
            </div>
            <Badge kind={n.readAt ? "neutral" : "blue"}>
              {n.readAt ? "Read" : "New"}
            </Badge>
          </div>
        ))}
        {!records.length && (
          <p>You are all caught up. New club notifications will appear here.</p>
        )}
      </Card>
    </>
  );
}
export function DeliveryView({
  club,
  records,
}: {
  club: Club;
  records: Delivery[];
}) {
  const task = useTask(),
    router = useRouter();
  return (
    <>
      <PageHead
        title="Published. Now keep track."
        subtitle="In-app persistence, provider acceptance and member reading are different states."
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      <Notice kind="info">
        Accepted means a provider accepted a request. DevelopmentInbox is a
        local development sink. Neither status proves a member received or read
        the message.
      </Notice>
      <DataTable
        heads={["Channel", "State", "Attempts", "Details", "Actions"]}
        rows={records.map((r) => [
          r.kind,
          <Badge
            key="s"
            kind={
              ["Failed", "Blocked"].includes(r.status) ? "amber" : "neutral"
            }
          >
            {r.status}
          </Badge>,
          r.attempts,
          r.lastError || "—",
          <Button
            key="r"
            kind="secondary"
            disabled={task.busy || !["Failed", "Blocked"].includes(r.status)}
            onClick={() =>
              task.run(async () => {
                await post(`/api/clubs/${club.id}/delivery/${r.id}/retry`);
                router.refresh();
              })
            }
          >
            Retry operation
          </Button>,
        ])}
      />
      <div className="actions mt">
        <Button kind="secondary" onClick={() => router.refresh()}>
          Refresh status
        </Button>
        <Action href={`/app/${club.id}/activities`} kind="secondary">
          Back to activities
        </Action>
      </div>
    </>
  );
}
export function BookingView({
  club,
  resources,
  bookings,
  role,
}: {
  club: Club;
  resources: Resource[];
  bookings: Booking[];
  role: string;
}) {
  const task = useTask(),
    router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    await task.run(async () => {
      await post(`/api/clubs/${club.id}/bookings`, {
        resourceId: d.resourceId,
        title: d.title,
        startsAt: new Date(String(d.start)).toISOString(),
        endsAt: new Date(String(d.end)).toISOString(),
      });
      router.refresh();
    }, "Resource booking confirmed.");
  }
  async function createResource(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget,
      d = Object.fromEntries(new FormData(f));
    await task.run(async () => {
      await post(`/api/clubs/${club.id}/resources`, {
        name: d.name,
        sport: d.sport,
        slotMinutes: 60,
      });
      f.reset();
      router.refresh();
    });
  }
  return (
    <>
      <PageHead
        title="A place for every session."
        subtitle={`Shared resources and reservations. Times are displayed in ${club.timeZone}.`}
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      {task.success && <Notice>{task.success}</Notice>}
      <DataTable
        heads={["Booking", "Resource", "Start", "End", "Actions"]}
        rows={bookings.map((b) => [
          b.title,
          resources.find((r) => r.id === b.resourceId)?.name || "Resource",
          dateTime(b.startsAt, club.timeZone),
          dateTime(b.endsAt, club.timeZone),
          <Button
            key="c"
            kind="secondary"
            disabled={task.busy}
            onClick={() =>
              task.run(async () => {
                await post(`/api/clubs/${club.id}/bookings/${b.id}/cancel`);
                router.refresh();
              })
            }
          >
            Cancel
          </Button>,
        ])}
      />
      <div className="grid two mt">
        <Card title="Make a reservation">
          <form method="post" onSubmit={submit}>
            <div className="formgrid">
              <Field label="Booking title" name="title" required />
              <Select label="Resource" name="resourceId" required>
                <option value="">Choose a resource</option>
                {resources.map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
              <Field
                label="Start in your device time zone"
                type="datetime-local"
                name="start"
                required
              />
              <Field
                label="End in your device time zone"
                type="datetime-local"
                name="end"
                required
              />
            </div>
            <p className="small mt">
              The service checks for overlapping reservations before confirming.
            </p>
            <Button
              type="submit"
              className="mt"
              disabled={task.busy || !resources.length}
            >
              Confirm reservation
            </Button>
          </form>
        </Card>
        {manager(role) && (
          <Card title="Add a bookable resource">
            <form method="post" onSubmit={createResource}>
              <Field label="Resource name" name="name" required />
              <Field
                label="Sport"
                name="sport"
                defaultValue={club.sports[0]}
                required
              />
              <Button type="submit" className="mt" disabled={task.busy}>
                Add resource
              </Button>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
export function ReportsView({ data }: { club: Club; data: Reports }) {
  return (
    <>
      <PageHead
        title="Your club, in recorded activity."
        subtitle="Measures calculated from saved club records. No estimated customer or delivery results."
      />
      <div className="grid two">
        <Card title="Registrations">
          <DataTable
            heads={["State", "Count"]}
            rows={data.registrations.map((r) => [r.status, r.count])}
          />
        </Card>
        <Card title="Attendance">
          <DataTable
            heads={["State", "Count"]}
            rows={data.attendance.map((r) => [r.status, r.count])}
          />
        </Card>
        <Card title="Participation by sport">
          <DataTable
            heads={["Sport", "Confirmed registrations"]}
            rows={data.bySport.map((r) => [r.sport, r.count])}
          />
        </Card>
        <Card title="Recorded financial activity">
          <DataTable
            heads={["State", "Recorded", "Refunded"]}
            rows={data.payments.map((r) => [
              r.status,
              money(r.amountMinor, r.currency),
              money(r.refundedMinor, r.currency),
            ])}
          />
        </Card>
      </div>
      <p className="small mt">
        Active member records: {data.activeMembers}. App activity alone does not
        establish retention or financial return.
      </p>
    </>
  );
}
export function PaymentsView({
  club,
  payments,
  pending,
}: {
  club: Club;
  payments: Payment[];
  pending: {
    id: string;
    memberName: string;
    activityTitle: string;
    amountMinor: number;
  }[];
}) {
  const task = useTask(),
    router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget,
      d = Object.fromEntries(new FormData(f));
    await task.run(async () => {
      await post(`/api/clubs/${club.id}/payments/offline`, {
        registrationId: d.registrationId,
        reference: d.reference,
        operationKey: "offline:" + d.registrationId,
      });
      f.reset();
      router.refresh();
    }, "Verified offline payment recorded.");
  }
  return (
    <>
      <PageHead
        title="Keep the money clear."
        subtitle="Member fees and recorded transactions, separate from the club’s software subscription."
        actions={
          <Action href={`/app/${club.id}/refunds`} kind="secondary">
            Refund requests
          </Action>
        }
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      {task.success && <Notice>{task.success}</Notice>}
      <DataTable
        heads={["Recorded", "Amount", "Refunded", "Status", "Method"]}
        rows={payments.map((p) => [
          dateTime(p.createdAt, club.timeZone),
          money(p.amountMinor, p.currency),
          money(p.refundedMinor, p.currency),
          <Badge key="s" kind={p.status === "Paid" ? "" : "amber"}>
            {p.status}
          </Badge>,
          p.purpose === "ActivityOffline"
            ? "Verified offline reference"
            : "Online provider",
        ])}
      />
      <Card title="Record a verified offline payment" className="mt">
        <p className="small">
          Confirm the bank or mobile-money reference before recording it. This
          does not transfer money.
        </p>
        <form method="post" onSubmit={submit}>
          <div className="formgrid mt">
            <Select
              label="Reserved registration"
              name="registrationId"
              required
            >
              <option value="">Choose a pending registration</option>
              {pending.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.memberName} · {r.activityTitle} ·{" "}
                  {money(r.amountMinor, club.currency)}
                </option>
              ))}
            </Select>
            <Field
              label="Verified bank or mobile-money reference"
              name="reference"
              required
              maxLength={160}
            />
          </div>
          <Button
            className="mt"
            type="submit"
            disabled={task.busy || !pending.length}
          >
            Record verified payment
          </Button>
        </form>
      </Card>
    </>
  );
}
export function RefundsView({
  club,
  payments,
  refunds,
}: {
  club: Club;
  payments: Payment[];
  refunds: Refund[];
}) {
  const task = useTask(),
    router = useRouter(),
    op = useRef<string | null>(null),
    [selected, setSelected] = useState<Refund | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    await task.run(async () => {
      op.current ??= crypto.randomUUID();
      const p = payments.find((p) => p.id === d.paymentId);
      if (!p) throw new Error("Choose a payment.");
      const digits =
        new Intl.NumberFormat("en", {
          style: "currency",
          currency: p.currency,
        }).resolvedOptions().maximumFractionDigits ?? 2;
      await post(`/api/clubs/${club.id}/payments/${p.id}/refund`, {
        amountMinor: Math.round(Number(d.amount) * 10 ** digits),
        reason: d.reason,
        operationKey: op.current,
      });
      op.current = null;
      router.refresh();
    }, "Refund request recorded. Provider or offline confirmation is a separate step.");
  }
  return (
    <>
      <PageHead
        title="Refunds, with a clear record."
        subtitle="Pending requests are distinct from confirmed refunds."
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      {task.success && <Notice>{task.success}</Notice>}
      <DataTable
        heads={["Amount", "State", "Reason", "Actions"]}
        rows={refunds.map((r) => [
          money(r.amountMinor, club.currency),
          <Badge key="s" kind={r.status === "Confirmed" ? "" : "amber"}>
            {r.status}
          </Badge>,
          r.reason,
          r.status === "PendingManual" ? (
            <Button key="c" kind="secondary" onClick={() => setSelected(r)}>
              Verify offline refund
            </Button>
          ) : (
            "Provider status recorded"
          ),
        ])}
      />
      {selected && (
        <Card title="Verify an offline refund" className="mt">
          <form
            method="post"
            onSubmit={(e) => {
              e.preventDefault();
              const reason = new FormData(e.currentTarget).get("reference");
              void task.run(async () => {
                await post(
                  `/api/clubs/${club.id}/refunds/${selected.id}/confirm-offline`,
                  { reason },
                );
                setSelected(null);
                router.refresh();
              });
            }}
          >
            <Field
              label="Confirmed bank or mobile-money refund reference"
              name="reference"
              required
            />
            <CheckField
              label="I have independently verified this refund transfer."
              required
            />
            <Button className="mt" disabled={task.busy}>
              Record refund confirmation
            </Button>
          </form>
        </Card>
      )}
      <Card title="Request a refund" className="mt">
        <form method="post" onSubmit={submit}>
          <div className="formgrid">
            <Select label="Paid transaction" name="paymentId" required>
              <option value="">Choose a transaction</option>
              {payments
                .filter((p) => ["Paid", "PaidNeedsReview"].includes(p.status))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {money(p.amountMinor - p.refundedMinor, p.currency)}{" "}
                    remaining · {p.reference || p.id.slice(0, 8)}
                  </option>
                ))}
            </Select>
            <Field
              label="Refund amount in payment currency"
              name="amount"
              type="number"
              min={currencyStep(club.currency)}
              step={currencyStep(club.currency)}
              required
            />
            <TextArea label="Reason" name="reason" required maxLength={1000} />
          </div>
          <Button className="mt" disabled={task.busy}>
            Request refund
          </Button>
        </form>
      </Card>
    </>
  );
}
export function BillingView({
  club,
  data,
  role,
}: {
  club: Club;
  data: Billing;
  role: string;
}) {
  const task = useTask(),
    router = useRouter(),
    op = useRef<string | null>(null),
    [cancel, setCancel] = useState(false);
  async function checkout(plan: string) {
    await task.run(async () => {
      op.current ??= crypto.randomUUID();
      const r = await post<{ url: string }>(
        `/api/clubs/${club.id}/billing/checkout`,
        { plan, operationKey: op.current },
      );
      window.location.assign(r.url);
    });
  }
  return (
    <>
      <PageHead
        title="Your club subscription."
        subtitle="The club’s software plan, separate from membership and activity fees."
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      {task.success && <Notice>{task.success}</Notice>}
      <div className="grid two">
        <Card title={data.subscription.plan + " plan"}>
          <Badge kind={data.subscription.status === "Active" ? "" : "amber"}>
            {data.subscription.status}
          </Badge>
          <div className="summaryline">
            <span>Member allowance</span>
            <strong>{data.subscription.memberLimit}</strong>
          </div>
          <div className="summaryline">
            <span>Current period ends</span>
            <strong>
              {dateTime(data.subscription.periodEnd, club.timeZone)}
            </strong>
          </div>
          <p className="mt">
            {data.subscription.cancelAtPeriodEnd
              ? "Cancellation is scheduled for the period boundary."
              : "No cancellation is scheduled."}
          </p>
          {role === "Owner" && (
            <div className="actions">
              <Button
                disabled={task.busy || !data.onlineBillingAvailable}
                onClick={() => checkout("Community")}
              >
                Choose Community
              </Button>
              <Button
                disabled={task.busy || !data.onlineBillingAvailable}
                onClick={() => checkout("Club")}
              >
                Choose Club
              </Button>
              <Button kind="secondary" onClick={() => setCancel(true)}>
                Cancel at period end
              </Button>
            </div>
          )}
          {!data.onlineBillingAvailable && (
            <p className="small mt">
              Online subscription checkout is not configured. Contact platform
              support; no payment has been taken.
            </p>
          )}
        </Card>
        <Card title="Member payment setup">
          <p>
            Online club fees require an approved merchant account for your
            club’s country. Verified offline fee records remain separate.
          </p>
          {role === "Owner" && (
            <div className="actions">
              <Button
                disabled={task.busy}
                kind="secondary"
                onClick={() =>
                  task.run(async () => {
                    const r = await post<{ url: string }>(
                      `/api/clubs/${club.id}/billing/merchant-onboarding`,
                    );
                    window.location.assign(r.url);
                  })
                }
              >
                Set up club payments
              </Button>
              <Button
                disabled={task.busy}
                kind="secondary"
                onClick={() =>
                  task.run(async () => {
                    const r = await post<{ url: string }>(
                      `/api/clubs/${club.id}/billing/portal`,
                    );
                    window.location.assign(r.url);
                  })
                }
              >
                Billing payment method
              </Button>
            </div>
          )}
        </Card>
      </div>
      {cancel && (
        <Card title="Review cancellation" className="mt">
          <p>
            Paid features remain available until the displayed period ends.
            Export club records before making changes.
          </p>
          <form
            method="post"
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(async () => {
                await post(`/api/clubs/${club.id}/billing/cancel`);
                setCancel(false);
                router.refresh();
              }, "Cancellation scheduled at the period boundary.");
            }}
          >
            <CheckField
              label="I understand the displayed timing and want to cancel."
              required
            />
            <Button kind="danger" disabled={task.busy}>
              Confirm cancellation
            </Button>
          </form>
        </Card>
      )}
      <Card title="Billing history" className="mt">
        <DataTable
          heads={["Invoice", "Total", "State", "Actions"]}
          rows={data.invoices.map((i) => [
            i.providerId,
            money(i.amountMinor, i.currency),
            i.status,
            i.hostedUrl ? (
              <a
                key="v"
                className="btn secondary"
                href={i.hostedUrl}
                target="_blank"
                rel="noreferrer"
              >
                View invoice
              </a>
            ) : (
              "—"
            ),
          ])}
        />
      </Card>
    </>
  );
}
export function ContentView({
  club,
  records,
  catering = false,
}: {
  club: Club;
  records: ClubContent[];
  catering?: boolean;
}) {
  const task = useTask(),
    router = useRouter(),
    [selected, setSelected] = useState<ClubContent | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      d = Object.fromEntries(new FormData(form));
    await task.run(async () => {
      const body = {
        kind: d.kind,
        title: d.title,
        body: d.body,
        published: d.published === "on",
      };
      if (selected)
        await put(`/api/clubs/${club.id}/content/${selected.id}`, body);
      else await post(`/api/clubs/${club.id}/content`, body);
      setSelected(null);
      form.reset();
      router.refresh();
    }, "Content saved.");
  }
  return (
    <>
      <PageHead
        title={
          catering
            ? "More life around the sport."
            : "Make a good first impression."
        }
        subtitle={
          catering
            ? "Manage your club’s menus, offers and social activities."
            : "Edit public club content, then preview the club page."
        }
        actions={
          <Action href={"/clubs/" + club.slug} kind="secondary">
            View public club page
          </Action>
        }
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      {task.success && <Notice>{task.success}</Notice>}
      <div className="grid two">
        {records.map((c) => (
          <Card key={c.id} title={c.title}>
            <Badge kind={c.published ? "" : "neutral"}>
              {c.kind} · {c.published ? "Published" : "Draft"}
            </Badge>
            <p className="plain-text mt">{c.body}</p>
            <div className="actions">
              <Button kind="secondary" onClick={() => setSelected(c)}>
                Edit
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <Card
        title={selected ? "Edit content" : "Create club content"}
        className="mt"
      >
        <form method="post" key={selected?.id || "new"} onSubmit={submit}>
          <div className="formgrid">
            <Field
              label="Title"
              name="title"
              defaultValue={selected?.title}
              required
            />
            <Select
              label="Content type"
              name="kind"
              defaultValue={selected?.kind || "Page"}
              disabled={!!selected}
            >
              {(catering
                ? ["Menu", "Offer"]
                : ["Page", "Menu", "Offer", "Sponsor"]
              ).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </Select>
            <TextArea
              label="Content"
              name="body"
              defaultValue={selected?.body}
              required
              maxLength={20000}
            />
          </div>
          <CheckField
            label="Publish on the club page"
            name="published"
            defaultChecked={selected?.published}
          />
          <div className="actions">
            <Button disabled={task.busy}>Save content</Button>
            <Action href={`/app/${club.id}/activities/new`} kind="secondary">
              Create social activity
            </Action>
          </div>
        </form>
      </Card>
    </>
  );
}
export function SupportView({
  club,
  tickets,
}: {
  club?: Club;
  tickets: Ticket[];
}) {
  const task = useTask(),
    router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      d = Object.fromEntries(new FormData(form));
    await task.run(async () => {
      await post("/api/support", {
        subject: d.subject,
        body: d.body,
        clubId: club?.id,
      });
      form.reset();
      router.refresh();
    }, "Support request recorded.");
  }
  return (
    <>
      <PageHead
        title="We are here to help."
        subtitle="Ask about your account, club, billing or a reported concern."
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      {task.success && <Notice>{task.success}</Notice>}
      <div className="split">
        <Card>
          <form method="post" onSubmit={submit}>
            <Field label="Subject" name="subject" required />
            <TextArea
              label="Tell us what happened"
              name="body"
              required
              maxLength={8000}
            />
            <Button disabled={task.busy} className="mt">
              Create support request
            </Button>
          </form>
        </Card>
        <Card title="Your support requests">
          {tickets.map((t) => (
            <div className="item" key={t.id}>
              <div>
                <h3>{t.subject}</h3>
                <p>{t.status}</p>
                {t.response && (
                  <p className="plain-text mt">
                    Platform response: {t.response}
                  </p>
                )}
              </div>
            </div>
          ))}
          {!tickets.length && <p>No support requests yet.</p>}
        </Card>
      </div>
    </>
  );
}
export function ModerationView({
  club,
  records,
}: {
  club: Club;
  records: ModerationReport[];
}) {
  const task = useTask(),
    router = useRouter();
  return (
    <>
      <PageHead
        title="Keep conversations welcoming."
        subtitle="Review reported content with a scoped, accountable record."
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      <DataTable
        heads={["Reason", "Reported message", "State", "Actions"]}
        rows={records.map((r) => [
          r.reason,
          r.message,
          r.status,
          <div className="actions" key="a">
            <Button
              disabled={task.busy}
              kind="secondary"
              onClick={() =>
                task.run(async () => {
                  await post(`/api/clubs/${club.id}/moderation/${r.id}`, {
                    hide: false,
                    reason: "Reviewed by authorised manager",
                  });
                  router.refresh();
                })
              }
            >
              Mark reviewed
            </Button>
            <Button
              disabled={task.busy}
              kind="danger"
              onClick={() =>
                task.run(async () => {
                  await post(`/api/clubs/${club.id}/moderation/${r.id}`, {
                    hide: true,
                    reason: "Hidden after report review",
                  });
                  router.refresh();
                })
              }
            >
              Hide message
            </Button>
          </div>,
        ])}
      />
    </>
  );
}

export function EnquiriesView({
  club,
  records,
}: {
  club: Club;
  records: import("@/lib/contracts").Enquiry[];
}) {
  const task = useTask(),
    router = useRouter();
  return (
    <>
      <PageHead
        title="A good first welcome."
        subtitle="Review membership and trial enquiries, record follow-up and invite an applicant when ready."
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      {task.success && <Notice>{task.success}</Notice>}
      {records.map((e) => (
        <Card title={e.name + " · " + e.kind} key={e.id} className="mt">
          <p>{e.email}</p>
          <p className="plain-text mt">{e.body}</p>
          <div className="actions mt">
            <Select
              label={"Follow-up for " + e.name}
              value={e.status}
              onChange={(event) =>
                void task.run(async () => {
                  await api(`/api/clubs/${club.id}/enquiries/${e.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ status: event.target.value }),
                  });
                  router.refresh();
                })
              }
            >
              {["New", "Contacted", "Closed"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Button
              disabled={task.busy}
              kind="secondary"
              onClick={() =>
                task.run(async () => {
                  await post(`/api/clubs/${club.id}/invitations`, {
                    email: e.email,
                    role: "Member",
                  });
                  router.refresh();
                }, "Invitation recorded and queued. Membership begins after verified acceptance.")
              }
            >
              Invite applicant
            </Button>
          </div>
        </Card>
      ))}
      {!records.length && (
        <Empty title="Your next welcome starts here.">
          Membership and trial enquiries from your public club page appear here.
        </Empty>
      )}
    </>
  );
}
