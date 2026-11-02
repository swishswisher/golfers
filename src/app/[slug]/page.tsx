import { notFound } from "next/navigation";
import { InformationPage, PublicFrame } from "@/components/marketing/public";
import { Action, Card } from "@/components/ui";
import { serverApi } from "@/lib/server-api";
import type { PlatformContent } from "@/lib/contracts";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: slug.charAt(0).toUpperCase() + slug.slice(1) };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === "resources") {
    let records: PlatformContent[] = [];
    try {
      records = await serverApi("/api/public/resources");
    } catch {}
    return (
      <PublicFrame
        eyebrow="Club knowledge"
        title="Good ideas for a better club."
        subtitle="Practical guides for the people making sport happen."
      >
        <div className="grid three">
          {records.map((r) => (
            <Card title={r.title} key={r.id}>
              <p>{r.body.slice(0, 200)}</p>
              <div className="actions">
                <Action href={"/resources/" + r.slug} kind="secondary">
                  Read guide
                </Action>
              </div>
            </Card>
          ))}
        </div>
        {!records.length && (
          <Card title="The resource library is being prepared.">
            <p>Contact us for help setting up your club.</p>
          </Card>
        )}
      </PublicFrame>
    );
  }
  if (
    ![
      "platform",
      "sports",
      "solutions",
      "pricing",
      "experience",
      "about",
      "trust",
      "contact",
      "demo",
    ].includes(slug)
  )
    notFound();
  return <InformationPage slug={slug} />;
}
