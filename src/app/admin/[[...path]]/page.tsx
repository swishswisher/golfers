/* eslint-disable react-hooks/error-boundaries -- This server boundary catches awaited API errors. Rendering errors use app/error.tsx. */
import { redirect, notFound } from "next/navigation";
import { getSession, serverApi, ServerApiError } from "@/lib/server-api";
import { WorkspaceShell } from "@/components/workspace/shell";
import {
  AdminOverview,
  AdminClubs,
  AdminClub,
  AdminCases,
  AdminContent,
  AdminAudit,
} from "@/components/workspace/admin";
import type {
  Club,
  Subscription,
  Ticket,
  Enquiry,
  PlatformContent,
  Audit,
} from "@/lib/contracts";
import { Notice, Action } from "@/components/ui";
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  let session;
  try {
    session = await getSession();
  } catch {
    redirect("/login");
  }
  if (!session.isPlatformAdmin)
    return (
      <main className="wrap">
        <Notice kind="error">Platform administrator access is required.</Notice>
        <Action href="/app">Your clubs</Action>
      </main>
    );
  const { path = [] } = await params;
  let content;
  const get = <T,>(p: string) => serverApi<T>("/api/admin/" + p);
  try {
    switch (path[0] || "overview") {
      case "overview":
        content = <AdminOverview data={await get("overview")} />;
        break;
      case "clubs":
        if (path[1]) {
          const d = await get<{ club: Club; subscription: Subscription }>(
            "clubs/" + path[1],
          );
          content = <AdminClub {...d} />;
        } else content = <AdminClubs records={await get<Club[]>("clubs")} />;
        break;
      case "support":
        content = <AdminCases records={await get<Ticket[]>("support")} />;
        break;
      case "enquiries":
        content = (
          <AdminCases enquiries records={await get<Enquiry[]>("enquiries")} />
        );
        break;
      case "content":
        content = (
          <AdminContent records={await get<PlatformContent[]>("content")} />
        );
        break;
      case "audit":
        content = <AdminAudit records={await get<Audit[]>("audit")} />;
        break;
      default:
        notFound();
    }
  } catch (e) {
    if (e instanceof ServerApiError)
      content = <Notice kind="error">{e.message}</Notice>;
    else throw e;
  }
  return (
    <WorkspaceShell session={session} role="Platform administrator" admin>
      {content}
    </WorkspaceShell>
  );
}
