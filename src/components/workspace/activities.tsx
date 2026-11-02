"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  Activity,
  ActivityDetail,
  Club,
  Registration,
  Team,
} from "@/lib/contracts";
import { currencyStep, dateTime, manager, money } from "@/lib/contracts";
import { post, put } from "@/lib/api";
import { useTask } from "@/lib/use-task";
import {
  Action,
  Badge,
  Button,
  Card,
  CheckField,
  CourtArt,
  DataTable,
  Empty,
  Field,
  Notice,
  PageHead,
  Select,
  TextArea,
} from "@/components/ui";
export function ActivityCards({
  records,
  club,
}: {
  records: Activity[];
  club: Club;
}) {
  return (
    <div className="grid three">
      {records.map((a) => (
        <Card key={a.id}>
          <div className="activityart">
            <CourtArt sport={a.sport} />
            <Badge>{a.sport}</Badge>
          </div>
          <h3>{a.title}</h3>
          <div className="activity-meta">
            <span>{dateTime(a.startsAt, club.timeZone)}</span>
          </div>
          <p className="small">
            {a.place} ·{" "}
            {a.priceMinor ? money(a.priceMinor, club.currency) : "Included"}
          </p>
          <div className="progress">
            <i
              style={{
                width:
                  Math.min(100, (a.registeredCount / a.capacity) * 100) + "%",
              }}
            />
          </div>
          <p className="small">
            {a.kind === "Announcement"
              ? "Club announcement"
              : `${a.registeredCount} of ${a.capacity} places registered`}{" "}
            · {a.status}
          </p>
          <div className="actions">
            <Action
              href={`/app/${club.id}/activities/${a.id}`}
              kind="secondary"
            >
              View {a.kind === "Announcement" ? "announcement" : "activity"}
            </Action>
          </div>
        </Card>
      ))}
      {!records.length && (
        <Empty title="Your next club day starts here.">
          There are no activities matching this view yet.
        </Empty>
      )}
    </div>
  );
}
export function ActivityList({
  records,
  club,
  role,
}: {
  records: Activity[];
  club: Club;
  role: string;
}) {
  const [sport, setSport] = useState("All");
  return (
    <>
      <PageHead
        title="Find your next club day."
        subtitle="Coaching, training and shared moments — all in one place."
        actions={
          ["Owner", "Manager", "Coach", "Caterer", "ProShop"].includes(role) ? (
            <Action href={`/app/${club.id}/activities/new`}>
              Create activity
            </Action>
          ) : undefined
        }
      />
      <div className="chips">
        {["All", ...new Set(records.map((r) => r.sport))].map((s) => (
          <button
            key={s}
            className={"chip " + (sport === s ? "active" : "")}
            aria-pressed={sport === s}
            onClick={() => setSport(s)}
          >
            {s === "All" ? "All activities" : s}
          </button>
        ))}
      </div>
      <ActivityCards
        records={records.filter((r) => sport === "All" || r.sport === sport)}
        club={club}
      />
    </>
  );
}
function localDate(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function ActivityForm({
  club,
  role,
  teams,
  activity,
}: {
  club: Club;
  role: string;
  teams: Team[];
  activity?: Activity;
}) {
  const task = useTask(),
    router = useRouter(),
    [kind, setKind] = useState(
      activity?.kind || (role === "Caterer" ? "Social" : "Coaching"),
    );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    await task.run(async () => {
      const digits =
        new Intl.NumberFormat("en", {
          style: "currency",
          currency: club.currency,
        }).resolvedOptions().maximumFractionDigits ?? 2;
      const save = activity ? put : post;
      const r = await save<Activity>(
        `/api/clubs/${club.id}/activities${activity ? "/" + activity.id : ""}`,
        {
          title: d.title,
          description: d.description,
          kind,
          sport: d.sport,
          startsAt:
            kind === "Announcement"
              ? new Date().toISOString()
              : new Date(String(d.startsAt)).toISOString(),
          endsAt:
            kind === "Announcement"
              ? new Date().toISOString()
              : new Date(String(d.endsAt)).toISOString(),
          place: kind === "Announcement" ? "Club announcement" : d.place,
          capacity: kind === "Announcement" ? 1 : Number(d.capacity),
          priceMinor:
            kind === "Announcement"
              ? 0
              : Math.round(Number(d.price) * 10 ** digits),
          teamId: d.teamId || null,
          audience: d.audience,
        },
      );
      router.push(`/app/${club.id}/activities/${r.id}`);
      router.refresh();
    });
  }
  return (
    <>
      <PageHead
        title={
          activity
            ? "Review your activity draft."
            : "Create something worth joining."
        }
        subtitle="Save a draft, review its audience, then publish when it is ready."
      />
      <form method="post" className="split" onSubmit={submit}>
        <Card>
          <div className="formgrid">
            <Select
              label="Content type"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {(role === "Caterer"
                ? ["Social", "Promotion", "Announcement"]
                : role === "ProShop"
                  ? ["Coaching", "Promotion", "Announcement"]
                  : role === "Coach"
                    ? ["Coaching", "Training"]
                    : [
                        "Coaching",
                        "Training",
                        "Social",
                        "Announcement",
                        "Promotion",
                      ]
              ).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
            <Select label="Sport" name="sport" defaultValue={activity?.sport}>
              {club.sports.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Field
              label="Title"
              name="title"
              defaultValue={activity?.title}
              required
              maxLength={160}
            />
            <Select
              label="Audience"
              name="audience"
              defaultValue={activity?.audience}
            >
              <option value="All">All club members</option>
              <option value="Sport">Members interested in this sport</option>
              <option value="Public">
                Also visible on the public club page
              </option>
            </Select>
            <TextArea
              label="Description"
              name="description"
              defaultValue={activity?.description}
              required
              maxLength={8000}
            />
            {kind !== "Announcement" && (
              <>
                <Field
                  label="Start in your device time zone"
                  name="startsAt"
                  defaultValue={
                    activity ? localDate(activity.startsAt) : undefined
                  }
                  type="datetime-local"
                  required
                  hint={`The session is displayed in ${club.timeZone} after saving.`}
                />
                <Field
                  label="End in your device time zone"
                  name="endsAt"
                  defaultValue={
                    activity ? localDate(activity.endsAt) : undefined
                  }
                  type="datetime-local"
                  required
                />
                <Field
                  label="Venue"
                  name="place"
                  defaultValue={activity?.place}
                  required
                  maxLength={160}
                />
                <Field
                  label="Capacity"
                  name="capacity"
                  type="number"
                  defaultValue={activity?.capacity || 12}
                  min={1}
                  max={100000}
                  required
                />
                <Field
                  label={`Fee (${club.currency})`}
                  name="price"
                  type="number"
                  defaultValue={
                    activity
                      ? activity.priceMinor /
                        10 **
                          (new Intl.NumberFormat("en", {
                            style: "currency",
                            currency: club.currency,
                          }).resolvedOptions().maximumFractionDigits ?? 2)
                      : 0
                  }
                  min={0}
                  step={currencyStep(club.currency)}
                  required
                />
                <Select
                  label="Assigned team"
                  name="teamId"
                  defaultValue={activity?.teamId || ""}
                  required={role === "Coach"}
                >
                  {role !== "Coach" && (
                    <option value="">Open club activity</option>
                  )}
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </>
            )}
          </div>
          <div className="actions mt">
            <Button disabled={task.busy} type="submit">
              {task.busy ? "Saving…" : "Save & review draft"}
            </Button>
            <Action href={`/app/${club.id}/activities`} kind="secondary">
              Back to activities
            </Action>
          </div>
          {task.error && <Notice kind="error">{task.error}</Notice>}
        </Card>
        <Card title="A clear publication process">
          <ul className="checklist">
            <li>Review the member preview</li>
            <li>Check the audience and club time zone</li>
            <li>Publish and create in-app notifications</li>
            <li>Track email and push acceptance separately</li>
          </ul>
          <p className="small">
            Coaches publish only for assigned teams. Catering staff manage their
            own social activities and offers.
          </p>
        </Card>
      </form>
    </>
  );
}
export function ActivityView({
  detail,
  club,
  role,
}: {
  detail: ActivityDetail;
  club: Club;
  role: string;
}) {
  const { activity: a, participants, registrations } = detail,
    task = useTask(),
    router = useRouter(),
    [waitlist, setWaitlist] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const staff = detail.canManage;
  async function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    await task.run(async () => {
      await post(`/api/clubs/${club.id}/activities/${a.id}/register`, {
        memberId: d.memberId,
        consent: d.consent === "on",
        joinWaitlist: waitlist,
      });
      setConfirmed(true);
      router.refresh();
    });
  }
  async function checkout(r: Registration) {
    await task.run(async () => {
      const result = await post<{ url: string }>(
        `/api/clubs/${club.id}/registrations/${r.id}/checkout`,
      );
      window.location.assign(result.url);
    });
  }
  return (
    <>
      <PageHead
        title={a.title}
        subtitle={`Activity time: ${dateTime(a.startsAt, club.timeZone)} · ${club.timeZone}`}
        actions={
          staff && a.status === "Published" ? (
            <Action
              href={`/app/${club.id}/activities/${a.id}/attendance`}
              kind="secondary"
            >
              Manage attendance
            </Action>
          ) : undefined
        }
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      {confirmed && (
        <Notice>
          Your registration has been recorded. Check its status below; pending
          payments are confirmed separately.
        </Notice>
      )}
      <div className="split">
        <Card>
          <div className="activityart" style={{ height: 290 }}>
            <CourtArt sport={a.sport} />
            <Badge>
              {a.sport} · {a.status}
            </Badge>
          </div>
          <h2>
            About{" "}
            {a.kind === "Announcement" ? "this announcement" : "this session"}
          </h2>
          <p className="plain-text mt">{a.description}</p>
          <div className="divider" />
          <p>{a.place}</p>
          {staff && a.status === "Published" && (
            <div className="actions mt">
              <Button
                kind="danger"
                disabled={task.busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Cancel this activity and notify registered members? Paid fees require a separate refund review.",
                    )
                  )
                    void task.run(async () => {
                      await post(
                        `/api/clubs/${club.id}/activities/${a.id}/cancel`,
                      );
                      router.refresh();
                    });
                }}
              >
                Cancel activity
              </Button>
            </div>
          )}
          <p className="small mt">
            Cancel a booking before the activity begins. Paid cancellation and
            refunds follow club review and the stated activity terms.
          </p>
          {a.status === "Draft" && staff && (
            <div className="actions mt">
              <Button
                disabled={task.busy}
                onClick={() =>
                  task.run(async () => {
                    await post(
                      `/api/clubs/${club.id}/activities/${a.id}/publish`,
                    );
                    if (manager(role)) router.push(`/app/${club.id}/delivery`);
                    router.refresh();
                  })
                }
              >
                Publish & notify
              </Button>
              <Action
                href={`/app/${club.id}/activities/${a.id}/edit`}
                kind="secondary"
              >
                Edit draft
              </Action>
              <Action href={`/app/${club.id}/activities`} kind="secondary">
                Keep draft
              </Action>
            </div>
          )}
        </Card>
        <div className="stack">
          <Card title="Your session">
            <div className="summaryline">
              <span>Fee</span>
              <strong>
                {a.priceMinor ? money(a.priceMinor, club.currency) : "Included"}
              </strong>
            </div>
            <div className="summaryline">
              <span>Registered</span>
              <strong>
                {a.registeredCount} / {a.capacity}
              </strong>
            </div>
            {a.status === "Published" && a.kind !== "Announcement" && (
              <form method="post" onSubmit={register} className="mt">
                <Select label="Who is joining?" name="memberId" required>
                  <option value="">Choose a participant</option>
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.junior ? " · linked junior" : ""}
                    </option>
                  ))}
                </Select>
                <CheckField
                  label="I accept the activity terms and am the participant or an authorised guardian."
                  name="consent"
                  required
                />
                <CheckField
                  label="Join the waitlist if all places are taken."
                  checked={waitlist}
                  onChange={(e) => setWaitlist(e.target.checked)}
                />
                <Button
                  type="submit"
                  disabled={task.busy || !participants.length}
                >
                  Register for session
                </Button>
              </form>
            )}
          </Card>
          {registrations.length > 0 && (
            <Card title="Your registrations">
              {registrations.map((r) => (
                <div key={r.id} className="stack mb">
                  <Badge
                    kind={
                      r.status === "PendingPayment"
                        ? "amber"
                        : r.status === "Confirmed"
                          ? ""
                          : "neutral"
                    }
                  >
                    {r.status}
                  </Badge>
                  <p className="small">
                    {participants.find((p) => p.id === r.memberId)?.name}
                  </p>
                  {r.status === "PendingPayment" && (
                    <>
                      <p className="small">
                        Your place is reserved until{" "}
                        {r.reservationExpiresAt
                          ? dateTime(r.reservationExpiresAt, club.timeZone)
                          : "the displayed deadline"}
                        .
                      </p>
                      <Button disabled={task.busy} onClick={() => checkout(r)}>
                        Continue to online payment
                      </Button>
                      <p className="small">
                        If online payment is unavailable, contact your club’s
                        treasurer about a verified offline payment.
                      </p>
                    </>
                  )}
                  {["Confirmed", "PendingPayment", "Waitlisted"].includes(
                    r.status,
                  ) && (
                    <Button
                      kind="secondary"
                      disabled={task.busy}
                      onClick={() =>
                        task.run(async () => {
                          await post(
                            `/api/clubs/${club.id}/registrations/${r.id}/cancel`,
                          );
                          router.refresh();
                        })
                      }
                    >
                      Cancel registration
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
export function AttendanceView({
  records,
  activity,
  club,
}: {
  records: Registration[];
  activity: Activity;
  club: Club;
}) {
  const task = useTask(),
    router = useRouter();
  return (
    <>
      <PageHead
        title={activity.title}
        subtitle="Registration, payment status and attendance in one list."
        actions={
          <Action
            href={`/app/${club.id}/activities/${activity.id}`}
            kind="secondary"
          >
            View activity
          </Action>
        }
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      <div className="grid two mb">
        <Card title="Registered">
          <div className="price">
            {records.filter((r) => r.status === "Confirmed").length}
            <span> confirmed places</span>
          </div>
        </Card>
        <Card title="Checked in">
          <div className="price">
            {records.filter((r) => r.attendance === "Present").length}
            <span> recorded attendees</span>
          </div>
        </Card>
      </div>
      <DataTable
        heads={["Participant", "Status", "Fee", "Attendance", "Actions"]}
        rows={records.map((r) => [
          r.memberName,
          <Badge key="s" kind={r.status === "Confirmed" ? "" : "amber"}>
            {r.status}
          </Badge>,
          money(r.amountMinor, club.currency),
          r.attendance,
          <Button
            key="a"
            disabled={task.busy || r.status !== "Confirmed"}
            kind="secondary"
            onClick={() =>
              task.run(async () => {
                await post(
                  `/api/clubs/${club.id}/registrations/${r.id}/attendance`,
                  {
                    status:
                      r.attendance === "Present" ? "NotCheckedIn" : "Present",
                  },
                );
                router.refresh();
              })
            }
          >
            {r.attendance === "Present" ? "Undo check-in" : "Check in"}
          </Button>,
        ])}
      />
    </>
  );
}
