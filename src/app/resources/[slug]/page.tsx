import { notFound } from "next/navigation";
import { serverApi, ServerApiError } from "@/lib/server-api";
import type { PlatformContent } from "@/lib/contracts";
import { PublicFrame } from "@/components/marketing/public";
import { Action } from "@/components/ui";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let resource: PlatformContent;
  try {
    resource = await serverApi<PlatformContent>(
      "/api/public/resources/" + encodeURIComponent(slug),
    );
  } catch (e) {
    if (e instanceof ServerApiError && e.status === 404) notFound();
    throw e;
  }
  return (
    <PublicFrame
      eyebrow="Clubline"
      title={resource.title}
      subtitle="Practical ideas for the people who run clubs."
    >
      <article className="wrap section">
        <div className="eyebrow">Clubline resources</div>

        <div
          className="card plain-text mt"
          style={{ maxWidth: 850, lineHeight: 1.85 }}
        >
          {resource.body}
        </div>
        <div className="actions">
          <Action href="/resources" kind="secondary">
            All resources
          </Action>
        </div>
      </article>
    </PublicFrame>
  );
}
