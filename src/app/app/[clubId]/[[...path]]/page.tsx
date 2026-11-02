/* eslint-disable react-hooks/error-boundaries -- This server boundary catches awaited API errors. Rendering errors use app/error.tsx. */
import { redirect, notFound } from "next/navigation";
import { getSession, serverApi, ServerApiError } from "@/lib/server-api";
import type {
  Club,
  Activity,
  ActivityDetail,
  Team,
  Member,
  Invitation,
  Conversation,
  MessagePage,
  Overview,
  ClubContent,
  Notification,
  Resource,
  Booking,
  Reports,
  Payment,
  Refund,
  Billing,
  Delivery,
  Preference,
  Audit,
  Ticket,
  ModerationReport,
  Enquiry,
} from "@/lib/contracts";
import { manager, dateTime } from "@/lib/contracts";
import { FeeManagement } from "@/components/workspace/fees";
import { WorkspaceShell } from "@/components/workspace/shell";
import {
  ActivityList,
  ActivityForm,
  ActivityView,
  AttendanceView,
} from "@/components/workspace/activities";
import { MembersView, DirectoryView } from "@/components/workspace/members";
import {
  ConversationsView,
  ConversationView,
} from "@/components/workspace/messages";
import {
  EnquiriesView,
  OverviewView,
  FeedView,
  FamilyView,
  NotificationsView,
  DeliveryView,
  BookingView,
  ReportsView,
  PaymentsView,
  RefundsView,
  BillingView,
  ContentView,
  SupportView,
  ModerationView,
} from "@/components/workspace/operations";
import {
  PreferencesView,
  MembershipView,
  TeamsView,
  SettingsView,
  AutomationsView,
} from "@/components/workspace/account";
import type {
  Account,
  Staff,
  Automation,
} from "@/components/workspace/account";
import { Action, Card, DataTable, Notice, PageHead } from "@/components/ui";
export default async function Page({
  params,
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
  params: Promise<{ clubId: string; path?: string[] }>;
}) {
  const { clubId, path = [] } = await params;
  const query = (await searchParams).q?.slice(0, 160) || "";
  let session;
  try {
    session = await getSession();
  } catch (e) {
    if (e instanceof ServerApiError && e.status === 401) redirect("/login");
    throw e;
  }
  const membership = session.clubs.find((c) => c.id === clubId);
  if (!membership)
    return (
      <Card title="Club access unavailable">
        <p>Your account has no active membership in this club.</p>
        <Action href="/app">Open your clubs</Action>
      </Card>
    );
  const role = membership.role,
    base = "/api/clubs/" + clubId,
    get = <T,>(p: string) => serverApi<T>(base + p);
  let content;
  try {
    const club = await get<Club>("");
    const section =
      path[0] ||
      (manager(role)
        ? "overview"
        : role === "Coach"
          ? "teams"
          : role === "Treasurer"
            ? "payments"
            : role === "ProShop"
              ? "activities"
              : role === "Caterer"
                ? "catering"
                : "feed");
    switch (section) {
      case "overview":
        content = (
          <OverviewView
            club={club}
            data={await get<Overview>("/overview")}
            activities={await get<Activity[]>("/activities")}
          />
        );
        break;
      case "feed": {
        const publicData = await serverApi<{ content: ClubContent[] }>(
          "/api/public/clubs/" + club.slug,
        );
        content = (
          <FeedView
            club={club}
            session={session}
            activities={await get<Activity[]>("/activities")}
            content={publicData.content}
          />
        );
        break;
      }
      case "activities":
      case "attendance": {
        if (path[1] === "new")
          content = (
            <ActivityForm
              club={club}
              role={role}
              teams={await get<Team[]>("/teams")}
            />
          );
        else if (path[1]) {
          const detail = await get<ActivityDetail>("/activities/" + path[1]);
          if (path[2] === "edit" && !detail.canManage)
            throw new ServerApiError(403, "You cannot edit this activity.");
          const registrations =
            path[2] === "attendance"
              ? await get<import("@/lib/contracts").Registration[]>(
                  "/activities/" + path[1] + "/registrations",
                )
              : [];
          content =
            path[2] === "edit" ? (
              <ActivityForm
                club={club}
                role={role}
                teams={await get<Team[]>("/teams")}
                activity={detail.activity}
              />
            ) : path[2] === "attendance" ? (
              <AttendanceView
                club={club}
                activity={detail.activity}
                records={registrations}
              />
            ) : (
              <ActivityView club={club} detail={detail} role={role} />
            );
        } else
          content = (
            <ActivityList
              club={club}
              records={await get<Activity[]>("/activities")}
              role={role}
            />
          );
        break;
      }
      case "members":
        content = (
          <MembersView
            club={club}
            records={await get<Member[]>(
              "/members?search=" + encodeURIComponent(query),
            )}
            query={query}
            invitations={await get<Invitation[]>("/invitations")}
            role={role}
          />
        );
        break;
      case "directory":
        content = (
          <DirectoryView
            club={club}
            records={await get<Member[]>(
              "/directory?search=" + encodeURIComponent(query),
            )}
            query={query}
          />
        );
        break;
      case "messages": {
        const records = await get<Conversation[]>("/conversations");
        if (path[1]) {
          const conversation = records.find((c) => c.id === path[1]);
          if (!conversation)
            throw new ServerApiError(
              403,
              "Conversation membership is required.",
            );
          content = (
            <ConversationView
              club={club}
              conversation={conversation}
              initial={await get<MessagePage>(
                "/conversations/" + conversation.id + "/messages?after=0",
              )}
              session={session}
            />
          );
        } else
          content = (
            <ConversationsView
              club={club}
              records={records}
              directory={await get<Member[]>("/directory")}
              role={role}
            />
          );
        break;
      }
      case "family":
        content = (
          <FamilyView
            club={club}
            childrenRecords={await get<Member[]>("/family")}
          />
        );
        break;
      case "notifications":
        content = (
          <NotificationsView
            club={club}
            records={await get<Notification[]>("/notifications")}
          />
        );
        break;
      case "delivery":
        content = (
          <DeliveryView
            club={club}
            records={await get<Delivery[]>("/delivery")}
          />
        );
        break;
      case "bookings":
        content = (
          <BookingView
            club={club}
            resources={await get<Resource[]>("/resources")}
            bookings={await get<Booking[]>("/bookings")}
            role={role}
          />
        );
        break;
      case "reports":
        content = (
          <ReportsView club={club} data={await get<Reports>("/reports")} />
        );
        break;
      case "payments":
        content = (
          <>
            <PaymentsView
              club={club}
              payments={await get<Payment[]>("/payments")}
              pending={await get("/finance/registrations")}
            />
            <FeeManagement
              club={club}
              members={await get<Member[]>("/finance/members")}
              payments={await get<Payment[]>("/payments")}
            />
          </>
        );
        break;
      case "refunds":
        content = (
          <RefundsView
            club={club}
            payments={await get<Payment[]>("/payments")}
            refunds={await get<Refund[]>("/refunds")}
          />
        );
        break;
      case "billing":
        content = (
          <BillingView
            club={club}
            data={await get<Billing>("/billing")}
            role={role}
          />
        );
        break;
      case "website":
      case "catering":
        content = (
          <ContentView
            club={club}
            records={await get<ClubContent[]>("/content")}
            catering={section === "catering"}
          />
        );
        break;
      case "support":
        content = (
          <SupportView
            club={club}
            tickets={await serverApi<Ticket[]>("/api/support")}
          />
        );
        break;
      case "moderation":
        content = (
          <ModerationView
            club={club}
            records={await get<ModerationReport[]>("/moderation")}
          />
        );
        break;
      case "membership":
        content = (
          <MembershipView
            club={club}
            account={await get<Account>("/account")}
            payments={await get<Payment[]>("/my-payments")}
          />
        );
        break;
      case "preferences": {
        const capabilities = await serverApi<{ pushPublicKey?: string }>(
          "/api/public/capabilities",
        );
        content = (
          <PreferencesView
            club={club}
            preference={await get<Preference>("/preferences")}
            account={await get<Account>("/account")}
            session={session}
            pushKey={capabilities.pushPublicKey}
          />
        );
        break;
      }
      case "teams": {
        const teams = await get<Team[]>("/teams"),
          rosters = await get<Record<string, Member[]>>("/team-rosters");
        content = (
          <TeamsView
            club={club}
            teams={teams}
            members={
              manager(role) ? await get<Member[]>("/members?limit=1000") : []
            }
            rosters={rosters}
            role={role}
          />
        );
        break;
      }
      case "settings":
        content = (
          <SettingsView
            club={club}
            staff={await get<Staff[]>("/staff")}
            members={await get<Member[]>("/members?limit=1000")}
            role={role}
          />
        );
        break;
      case "automations":
        content = (
          <AutomationsView
            club={club}
            records={await get<Automation[]>("/automations")}
            activities={await get<Activity[]>("/activities")}
          />
        );
        break;
      case "audit":
        content = (
          <>
            <PageHead title="A clear record of staff actions." />
            <DataTable
              heads={["Action", "Recorded"]}
              rows={(await get<Audit[]>("/audit")).map((a) => [
                a.action,
                dateTime(a.createdAt, club.timeZone),
              ])}
            />
          </>
        );
        break;
      case "enquiries":
        content = (
          <EnquiriesView
            club={club}
            records={await get<Enquiry[]>("/enquiries")}
          />
        );
        break;
      default:
        notFound();
    }
    return (
      <WorkspaceShell club={club} session={session} role={role}>
        {content}
      </WorkspaceShell>
    );
  } catch (e) {
    if (e instanceof ServerApiError) {
      if (e.status === 401) redirect("/login");
      return (
        <WorkspaceShell club={membership} session={session} role={role}>
          <PageHead
            title={
              e.status === 403
                ? "Permission required."
                : "Unable to load this page."
            }
          />
          <Notice kind="error">{e.message}</Notice>
          <Action href={"/app/" + clubId} kind="secondary">
            Return to workspace
          </Action>
        </WorkspaceShell>
      );
    }
    throw e;
  }
}
