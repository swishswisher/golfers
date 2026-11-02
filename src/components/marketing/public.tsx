import Link from "next/link";
import { Action, Brand, Card, CourtArt } from "@/components/ui";
import type { ReactNode } from "react";
import { EnquiryForm } from "./public-forms";
export const publicLinks = [
  ["Platform", "/platform"],
  ["Sports", "/sports"],
  ["Solutions", "/solutions"],
  ["Pricing", "/pricing"],
  ["Resources", "/resources"],
];
export function PublicNav() {
  return (
    <header className="navpublic">
      <Brand />
      <nav className="navlinks" aria-label="Public navigation">
        {publicLinks.map(([n, p]) => (
          <Link href={p} key={p}>
            {n}
          </Link>
        ))}
      </nav>
      <div className="actions">
        <details className="public-menu">
          <summary>Menu</summary>
          <nav
            className="card"
            style={{ position: "absolute", right: 20, top: 70, zIndex: 20 }}
          >
            {[...publicLinks, ["About", "/about"], ["Contact", "/contact"]].map(
              ([n, p]) => (
                <p key={p} style={{ margin: 12 }}>
                  <Link href={p}>{n}</Link>
                </p>
              ),
            )}
          </nav>
        </details>
        <Action href="/login" kind="ghost">
          Sign in
        </Action>
        <Action href="/signup" kind="lime">
          Start your club
        </Action>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <Brand />
      <nav className="links" aria-label="Footer navigation">
        {[
          ["About", "/about"],
          ["Contact", "/contact"],
          ["Book a demo", "/demo"],
          ["Trust & privacy", "/trust"],
          ["Help", "/support"],
          ["Explore all sports", "/sports"],
        ].map(([n, p]) => (
          <Link href={p} key={p}>
            {n}
          </Link>
        ))}
      </nav>
      <div className="bottom">
        <span>More time for the sport. More life in your club.</span>
        <span>Clubline · A home for sports clubs everywhere.</span>
      </div>
    </footer>
  );
}
export function PublicFrame({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <>
      <PublicNav />
      <main id="main">
        <div className="publicintro">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <section className="section" style={{ paddingTop: 30 }}>
          {children}
        </section>
      </main>
      <Footer />
    </>
  );
}
export function Home() {
  return (
    <>
      <PublicNav />
      <main id="main">
        <section className="publichero">
          <div>
            <span className="eyebrow">Every sport. Every club. One place.</span>
            <h1>
              More time
              <br />
              for <em>the sport.</em>
            </h1>
            <p>
              Bring your members, teams, bookings and payments together. Give
              your club more room to grow.
            </p>
            <div className="actions">
              <Action href="/signup" kind="lime">
                Start your club
              </Action>
              <Action href="/platform" kind="secondary">
                Explore the platform
              </Action>
            </div>
            <div className="subproof">
              For volunteer teams, busy coaches and ambitious clubs.
            </div>
          </div>
          <div className="courts">
            <CourtArt />
            <div className="court-note">
              <div className="datebox">
                <span>Your</span>
                <strong>club</strong>
              </div>
              <div>
                <h3>Your next good club day.</h3>
                <p>A familiar place for your people.</p>
              </div>
            </div>
          </div>
        </section>
        <div className="ticker">
          {[
            "Football & rugby",
            "Tennis & padel",
            "Swimming & classes",
            "Running & cycling",
            "Golf & more",
          ].map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <section className="section">
          <div className="sectionhead">
            <div>
              <span className="eyebrow">Your club, connected</span>
              <h2>
                Everything that happens
                <br />
                around the sport.
              </h2>
            </div>
            <p>
              From a member’s first enquiry to the next season’s renewal, keep
              the details together and the experience personal.
            </p>
          </div>
          <div className="grid three">
            {[
              [
                "01",
                "Bring people together",
                "Memberships, families, teams and conversations that belong to your club.",
                "/experience",
              ],
              [
                "02",
                "Make every session count",
                "Plan training, manage bookings and see who is coming.",
                "/platform",
              ],
              [
                "03",
                "Keep the club moving",
                "Collect fees, follow up renewals and understand recorded activity.",
                "/solutions",
              ],
            ].map(([n, t, s, l]) => (
              <Card key={t}>
                <span className="feature-no">{n} / CLUB LIFE</span>
                <h3>{t}</h3>
                <p>{s}</p>
                <div className="actions">
                  <Action href={l} kind="ghost">
                    Explore
                  </Action>
                </div>
              </Card>
            ))}
          </div>
        </section>
        <section className="section dark">
          <div>
            <div className="sectionhead">
              <div>
                <span className="eyebrow">Built around your sport</span>
                <h2>
                  A football team.
                  <br />A swim school.
                  <br />
                  Your kind of club.
                </h2>
              </div>
              <p>
                Choose your sports and the tools you need. Your club gets its
                own identity, structure and space.
              </p>
            </div>
            <div className="actions">
              <Action href="/sports" kind="lime">
                Find your sport
              </Action>
              <Action href="/demo" kind="secondary">
                Talk about your club
              </Action>
            </div>
          </div>
        </section>
        <section className="section">
          <div className="sectionhead">
            <h2>
              A smoother season
              <br />
              starts with a simple setup.
            </h2>
            <p>
              Create your club, bring your people and publish your first
              activity. We can help with the move.
            </p>
          </div>
          <div className="grid three">
            {[
              "Choose your sports and structure",
              "Add your branding and members",
              "Invite your team and get going",
            ].map((t, i) => (
              <Card key={t}>
                <span className="feature-no">0{i + 1}</span>
                <h3>{t}</h3>
              </Card>
            ))}
          </div>
          <div className="actions mt">
            <Action href="/signup">Create your club</Action>
            <Action href="/demo" kind="secondary">
              Discuss your setup
            </Action>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
const platform = [
  [
    "Memberships & families",
    "Applications, reviewed imports, household accounts and member records.",
  ],
  [
    "Teams & coaching",
    "Squads, sessions, availability and attendance for assigned staff.",
  ],
  [
    "Facilities & bookings",
    "Shared resources, reservations and clear conflict handling.",
  ],
  [
    "Club communication",
    "Announcements, private and group conversations, and notification preferences.",
  ],
  [
    "Payments & reporting",
    "Member fees, recorded transactions, refund requests and reports.",
  ],
  [
    "A public club page",
    "Promote your club and collect trial and membership enquiries.",
  ],
];
const sports = [
  [
    "Team sports",
    "Football, rugby, cricket, basketball and more. Teams, training, attendance and match fees.",
  ],
  [
    "Racquet & facility sports",
    "Tennis, padel and badminton. Courts, coaching, bookings and waitlists.",
  ],
  [
    "Classes & academies",
    "Swimming, gymnastics and martial arts. Coaching, juniors, guardians and attendance.",
  ],
  [
    "Outdoor & endurance",
    "Running, cycling and hiking. Group outings, meeting points and participant limits.",
  ],
  [
    "Golf & clubhouse life",
    "Member groups, coaching, social events, menus and offers.",
  ],
  [
    "Multi-sport organisations",
    "Several sports with shared membership and controlled staff access.",
  ],
];
const solutions = [
  [
    "Managers & committees",
    "Publish updates, welcome members and understand recorded club activity.",
  ],
  [
    "Coaches & captains",
    "Plan sessions, manage assigned teams and take attendance.",
  ],
  [
    "Treasurers",
    "Track fees, record verified payments and manage refund requests.",
  ],
  [
    "Members & families",
    "Activities, messages, payments and preferences together.",
  ],
  ["Catering & retail staff", "Publish menus, offers and social activities."],
  ["Organisations", "Manage club plans, entitlements, content and support."],
];
export function InformationPage({ slug }: { slug: string }) {
  if (slug === "contact" || slug === "demo")
    return (
      <PublicFrame
        eyebrow={slug === "demo" ? "See it together" : "Let’s talk"}
        title={
          slug === "demo"
            ? "A walkthrough for your club."
            : "How can we help your club?"
        }
        subtitle="Tell us what you organise and the support your club needs."
      >
        <div className="split">
          <EnquiryForm kind={slug === "demo" ? "Demo" : "Contact"} />
          <Card title="Make it your club">
            <p>
              Discuss your membership structure, sports, existing tools,
              migration and training needs.
            </p>
            <ul className="checklist">
              <li>Club-specific conversation</li>
              <li>Migration and training options</li>
              <li>Clear next steps</li>
            </ul>
          </Card>
        </div>
      </PublicFrame>
    );
  if (slug === "pricing")
    return (
      <PublicFrame
        eyebrow="Plans for different club sizes"
        title="A plan for your kind of club."
        subtitle="The club subscribes. Members and guardians join free. Club activity and membership fees are separate."
      >
        <div className="notice info">
          Start with a 14-day club trial. Paid plans and online payment methods
          depend on billing availability. Any taxes and transaction charges must
          be shown at checkout.
        </div>
        <div className="grid three">
          {[
            [
              "Community",
              "$29",
              "Up to 100 active members",
              "Membership and communication|Activities and attendance|Branded club page",
            ],
            [
              "Club",
              "$99",
              "Up to 500 active members",
              "Teams and coaching|Facilities and bookings|Family accounts and reporting",
            ],
            [
              "Organisation",
              "Let’s talk",
              "A plan for several clubs",
              "Tailored allowances|Club administration|Agreed migration and support",
            ],
          ].map(([n, p, s, f], i) => (
            <Card className={`pricecard ${i === 1 ? "featured" : ""}`} key={n}>
              <h2>{n}</h2>
              <div className="price">
                {p}
                {i < 2 && <span> USD / club / month</span>}
              </div>
              <p>{s}</p>
              <ul className="checklist">
                {f.split("|").map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <Action
                href={i === 2 ? "/demo" : "/signup"}
                kind={i === 1 ? "" : "secondary"}
              >
                {i === 2 ? "Discuss your organisation" : "Start a club trial"}
              </Action>
            </Card>
          ))}
        </div>
        <Card title="What every plan includes" className="mt">
          <p>
            All core club tools, controlled staff access, isolated club
            workspaces, exports and essential accessibility. Online billing
            availability is confirmed separately from worldwide club signup.
          </p>
        </Card>
      </PublicFrame>
    );
  if (slug === "experience")
    return (
      <PublicFrame
        eyebrow="The member experience"
        title="Feel part of the club."
        subtitle="An easy place to find your next session, keep in touch and manage the details for your family."
      >
        <div className="grid two">
          <Card title="Your club day">
            <CourtArt />
            <p>Activities, club news and your bookings in one calm view.</p>
          </Card>
          <Card title="One family account">
            <ul className="checklist">
              <li>Verified guardian links</li>
              <li>Simple activity registration</li>
              <li>Clear payment status</li>
              <li>Notification preferences</li>
            </ul>
            <Action href="/signup">Get your club started</Action>
          </Card>
        </div>
      </PublicFrame>
    );
  if (slug === "about")
    return (
      <PublicFrame
        eyebrow="About Clubline"
        title="For the people who make sport happen."
        subtitle="A shared home for club life, wherever your club calls home."
      >
        <div className="grid two">
          <Card title="Our purpose">
            <p>
              Help staff and volunteers spend less time chasing information and
              more time supporting participation.
            </p>
          </Card>
          <Card title="Our approach">
            <p>
              Clear tools, transparent operations, portable club records and a
              familiar experience for members.
            </p>
          </Card>
        </div>
      </PublicFrame>
    );
  if (slug === "trust")
    return (
      <PublicFrame
        eyebrow="Trust & control"
        title="Your club. Your information."
        subtitle="Understand your permissions and the choices available for your records."
      >
        <div className="grid two">
          {[
            [
              "Controlled access",
              "Staff access follows their club role and assigned responsibilities. Junior accounts use verified guardian links.",
            ],
            [
              "Portable records",
              "Authorised managers can export club records. Contact support for individual privacy and retention requests.",
            ],
            [
              "Accountable operations",
              "Publishing, permissions and financial actions are recorded in an audit trail.",
            ],
            [
              "Communication choices",
              "Manage email and supported web push preferences. In-app notifications remain in your club account.",
            ],
          ].map(([t, s]) => (
            <Card title={t} key={t}>
              <p>{s}</p>
            </Card>
          ))}
        </div>
        <p className="mt">
          Contact the club about its member-data policies, and platform support
          about your account. Service terms and regional privacy arrangements
          must reflect your club’s operating country.
        </p>
      </PublicFrame>
    );
  const config =
    slug === "sports"
      ? {
          eyebrow: "Built for your club",
          title: "Different sports. A shared rhythm.",
          subtitle:
            "Choose one sport, several departments or a custom club structure.",
          rows: sports,
        }
      : slug === "solutions"
        ? {
            eyebrow: "For the people behind the club",
            title: "A better day for everyone.",
            subtitle:
              "Tools and access that match each person’s responsibilities.",
            rows: solutions,
          }
        : {
            eyebrow: "The platform",
            title: "One club. Everything connected.",
            subtitle:
              "Bring your everyday operations into a workspace members and staff can use.",
            rows: platform,
          };
  return (
    <PublicFrame {...config}>
      <div className="grid three">
        {config.rows.map(([t, s]) => (
          <Card title={t} key={t}>
            <p>{s}</p>
            <div className="actions">
              <Action href="/signup" kind="secondary">
                Start your club
              </Action>
            </div>
          </Card>
        ))}
      </div>
      {slug === "sports" && (
        <p className="mt">
          Official scoring, handicapping, federation and external tee-time
          systems require separate supported integrations.
        </p>
      )}
    </PublicFrame>
  );
}
