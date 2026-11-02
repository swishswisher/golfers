import { notFound } from "next/navigation";
import { serverApi } from "@/lib/server-api";
import { Card, PageHead, Action } from "@/components/ui";
export default async function Page() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_DEMO_MODE !== "true"
  )
    notFound();
  const records = await serverApi<
    { id: string; recipient: string; subject: string; body: string }[]
  >("/api/development/inbox");
  return (
    <main id="main" className="wrap section">
      <PageHead
        title="Development inbox."
        subtitle="Local test messages. Nothing here was sent to a real mailbox."
      />
      <Action href="/login">Sign in</Action>
      {records.map((r) => (
        <Card key={r.id} title={r.subject} className="mt">
          <p>{r.recipient}</p>
          <p className="plain-text">
            {r.body.split(/(https?:\/\/[^\s]+)/).map((s, i) =>
              s.startsWith("http") ? (
                <a key={i} href={s}>
                  {s}
                </a>
              ) : (
                s
              ),
            )}
          </p>
        </Card>
      ))}
    </main>
  );
}
