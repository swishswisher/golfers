const features = [
  {
    title: "Real conversations, not dead feeds",
    description:
      "Peer-to-peer and group chat so roll-ups, sections and academies have a living home inside your club app.",
  },
  {
    title: "Multi-tenant by design",
    description:
      "One codebase and app, many clubs. Each club has isolated data, branding and staff access, ready to scale.",
  },
  {
    title: "Role-based back office",
    description:
      "Manager, Pro Shop and Caterer each get tailored tools to update content without needing IT help.",
  },
  {
    title: "Push notifications that respect members",
    description:
      "Send targeted pushes to the right groups at the right time, reducing noise and driving real attendance.",
  },
];

export default function Page() {
  return (
    <section className="section">
      <div className="container-page space-y-8">
        <div className="max-w-2xl space-y-3">
          <p className="section-heading">Core MVP scope</p>
          <h1 className="section-title">
            A lean, production-minded MVP your clubs can trial.
          </h1>
          <p className="text-sm text-black/70">
            The first version focuses on the high-signal features that move
            retention, while keeping the architecture clean enough to grow
            into bookings, integrations and more advanced analytics.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="flex flex-col rounded-3xl bg-white p-5 shadow-card"
            >
              <h2 className="text-base font-semibold text-ink-900">
                {feature.title}
              </h2>
              <p className="mt-3 text-sm text-black/70">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

