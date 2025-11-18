const phases = [
  {
    label: "Phase 1 · MVP trial",
    items: [
      "Member app with chat, announcements and club feed.",
      "Back office for Manager / Pro / Caterer roles.",
      "Targeted push notifications and basic engagement stats.",
      "Multi-tenant setup so multiple clubs can trial on the same platform.",
    ],
  },
  {
    label: "Phase 2 · Engagement lift",
    items: [
      "Events & competition sign-ups with RSVP tracking.",
      "Simple polls for menu ideas, formats and social events.",
      "Deeper segmentation for pushes and in-app announcements.",
    ],
  },
  {
    label: "Phase 3 · Integrations & growth",
    items: [
      "Integrations with tee-time / booking systems.",
      "Handicap and performance views surfaced in the app.",
      "Per-club billing and white-labelled experiences.",
    ],
  },
];

export default function Page() {
  return (
    <section className="section">
      <div className="container-page space-y-8">
        <div className="max-w-2xl space-y-3">
          <p className="section-heading">From MVP to full platform</p>
          <h1 className="section-title">
            Clear phases, so you&apos;re never guessing what comes next.
          </h1>
          <p className="text-sm text-black/70">
            The goal is to ship a working MVP that real clubs can trial, then
            expand in thoughtful, measurable steps rather than launching
            everything at once.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {phases.map((phase) => (
            <article
              key={phase.label}
              className="flex flex-col rounded-3xl bg-white p-5 shadow-card"
            >
              <h2 className="text-sm font-semibold text-ink-900">
                {phase.label}
              </h2>
              <ul className="mt-3 space-y-2 text-xs text-black/70">
                {phase.items.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

