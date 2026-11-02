"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Users,
  CalendarDays,
  MessageCircle,
  Bell,
  Wallet,
  ChartNoAxesColumn,
  Settings,
  Globe,
  Flag,
  Grid2X2,
  Sparkles,
  LogOut,
  Menu,
} from "lucide-react";
import type { Club, Session } from "@/lib/contracts";
import { manager } from "@/lib/contracts";
import { post, resetCsrf } from "@/lib/api";
import { Badge, Brand, Button, Notice } from "@/components/ui";
const navIcons = {
  home: Home,
  people: Users,
  calendar: CalendarDays,
  chat: MessageCircle,
  bell: Bell,
  wallet: Wallet,
  chart: ChartNoAxesColumn,
  settings: Settings,
  globe: Globe,
  flag: Flag,
  court: Grid2X2,
  spark: Sparkles,
};
type Nav = [string, string, keyof typeof navIcons];
function items(role: string, admin: boolean): Nav[] {
  if (admin)
    return [
      ["Platform overview", "/admin", "home"],
      ["Clubs", "/admin/clubs", "people"],
      ["Support cases", "/admin/support", "chat"],
      ["Public enquiries", "/admin/enquiries", "people"],
      ["Public content", "/admin/content", "globe"],
      ["Audit trail", "/admin/audit", "settings"],
    ];
  if (manager(role))
    return [
      ["Overview", "", "home"],
      ["Members", "/members", "people"],
      ["Activities", "/activities", "calendar"],
      ["Teams & coaching", "/teams", "flag"],
      ["Facilities", "/bookings", "court"],
      ["Messages", "/messages", "chat"],
      ["Fees & payments", "/payments", "wallet"],
      ["Reports", "/reports", "chart"],
      ["Club website", "/website", "globe"],
      ["Club enquiries", "/enquiries", "people"],
      ["Automations", "/automations", "spark"],
      ["Settings", "/settings", "settings"],
    ];
  if (role === "ProShop")
    return [
      ["Coaching & promotions", "/activities", "calendar"],
      ["Messages", "/messages", "chat"],
      ["Facilities", "/bookings", "court"],
    ];
  if (role === "Coach")
    return [
      ["My teams", "/teams", "flag"],
      ["Activities", "/activities", "calendar"],
      ["Attendance", "/attendance", "people"],
      ["Messages", "/messages", "chat"],
      ["Facilities", "/bookings", "court"],
    ];
  if (role === "Treasurer")
    return [
      ["Fees & payments", "/payments", "wallet"],
      ["Reports", "/reports", "chart"],
      ["Refunds", "/refunds", "wallet"],
      ["Messages", "/messages", "chat"],
    ];
  if (role === "Caterer")
    return [
      ["Catering & offers", "/catering", "home"],
      ["Activities", "/activities", "calendar"],
      ["Messages", "/messages", "chat"],
    ];
  return [
    ["Today", "/feed", "home"],
    ["Activities", "/activities", "calendar"],
    ["Messages", "/messages", "chat"],
    ["Notifications", "/notifications", "bell"],
    ...(role === "Guardian" ? [["My family", "/family", "people"] as Nav] : []),
    ["Membership", "/membership", "wallet"],
    ["Facilities", "/bookings", "court"],
    ["Directory", "/directory", "people"],
    ["Preferences", "/preferences", "settings"],
  ];
}
export function WorkspaceShell({
  club,
  session,
  role,
  children,
  admin = false,
}: {
  club?: Club;
  session: Session;
  role: string;
  children: ReactNode;
  admin?: boolean;
}) {
  const pathname = usePathname(),
    router = useRouter(),
    [more, setMore] = useState(false),
    [offline, setOffline] = useState(false),
    [logoutError, setLogoutError] = useState("");
  const base = club ? "/app/" + club.id : "",
    nav = items(role, admin),
    links = nav.map(([n, p, i]) => [n, admin ? p : base + p, i] as Nav);
  if (manager(role) && !admin)
    links.push(["Subscription", base + "/billing", "wallet"]);
  if (!admin && !links.some((x) => x[1] === base + "/preferences"))
    links.push(["Preferences", base + "/preferences", "settings"]);
  if (!admin && !links.some((x) => x[1] === base + "/membership"))
    links.push(["Your membership", base + "/membership", "wallet"]);
  if (!admin) links.push(["Get help", base + "/support", "chat"]);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    setMore(false);
  }, [pathname]);
  async function logout() {
    try {
      await post("/api/auth/logout");
      resetCsrf();
      sessionStorage.clear();
      window.location.replace("/login");
    } catch (e) {
      setLogoutError(e instanceof Error ? e.message : "Unable to sign out.");
    }
  }
  return (
    <div className="app">
      <aside className="sidebar">
        <Brand />
        <span className="side-label">
          {admin ? "Business operations" : "Club workspace"}
        </span>
        <nav className="sidenav" aria-label="Workspace navigation">
          {links.map(([n, p, i]) => {
            const Icon = navIcons[i];
            return (
              <Link
                key={p}
                href={p}
                className={pathname === p ? "active" : ""}
                aria-current={pathname === p ? "page" : undefined}
              >
                <Icon size={19} aria-hidden="true" />
                {n}
              </Link>
            );
          })}
        </nav>
        <div className="sidefoot">
          <strong>Good sport starts here.</strong>
          {club?.isDemonstration
            ? "Isolated demonstration club"
            : "Your club, connected."}
          <div className="actions mt">
            <button onClick={logout} className="btn secondary">
              <LogOut size={15} aria-hidden="true" />
              Sign out
            </button>
          </div>
          {session.isPlatformAdmin && !admin && (
            <Link href="/admin">Platform administration</Link>
          )}
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          {club ? (
            <label>
              <span className="sr-only">Your clubs</span>
              <select
                aria-label="Your clubs"
                value={club.id}
                onChange={(e) => router.push("/app/" + e.target.value)}
              >
                {session.clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <strong>Clubline administration</strong>
          )}
          <div className="topright">
            {club?.isDemonstration && (
              <Badge kind="neutral">Demonstration</Badge>
            )}
            <Link
              href={club ? base + "/notifications" : "/admin/support"}
              aria-label="View notifications"
            >
              <Bell size={20} />
            </Link>
            <span className="role-label">{role}</span>
            <span className="avatar" aria-label={session.displayName}>
              {session.displayName
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join("")}
            </span>
          </div>
        </header>
        <main id="main" className="content">
          <div className="breadcrumb">
            {club?.name || "Platform"} / {role}
          </div>
          {offline && (
            <Notice kind="warning">
              You appear to be offline. Reconnect before registering, paying or
              publishing. Unsaved form details remain on this screen.
            </Notice>
          )}
          {logoutError && <Notice kind="error">{logoutError}</Notice>}
          {children}
        </main>
        <nav className="mobilebottom" aria-label="Mobile workspace navigation">
          {links.slice(0, 4).map(([n, p, i]) => {
            const Icon = navIcons[i];
            return (
              <Link key={p} href={p} className={pathname === p ? "active" : ""}>
                <Icon size={20} aria-hidden="true" />
                <span>{n.split(" &")[0]}</span>
              </Link>
            );
          })}
          <button
            type="button"
            aria-expanded={more}
            aria-controls="more-navigation"
            onClick={() => setMore(!more)}
          >
            <Menu size={20} aria-hidden="true" />
            <span>More</span>
          </button>
        </nav>
        {more && (
          <nav
            id="more-navigation"
            className="card"
            aria-label="All workspace pages"
            style={{ margin: 18 }}
          >
            <div className="grid two">
              {links.map(([n, p]) => (
                <Link key={p} className="btn secondary" href={p}>
                  {n}
                </Link>
              ))}
              <Link className="btn secondary" href="/onboarding">
                Create another club
              </Link>
              <Button kind="secondary" onClick={logout}>
                Sign out
              </Button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
