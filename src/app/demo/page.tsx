import { DemoExperience } from "@/components/demo/DemoExperience";

export default function Page() {
  return (
    <section className="section">
      <div className="container-page space-y-6">
        <div className="max-w-2xl space-y-3">
          <p className="section-heading">Live MVP demo (placeholder)</p>
          <h1 className="section-title">
            Multi-tenant clubs and live chat, shown with sample data.
          </h1>
          <p className="text-sm text-black/70">
            This screen simulates how club staff and members experience the
            platform. Switch between clubs on the left and watch the chat,
            segments and activity update instantly � all powered on the front
            end with placeholder data, ready to be backed by the real API.
          </p>
        </div>

        <DemoExperience />
      </div>
    </section>
  );
}

