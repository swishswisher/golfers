"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, post, put } from "@/lib/api";
import { useTask } from "@/lib/use-task";
import type {
  Activity,
  Club,
  Member,
  Payment,
  Preference,
  Session,
  Team,
} from "@/lib/contracts";
import { dateTime, manager, money } from "@/lib/contracts";
import {
  Action,
  Badge,
  Button,
  Card,
  CheckField,
  DataTable,
  Field,
  Notice,
  PageHead,
  Select,
  TextArea,
} from "@/components/ui";
export interface Account {
  member: Member | null;
  children: Member[];
}
export interface Staff {
  id: string;
  userId: string;
  role: string;
  name: string;
  email: string;
}
export interface Automation {
  id: string;
  kind: string;
  enabled: boolean;
  offsetHours: number;
  template: string;
}
export function PreferencesView({
  club,
  preference,
  account,
  session,
  pushKey,
}: {
  club: Club;
  preference: Preference;
  account: Account;
  session: Session;
  pushKey?: string;
}) {
  const task = useTask(),
    router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    await task.run(async () => {
      await put(`/api/clubs/${club.id}/account`, {
        name: d.name,
        sport: d.sport,
        directoryVisible: d.directoryVisible === "on",
        emergencyContact: d.emergencyContact || "",
      });
      await put(`/api/clubs/${club.id}/preferences`, {
        email: d.email === "on",
        push: preference.push,
        digest: d.digest === "on",
        language: "en",
        timeZone: d.timeZone,
      });
      router.refresh();
    }, "Preferences saved.");
  }
  async function enablePush() {
    await task.run(async () => {
      if (
        !pushKey ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      )
        throw new Error(
          "Push is unavailable in this browser or is not configured. Email and in-app updates remain available.",
        );
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw new Error(
          "Push permission was not granted. You can change it in browser settings.",
        );
      const ready = await navigator.serviceWorker.ready;
      const raw = atob(pushKey.replace(/-/g, "+").replace(/_/g, "/"));
      const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
      const subscription = await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      });
      const json = subscription.toJSON();
      await post(`/api/clubs/${club.id}/push-subscriptions`, {
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      });
      await put(`/api/clubs/${club.id}/preferences`, {
        ...preference,
        push: true,
      });
      router.refresh();
    }, "This browser is subscribed to web push. Delivery status is tracked separately.");
  }
  return (
    <>
      <PageHead
        title="Your account, your preferences."
        subtitle="Choose the information and updates that work for you."
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      {task.success && <Notice>{task.success}</Notice>}
      <form method="post" className="split" onSubmit={submit}>
        <Card title="Personal details">
          <div className="formgrid">
            <Field
              label="Club display name"
              name="name"
              defaultValue={account.member?.name || session.displayName}
              required
            />
            <Field
              label="Verified account email"
              value={session.email}
              readOnly
            />
            <Field
              label="Sport or interest"
              name="sport"
              defaultValue={account.member?.sport || club.sports[0]}
              required
            />
            <Field
              label="Your time zone"
              name="timeZone"
              defaultValue={preference.timeZone || club.timeZone}
              required
            />
            <Field
              label="Emergency contact"
              name="emergencyContact"
              defaultValue={account.member?.emergencyContact || ""}
            />
          </div>
          <CheckField
            label="Show my adult member profile in the directory"
            name="directoryVisible"
            defaultChecked={account.member?.directoryVisible}
          />
          <Button className="mt" disabled={task.busy}>
            Save preferences
          </Button>
        </Card>
        <Card title="Notifications">
          <CheckField
            label="Email activity updates"
            name="email"
            defaultChecked={preference.email}
          />
          <CheckField
            label="Weekly digest when enabled by my club"
            name="digest"
            defaultChecked={preference.digest}
          />
          <div className="divider" />
          <Badge kind={preference.push ? "" : "neutral"}>
            Web push: {preference.push ? "enabled" : "not enabled"}
          </Badge>
          <div className="actions mt">
            <Button
              type="button"
              disabled={task.busy || !pushKey}
              kind="secondary"
              onClick={enablePush}
            >
              Enable this browser
            </Button>
            <Button
              type="button"
              disabled={task.busy || !preference.push}
              kind="secondary"
              onClick={() =>
                task.run(async () => {
                  await put(`/api/clubs/${club.id}/preferences`, {
                    ...preference,
                    push: false,
                  });
                  router.refresh();
                })
              }
            >
              Disable push
            </Button>
          </div>
          <p className="small mt">
            Browser support and consent are required. Notification delivery is
            never guaranteed by enabling a preference.
          </p>
        </Card>
      </form>
    </>
  );
}
export function MembershipView({
  club,
  account,
  payments,
}: {
  club: Club;
  account: Account;
  payments: Payment[];
}) {
  const task = useTask();
  return (
    <>
      <PageHead
        title="Your place in the club."
        subtitle="Your member record and saved fee transactions."
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      {task.success && <Notice>{task.success}</Notice>}
      <div className="grid two">
        <Card title={account.member?.name || "Your membership"}>
          <Badge>{account.member?.status || "Record needs review"}</Badge>
          <p className="mt">{account.member?.sport}</p>
          <p className="small mt">
            Contact the membership team for the club’s current renewal terms.
            The club’s software subscription is separate.
          </p>
          <Button
            className="mt"
            kind="secondary"
            disabled={task.busy}
            onClick={() =>
              task.run(async () => {
                await post("/api/support", {
                  clubId: club.id,
                  subject: "Membership renewal enquiry",
                  body: "Please send me information about renewing my club membership.",
                });
              }, "Renewal enquiry recorded for review.")
            }
          >
            Request renewal information
          </Button>
        </Card>
        <Card title="Your fee records">
          <DataTable
            heads={["Fee", "Amount", "State", "Actions"]}
            rows={payments.map((p) => [
              p.description || dateTime(p.createdAt, club.timeZone),
              money(p.amountMinor, p.currency),
              p.status,
              p.status === "Pending" && p.purpose === "MembershipFee" ? (
                <Button
                  key="p"
                  kind="secondary"
                  disabled={task.busy}
                  onClick={() =>
                    task.run(async () => {
                      const r = await post<{ url: string }>(
                        `/api/clubs/${club.id}/payments/${p.id}/checkout`,
                      );
                      window.location.assign(r.url);
                    })
                  }
                >
                  Pay membership fee
                </Button>
              ) : (
                "Recorded"
              ),
            ])}
          />
        </Card>
      </div>
    </>
  );
}
export function TeamsView({
  club,
  teams,
  members,
  role,
  rosters,
}: {
  club: Club;
  teams: Team[];
  members: Member[];
  role: string;
  rosters: Record<string, Member[]>;
}) {
  const task = useTask(),
    router = useRouter();
  return (
    <>
      <PageHead
        title="A clear plan for your teams."
        subtitle="Squads, assigned coaches and membership in one place."
        actions={
          <Action href={`/app/${club.id}/activities/new`}>
            Schedule a session
          </Action>
        }
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      <div className="grid two">
        {teams.map((t) => (
          <Card title={t.name} key={t.id}>
            <Badge>{t.sport}</Badge>
            <div className="mt">
              <DataTable
                heads={["Assigned member", "Type"]}
                rows={(rosters[t.id] || []).map((m) => [
                  m.name,
                  m.junior ? "Junior" : "Adult / staff",
                ])}
              />
            </div>
            {manager(role) && (
              <form
                method="post"
                className="mt"
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = Object.fromEntries(new FormData(e.currentTarget));
                  void task.run(async () => {
                    await post(`/api/clubs/${club.id}/teams/${t.id}/members`, {
                      memberId: d.memberId,
                      staff: d.staff === "on",
                    });
                    router.refresh();
                  });
                }}
              >
                <Select label="Add a club member" name="memberId" required>
                  <option value="">Choose a member</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
                <CheckField
                  label="Assigned coach or staff member"
                  name="staff"
                />
                <Button className="mt" kind="secondary" disabled={task.busy}>
                  Assign member
                </Button>
              </form>
            )}
          </Card>
        ))}
      </div>
      {!teams.length && (
        <Notice>
          No assigned teams yet. A manager can create a team and assign its
          coach.
        </Notice>
      )}
      {manager(role) && (
        <Card title="Create a team" className="mt">
          <form
            method="post"
            onSubmit={(e) => {
              e.preventDefault();
              const f = e.currentTarget,
                d = Object.fromEntries(new FormData(f));
              void task.run(async () => {
                await post(`/api/clubs/${club.id}/teams`, {
                  name: d.name,
                  sport: d.sport,
                });
                f.reset();
                router.refresh();
              });
            }}
          >
            <div className="formgrid">
              <Field label="Team name" name="name" required />
              <Field
                label="Sport"
                name="sport"
                defaultValue={club.sports[0]}
                required
              />
            </div>
            <Button className="mt" disabled={task.busy}>
              Create team
            </Button>
          </form>
        </Card>
      )}
    </>
  );
}
export function SettingsView({
  club,
  staff,
  members,
  role,
}: {
  club: Club;
  staff: Staff[];
  members: Member[];
  role: string;
}) {
  const task = useTask(),
    router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    await task.run(async () => {
      await put(`/api/clubs/${club.id}/settings`, {
        name: d.name,
        country: d.country,
        currency: d.currency,
        timeZone: d.timeZone,
        sports: String(d.sports)
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        brandColor: d.brandColor,
      });
      router.refresh();
    }, "Club settings saved.");
  }
  return (
    <>
      <PageHead
        title="A club that fits you."
        subtitle="Branding, location, staff permissions and verified guardian links."
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      {task.success && <Notice>{task.success}</Notice>}
      <Card title="Club settings">
        <form method="post" onSubmit={submit}>
          <div className="formgrid">
            <Field
              label="Club name"
              name="name"
              defaultValue={club.name}
              required
            />
            <Field
              label="Sports, separated by commas"
              name="sports"
              defaultValue={club.sports.join(", ")}
              required
            />
            <Field
              label="Country code"
              name="country"
              defaultValue={club.country}
              required
              pattern="[A-Za-z]{2}"
            />
            <Field
              label="Currency"
              name="currency"
              defaultValue={club.currency}
              required
              pattern="[A-Za-z]{3}"
            />
            <Field
              label="Club time zone"
              name="timeZone"
              defaultValue={club.timeZone}
              required
            />
            <Field
              label="Brand colour"
              name="brandColor"
              type="color"
              defaultValue={club.brandColor}
            />
          </div>
          <Button className="mt" disabled={task.busy}>
            Save club settings
          </Button>
        </form>
      </Card>
      <Card title="Staff & account permissions" className="mt">
        <DataTable
          heads={["Name", "Email", "Role", "Actions"]}
          rows={staff.map((s) => [
            s.name,
            s.email,
            s.role,
            role === "Owner" && s.role !== "Owner" ? (
              <Select
                key="s"
                label={"Role for " + s.name}
                defaultValue={s.role}
                onChange={(e) =>
                  void task.run(async () => {
                    await api(`/api/clubs/${club.id}/staff/${s.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({
                        email: s.email,
                        role: e.target.value,
                      }),
                    });
                    router.refresh();
                  })
                }
              >
                {[
                  "Manager",
                  "Coach",
                  "Treasurer",
                  "ProShop",
                  "Caterer",
                  "Member",
                  "Guardian",
                ].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            ) : (
              "Controlled by owner"
            ),
          ])}
        />
      </Card>
      <Card title="Verify a guardian relationship" className="mt">
        <p className="small">
          Confirm the relationship through your club’s verification process
          before granting access.
        </p>
        <form
          method="post"
          onSubmit={(e) => {
            e.preventDefault();
            const d = Object.fromEntries(new FormData(e.currentTarget));
            void task.run(async () => {
              await post(`/api/clubs/${club.id}/guardians`, {
                guardianUserId: d.guardian,
                juniorMemberId: d.junior,
              });
              router.refresh();
            }, "Guardian link verified and recorded.");
          }}
        >
          <div className="formgrid mt">
            <Select label="Verified adult account" name="guardian" required>
              <option value="">Choose an adult account</option>
              {staff
                .filter((s) => s.role === "Guardian" || s.role === "Member")
                .map((s) => (
                  <option key={s.id} value={s.userId}>
                    {s.name}
                  </option>
                ))}
            </Select>
            <Select label="Junior member" name="junior" required>
              <option value="">Choose a junior record</option>
              {members
                .filter((m) => m.junior)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </Select>
          </div>
          <CheckField
            label="I have verified this relationship through the club’s process."
            required
          />
          <Button className="mt" disabled={task.busy}>
            Create verified guardian link
          </Button>
        </form>
      </Card>
      <div className="actions mt">
        <a
          className="btn secondary"
          href={`/api/clubs/${club.id}/export`}
          download="clubline-records.json"
        >
          Export club records
        </a>
        <Action href={`/app/${club.id}/audit`} kind="secondary">
          View audit trail
        </Action>
      </div>
    </>
  );
}
export function AutomationsView({
  club,
  records,
  activities,
}: {
  club: Club;
  records: Automation[];
  activities: Activity[];
}) {
  const task = useTask(),
    router = useRouter(),
    [draft, setDraft] = useState("");
  return (
    <>
      <PageHead
        title="A little less chasing."
        subtitle="Configure useful reminders, welcomes and reviewed AI drafts."
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      {task.success && <Notice>{task.success}</Notice>}
      <div className="grid three">
        {["Welcome", "Reminder", "Digest"].map((kind) => {
          const r = records.find((x) => x.kind === kind);
          return (
            <Card
              title={
                kind === "Welcome"
                  ? "Welcome new members"
                  : kind === "Reminder"
                    ? "Activity reminders"
                    : "Weekly club digest"
              }
              key={kind}
            >
              <form
                method="post"
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = Object.fromEntries(new FormData(e.currentTarget));
                  void task.run(async () => {
                    await put(`/api/clubs/${club.id}/automations/${kind}`, {
                      enabled: d.enabled === "on",
                      offsetHours: Number(d.hours) || 24,
                      template: d.template,
                    });
                    router.refresh();
                  }, "Workflow saved.");
                }}
              >
                <CheckField
                  label="Enable this workflow"
                  name="enabled"
                  defaultChecked={r?.enabled}
                />
                {kind === "Reminder" && (
                  <Field
                    label="Hours before the activity"
                    name="hours"
                    type="number"
                    min={1}
                    max={168}
                    defaultValue={r?.offsetHours || 24}
                  />
                )}
                <TextArea
                  label="Message template"
                  name="template"
                  defaultValue={
                    r?.template ||
                    "Welcome to {club}. Find your next activity and meet your group."
                  }
                  required
                  maxLength={1000}
                />
                <p className="small mt">
                  {kind === "Welcome"
                    ? "Runs after an invitation is accepted."
                    : kind === "Reminder"
                      ? "Targets confirmed registrations and respects notification preferences."
                      : "Monday mornings in the club’s time zone. Members control their digest preference."}
                </p>
                <Button className="mt" kind="secondary" disabled={task.busy}>
                  Save workflow
                </Button>
              </form>
            </Card>
          );
        })}
      </div>
      <Card title="Your optional administration assistant" className="mt">
        <p>
          Prepare a draft from recorded activity facts. Staff review the text
          and publish it separately.
        </p>
        <form
          method="post"
          className="mt"
          onSubmit={(e) => {
            e.preventDefault();
            const id = new FormData(e.currentTarget).get("activity");
            void task.run(async () => {
              const r = await post<{ draft: string }>(
                `/api/clubs/${club.id}/assistant/draft`,
                { activityId: id },
              );
              setDraft(r.draft);
            });
          }}
        >
          <Select label="Activity to draft about" name="activity" required>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </Select>
          <Button className="mt" disabled={task.busy || !activities.length}>
            Prepare a draft
          </Button>
        </form>
        {draft && (
          <div className="mt">
            <TextArea
              label="Review your draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <p className="small mt">This text has not been published.</p>
            <Action href={`/app/${club.id}/activities/new`} kind="secondary">
              Open announcement composer
            </Action>
          </div>
        )}
      </Card>
    </>
  );
}
