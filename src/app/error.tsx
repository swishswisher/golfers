"use client";
import { Button, Card } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="wrap" style={{ padding: "80px 24px" }}>
      <Card title="We couldn’t load this page.">
        <p>
          Please retry. If you submitted a payment, check its recorded status
          before starting another.
        </p>
        <Button className="mt" onClick={reset}>
          Try again
        </Button>
      </Card>
    </main>
  );
}
