"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, post, put } from "@/lib/api";
import { useTask } from "@/lib/use-task";
import type {
  Club,
  Subscription,
  PlatformContent,
  Ticket,
  Enquiry,
  Audit,
} from "@/lib/contracts";
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
export function AdminOverview({
  data,
}: {
  data: {
    clubs: number;
    demonstrationClubs: number;
    activePaidSubscriptions: number;
    openSupportCases: number;
  };
}) {
  return (
    <>
      <PageHead
        title="A clear view of the business."
        subtitle="Live records, with demonstration clubs counted separately."
      />
      <div className="grid four">
        {Object.entries(data).map(([label, value]) => (
          <Card title={label.replace(/([A-Z])/g, " $1")} key={label}>
            <div className="price">{value}</div>
          </Card>
        ))}
      </div>
    </>
  );
}
export function AdminClubs({ records }: { records: Club[] }) {
  return (
    <>
      <PageHead
        title="Every club, accounted for."
        subtitle="Club identity, demonstration status and platform access."
      />
      <DataTable
        heads={["Club", "Country", "Type", "Access", "Actions"]}
        rows={records.map((c) => [
          c.name,
          c.country,
          c.isDemonstration ? "Demonstration" : "Customer",
          c.suspended ? "Suspended" : "Enabled",
          <Action key="a" href={"/admin/clubs/" + c.id} kind="secondary">
            Manage entitlements
          </Action>,
        ])}
      />
    </>
  );
}
export function AdminClub({
  club,
  subscription,
}: {
  club: Club;
  subscription: Subscription;
}) {
  const task = useTask(),
    router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    await task.run(async () => {
      await put("/api/admin/clubs/" + club.id, {
        plan: d.plan,
        status: d.status,
        memberLimit: Number(d.limit),
        periodEnd: new Date(String(d.end)).toISOString(),
        suspended: d.suspended === "on",
      });
      router.refresh();
    }, "Platform entitlements saved and audited.");
  }
  return (
    <>
      <PageHead
        title={club.name}
        subtitle="Manual entitlement changes require a recorded business reason in the support process."
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      {task.success && <Notice>{task.success}</Notice>}
      <Card title="Club entitlements">
        <form method="post" onSubmit={submit}>
          <div className="formgrid">
            <Select label="Plan" name="plan" defaultValue={subscription.plan}>
              {["Trial", "Community", "Club", "Organisation"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
            <Select
              label="State"
              name="status"
              defaultValue={subscription.status}
            >
              {["Trialing", "Active", "Inactive"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
            <Field
              label="Member allowance"
              type="number"
              min={1}
              max={100000}
              name="limit"
              defaultValue={subscription.memberLimit}
            />
            <Field
              label="Period end (UTC)"
              name="end"
              type="datetime-local"
              defaultValue={subscription.periodEnd.slice(0, 16)}
              required
            />
          </div>
          <CheckField
            label="Suspend club access"
            name="suspended"
            defaultChecked={club.suspended}
          />
          <CheckField
            label="I have reviewed this entitlement change."
            required
          />
          <Button className="mt" disabled={task.busy}>
            Save entitlements
          </Button>
        </form>
      </Card>
    </>
  );
}
export function AdminCases({
  records,
  enquiries = false,
}: {
  records: (Ticket | Enquiry)[];
  enquiries?: boolean;
}) {
  const task = useTask(),
    router = useRouter();
  return (
    <>
      <PageHead
        title={enquiries ? "Public enquiries." : "Support cases."}
        subtitle="Recorded requests for the platform team to review."
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      {records.map((r) => (
        <Card
          title={"subject" in r ? r.subject : r.name + " · " + r.kind}
          className="mt"
          key={r.id}
        >
          <p className="plain-text">{r.body}</p>
          {"email" in r && <p>{r.email}</p>}
          <Badge>{r.status}</Badge>
          {!enquiries && (
            <form
              method="post"
              className="mt"
              onSubmit={(e) => {
                e.preventDefault();
                const d = Object.fromEntries(new FormData(e.currentTarget));
                void task.run(async () => {
                  await api("/api/admin/support/" + r.id, {
                    method: "PATCH",
                    body: JSON.stringify({
                      status: r.status,
                      response: d.response,
                    }),
                  });
                  router.refresh();
                });
              }}
            >
              <TextArea
                label="Response visible to the requester"
                name="response"
                required
                maxLength={8000}
                defaultValue={"response" in r ? r.response : undefined}
              />
              <Button className="mt" disabled={task.busy}>
                Save support response
              </Button>
            </form>
          )}
          <div className="actions">
            <Select
              label="Case status"
              value={r.status}
              onChange={(e) =>
                void task.run(async () => {
                  await api(
                    "/api/admin/" +
                      (enquiries ? "enquiries/" : "support/") +
                      r.id,
                    {
                      method: "PATCH",
                      body: JSON.stringify({ status: e.target.value }),
                    },
                  );
                  router.refresh();
                })
              }
            >
              {(enquiries
                ? ["New", "Contacted", "Closed"]
                : ["Open", "InProgress", "Resolved"]
              ).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          </div>
        </Card>
      ))}
      {!records.length && <Notice>No recorded requests yet.</Notice>}
    </>
  );
}
export function AdminContent({ records }: { records: PlatformContent[] }) {
  const task = useTask(),
    router = useRouter(),
    [selected, setSelected] = useState<PlatformContent | null>(null);
  return (
    <>
      <PageHead
        title="Useful content, carefully published."
        subtitle="Editable resources for the public business website."
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      <div className="grid two">
        {records.map((r) => (
          <Card title={r.title} key={r.id}>
            <Badge>{r.published ? "Published" : "Draft"}</Badge>
            <div className="actions">
              <Button kind="secondary" onClick={() => setSelected(r)}>
                Edit
              </Button>
              <Action kind="secondary" href={"/resources/" + r.slug}>
                Preview published page
              </Action>
            </div>
          </Card>
        ))}
      </div>
      <Card className="mt" title={selected ? "Edit resource" : "New resource"}>
        <form
          method="post"
          key={selected?.id || "new"}
          onSubmit={(e) => {
            e.preventDefault();
            const f = e.currentTarget,
              d = Object.fromEntries(new FormData(f));
            void task.run(async () => {
              const body = {
                slug: d.slug,
                title: d.title,
                body: d.body,
                published: d.published === "on",
              };
              if (selected)
                await put("/api/admin/content/" + selected.id, body);
              else await post("/api/admin/content", body);
              setSelected(null);
              f.reset();
              router.refresh();
            });
          }}
        >
          <div className="formgrid">
            <Field
              label="URL slug"
              name="slug"
              defaultValue={selected?.slug}
              pattern="[a-z0-9-]+"
              required
              readOnly={!!selected}
            />
            <Field
              label="Title"
              name="title"
              defaultValue={selected?.title}
              required
            />
            <TextArea
              label="Article text"
              name="body"
              defaultValue={selected?.body}
              required
              maxLength={50000}
            />
          </div>
          <CheckField
            label="Publish this resource"
            name="published"
            defaultChecked={selected?.published}
          />
          <Button className="mt" disabled={task.busy}>
            Save resource
          </Button>
        </form>
      </Card>
    </>
  );
}
export function AdminAudit({ records }: { records: Audit[] }) {
  return (
    <>
      <PageHead
        title="Platform audit trail."
        subtitle="Recorded staff actions across clubs."
      />
      <DataTable
        heads={["Recorded", "Club", "Action", "Actor"]}
        rows={records.map((a) => [
          new Date(a.createdAt).toLocaleString(),
          a.clubId || "Platform",
          a.action,
          a.actorId || "System",
        ])}
      />
    </>
  );
}
