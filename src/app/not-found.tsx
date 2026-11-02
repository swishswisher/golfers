import { Action, Card } from "@/components/ui";
export default function NotFound() {
  return (
    <main className="wrap" style={{ padding: 64 }}>
      <Card title="This page isn’t available.">
        <p>Follow a current club link or return to the home page.</p>
        <Action href="/">Home</Action>
      </Card>
    </main>
  );
}
