"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, post, put } from "@/lib/api";
import type { Club, Invitation, Member } from "@/lib/contracts";
import { useTask } from "@/lib/use-task";
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
} from "@/components/ui";
type ImportRow = {
  name: string;
  email: string;
  sport: string;
  junior: boolean;
  directoryVisible: boolean;
  emergencyContact: string;
};
function parseCsv(text: string): string[][] {
  const rows: string[][] = [],
    row: string[] = [];
  let field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((x) => x.trim())) rows.push([...row]);
      row.length = 0;
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(field);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
export function MembersView({
  club,
  records,
  query = "",
  invitations,
  role,
}: {
  club: Club;
  records: Member[];
  query?: string;
  invitations: Invitation[];
  role: string;
}) {
  const task = useTask(),
    router = useRouter(),
    [selected, setSelected] = useState<Member | null>(null),
    [importRows, setImportRows] = useState<ImportRow[]>([]),
    [preview, setPreview] = useState<
      { row: number; name: string; email: string; valid: boolean }[]
    >([]);
  const base = "/api/clubs/" + club.id;
  async function memberSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      d = Object.fromEntries(new FormData(form));
    await task.run(async () => {
      const body = {
        name: d.name,
        email: d.email,
        sport: d.sport,
        junior: selected ? !!selected.junior : d.junior === "on",
        directoryVisible: d.directoryVisible === "on",
        emergencyContact: d.emergencyContact || "",
        status: d.status || "Active",
      };
      if (selected) await put(base + "/members/" + selected.id, body);
      else await post(base + "/members", body);
      setSelected(null);
      form.reset();
      router.refresh();
    }, "Member record saved.");
  }
  async function invitationSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      d = Object.fromEntries(new FormData(form));
    await task.run(async () => {
      await post(base + "/invitations", { email: d.email, role: d.role });
      form.reset();
      router.refresh();
    }, "Invitation recorded and queued. Check delivery status before assuming it was received.");
  }
  async function loadFile(file: File | undefined) {
    setPreview([]);
    setImportRows([]);
    if (!file) return;
    await task.run(async () => {
      if (file.size > 1024 * 1024)
        throw new Error("Keep imports under 1 MB and 500 rows.");
      const lines = parseCsv((await file.text()).replace(/^\uFEFF/, ""));
      const header = lines.shift()?.map((h) => h.trim().toLowerCase());
      if (
        !header ||
        !["name", "email", "sport"].every((h) => header.includes(h))
      )
        throw new Error("CSV headers must include name, email and sport.");
      const rows = lines.map((c) => {
        const get = (n: string) => c[header.indexOf(n)]?.trim() || "";
        return {
          name: get("name"),
          email: get("email"),
          sport: get("sport"),
          junior: get("junior").toLowerCase() === "true",
          directoryVisible: false,
          emergencyContact: get("emergencycontact"),
        };
      });
      setImportRows(rows);
    });
  }
  return (
    <>
      <PageHead
        title="Your people, organised."
        subtitle="Manage member records, reviewed imports and invitations."
        actions={
          <Action href={`/app/${club.id}/directory`} kind="secondary">
            Member directory
          </Action>
        }
      />
      {task.error && <Notice kind="error">{task.error}</Notice>}
      {task.success && <Notice>{task.success}</Notice>}
      <form method="get" action={`/app/${club.id}/members`} className="row mb">
        <Field
          label="Search club members"
          name="q"
          defaultValue={query}
          placeholder="Name or email"
        />
        <Button kind="secondary" type="submit">
          Search
        </Button>
      </form>
      <DataTable
        heads={["Member", "Sport", "Status", "Type", "Actions"]}
        rows={records.map((m) => [
          m.name,
          m.sport,
          <Badge key="s" kind={m.status === "Active" ? "" : "neutral"}>
            {m.status}
          </Badge>,
          m.junior ? "Junior" : "Adult",
          <Button key="e" kind="secondary" onClick={() => setSelected(m)}>
            Edit
          </Button>,
        ])}
      />
      <div className="grid two mt">
        <Card title={selected ? "Edit member" : "Add a member"}>
          <form
            method="post"
            key={selected?.id || "new"}
            onSubmit={memberSubmit}
          >
            <div className="formgrid">
              <Field
                label="Name"
                name="name"
                defaultValue={selected?.name}
                required
              />
              <Field
                label="Email address"
                name="email"
                type="email"
                defaultValue={selected?.email}
                required
              />
              <Field
                label="Sport"
                name="sport"
                defaultValue={selected?.sport || club.sports[0]}
                required
              />
              <Select
                label="Membership status"
                name="status"
                defaultValue={selected?.status || "Active"}
              >
                <option>Active</option>
                <option>Inactive</option>
              </Select>
              <Field
                label="Emergency contact"
                name="emergencyContact"
                defaultValue={selected?.emergencyContact}
              />
            </div>
            <CheckField
              label={
                selected ? "Junior member (set on creation)" : "Junior member"
              }
              disabled={!!selected}
              name="junior"
              defaultChecked={selected?.junior}
            />
            <CheckField
              label="Member has opted into the directory"
              name="directoryVisible"
              defaultChecked={selected?.directoryVisible}
            />
            <div className="actions mt">
              <Button type="submit" disabled={task.busy}>
                Save member
              </Button>
              {selected && (
                <Button
                  kind="secondary"
                  onClick={() => setSelected(null)}
                  type="button"
                >
                  Cancel edit
                </Button>
              )}
            </div>
          </form>
        </Card>
        <Card title="Invite someone to the club">
          <form method="post" onSubmit={invitationSubmit}>
            <div className="formgrid">
              <Field
                label="Invitation email"
                name="email"
                type="email"
                required
              />
              <Select label="Role" name="role">
                {[
                  "Member",
                  "Guardian",
                  "Coach",
                  "Treasurer",
                  "ProShop",
                  "Caterer",
                  ...(role === "Owner" ? ["Manager"] : []),
                ].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </div>
            <p className="small mt">
              An invitation must be accepted using its verified email address.
              Adding a member record alone does not grant account access.
            </p>
            <Button type="submit" className="mt" disabled={task.busy}>
              Create invitation
            </Button>
          </form>
          <div className="actions mt">
            <Action href={`/app/${club.id}/delivery`} kind="secondary">
              Check delivery
            </Action>
          </div>
        </Card>
      </div>
      <Card title="Reviewed CSV import" className="mt">
        <p className="small">
          Required headers: name, email, sport. Optional: junior,
          emergencyContact. Up to 500 rows. Invitations are a separate step.
        </p>
        <Field
          label="Member CSV file"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => loadFile(e.target.files?.[0])}
        />
        <div className="actions mt">
          <Button
            disabled={task.busy || !importRows.length}
            kind="secondary"
            onClick={() =>
              task.run(async () => {
                const result = await post<{ rows: typeof preview }>(
                  base + "/members/import",
                  { rows: importRows, commit: false },
                );
                setPreview(result.rows);
              })
            }
          >
            Validate import
          </Button>
          <Button
            disabled={
              task.busy || !preview.length || preview.some((r) => !r.valid)
            }
            onClick={() =>
              task.run(async () => {
                await post(base + "/members/import", {
                  rows: importRows,
                  commit: true,
                });
                setImportRows([]);
                setPreview([]);
                router.refresh();
              }, "Reviewed member import completed.")
            }
          >
            Commit reviewed rows
          </Button>
        </div>
        {preview.length > 0 && (
          <div className="mt">
            <DataTable
              heads={["Row", "Name", "Email", "Validation"]}
              rows={preview.map((r) => [
                r.row,
                r.name,
                r.email,
                <Badge key="s" kind={r.valid ? "" : "amber"}>
                  {r.valid ? "Valid" : "Duplicate — review"}
                </Badge>,
              ])}
            />
          </div>
        )}
      </Card>
      <Card title="Invitations" className="mt">
        <DataTable
          heads={["Email", "Role", "Status", "Actions"]}
          rows={invitations.map((i) => [
            i.email,
            i.role,
            i.revokedAt
              ? "Revoked"
              : i.acceptedAt
                ? "Accepted"
                : new Date(i.expiresAt) < new Date()
                  ? "Expired"
                  : "Pending",
            <Button
              key="r"
              disabled={task.busy || !!i.acceptedAt || !!i.revokedAt}
              kind="secondary"
              onClick={() =>
                task.run(async () => {
                  await api(base + "/invitations/" + i.id, {
                    method: "DELETE",
                  });
                  router.refresh();
                })
              }
            >
              Revoke
            </Button>,
          ])}
        />
      </Card>
    </>
  );
}
export function DirectoryView({
  club,
  records,
  query = "",
}: {
  club: Club;
  query?: string;
  records: Member[];
}) {
  const [person, setPerson] = useState<Member | null>(null),
    task = useTask(),
    router = useRouter();
  return (
    <>
      <PageHead
        title="Meet your club."
        subtitle="Adults who have chosen to be visible in the club directory."
      />
      <form
        method="get"
        action={`/app/${club.id}/directory`}
        className="row mb"
      >
        <Field
          label="Find a club member"
          name="q"
          defaultValue={query}
          placeholder="Name or sport"
        />
        <Button kind="secondary">Search directory</Button>
      </form>
      {task.error && <Notice kind="error">{task.error}</Notice>}
      <DataTable
        heads={["Member", "Sport", "Actions"]}
        rows={records.map((m) => [
          m.name,
          m.sport,
          m.userId ? (
            <Button key="m" kind="secondary" onClick={() => setPerson(m)}>
              Message
            </Button>
          ) : (
            "Account not linked"
          ),
        ])}
      />
      {person && (
        <Card title={"Start a conversation with " + person.name} className="mt">
          <Button
            disabled={task.busy}
            onClick={() =>
              task.run(async () => {
                const r = await post<{ id: string }>(
                  `/api/clubs/${club.id}/conversations`,
                  {
                    title: person.name,
                    kind: "Private",
                    userIds: [person.userId],
                  },
                );
                router.push(`/app/${club.id}/messages/${r.id}`);
              })
            }
          >
            Create private conversation
          </Button>
        </Card>
      )}
    </>
  );
}
