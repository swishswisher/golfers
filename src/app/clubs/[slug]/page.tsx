import { serverApi } from "@/lib/server-api";
import type { Club, ClubContent, Activity } from "@/lib/contracts";
import { dateTime } from "@/lib/contracts";
import { PublicFrame } from "@/components/marketing/public";
import { Action, Badge, Card } from "@/components/ui";
import { EnquiryForm } from "@/components/marketing/public-forms";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const d = await serverApi<{
    club: Club;
    content: ClubContent[];
    activities: Activity[];
  }>("/api/public/clubs/" + slug);
  return (
    <PublicFrame
      eyebrow="Clubline"
      title={d.club.name}
      subtitle={d.club.sports.join(" · ")}
    >
      <section className="wrap section">
        <div className="eyebrow">{d.club.sports.join(" · ")}</div>

        {d.club.isDemonstration && (
          <Badge kind="neutral">Fictional demonstration club</Badge>
        )}
        <div className="actions">
          <Action href="/login">Member sign in</Action>
        </div>
        <div className="grid two mt">
          {d.content.map((c) => (
            <Card title={c.title} key={c.id}>
              <p className="plain-text">{c.body}</p>
            </Card>
          ))}
        </div>
        <h2 className="mt">Coming up</h2>
        <div className="grid three">
          {d.activities.map((a) => (
            <Card title={a.title} key={a.id}>
              <p>
                {dateTime(a.startsAt, d.club.timeZone)} · {a.place}
              </p>
              <p>{a.description}</p>
            </Card>
          ))}
        </div>
        <Card title="Find your place at the club" className="mt">
          <EnquiryForm kind="Membership" clubId={d.club.id} />
        </Card>
      </section>
    </PublicFrame>
  );
}
