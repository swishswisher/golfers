export default function Page() {
  return (
    <section className="section">
      <div className="container-page grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-3">
          <p className="section-heading">Tech &amp; architecture</p>
          <h1 className="section-title">
            One modern stack across app, back office and API.
          </h1>
          <p className="text-sm text-black/70">
            The stack is designed to be fast to ship, straightforward to
            maintain and safe to scale as more clubs come on board.
          </p>
          <ul className="mt-4 space-y-3 text-sm text-black/75">
            <li>
              <span className="font-semibold text-ink-900">
                Member app:
              </span>{" "}
              React Native (Expo) with TypeScript for iOS &amp; Android, with
              real-time chat and push notifications.
            </li>
            <li>
              <span className="font-semibold text-ink-900">
                Back office:
              </span>{" "}
              Next.js web app with role-based access for Manager, Pro Shop and
              Caterer and a clean, desktop-first UI.
            </li>
            <li>
              <span className="font-semibold text-ink-900">
                Backend:
              </span>{" "}
              .NET 8 API with SignalR for live messaging and a multi-tenant
              database (each record scoped by club).
            </li>
            <li>
              <span className="font-semibold text-ink-900">
                Data:
              </span>{" "}
              A single shared database in the MVP, with `club_id` boundaries
              that keep each club&apos;s data isolated while remaining
              cost-effective.
            </li>
            <li>
              <span className="font-semibold text-ink-900">
                Infrastructure:
              </span>{" "}
              Cloud hosting, environment-based configs and a clear path to
              per-club billing and white-labelling later.
            </li>
          </ul>
        </div>

        <div className="rounded-3xl bg-ink-900 p-5 text-xs text-sand-50 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-200">
            MVP architecture snapshot
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] font-semibold">Multi-tenant layer</p>
              <p className="mt-1 text-[11px] text-sand-100/80">
                Every club has its own members, content and branding, all
                isolated via a shared database with a `club_id` boundary.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] font-semibold">Real-time messaging</p>
              <p className="mt-1 text-[11px] text-sand-100/80">
                SignalR-powered channels for 1:1 and group chat, pushing new
                messages to members without constant polling.
              </p>
            </div>
            <div className="rounded-2xl border border-brand-400/60 bg-brand-500/15 px-3 py-2">
              <p className="text-[11px] font-semibold text-brand-100">
                Built for future integrations
              </p>
              <p className="mt-1 text-[11px] text-sand-100/85">
                Clean boundaries make it straightforward to plug into existing
                tee-time, handicap or billing systems in later phases.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

