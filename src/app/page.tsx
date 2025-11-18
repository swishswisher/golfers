import Link from "next/link";

export default function Page() {
  return (
    <section className="section bg-ink-900 text-sand-50">
      <div className="container-page grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center">
        <div className="space-y-6">
          <div className="pill border-white/25 bg-white/5 text-[10px]">
            Built as a real, trial-ready MVP · Not a toy demo
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
            A modern engagement layer for{" "}
            <span className="text-brand-300">UK golf clubs</span>.
          </h1>
          <p className="max-w-xl text-sm sm:text-base text-sand-100/85">
            Golfers Clubline is a multi-tenant engagement platform that brings
            together member chat, club announcements and a role-based back
            office your staff can actually use. One app, many clubs — all from
            a single, scalable codebase.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/mvp"
              className="inline-flex items-center justify-center rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-brand-600"
            >
              Explore MVP scope
            </Link>
            <Link
              href="/stack"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-transparent px-5 py-2.5 text-sm font-medium text-sand-50 hover:bg-white/5"
            >
              See the tech &amp; architecture
            </Link>
          </div>
          <div className="flex flex-wrap gap-4 text-[11px] text-sand-100/70">
            <span>• One codebase, many clubs</span>
            <span>• Real-time chat &amp; push</span>
            <span>• Back office for Manager / Pro / Caterer</span>
          </div>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute -left-10 -top-6 h-28 w-28 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-4 -bottom-8 h-24 w-24 rounded-full bg-brand-300/20 blur-3xl" />

          <div className="relative flex gap-4 lg:justify-end">
            <div className="hidden h-[260px] w-[160px] flex-col rounded-3xl bg-gradient-to-b from-sand-50/95 to-sand-100/95 p-4 text-xs text-ink-900 shadow-card sm:flex">
              <div className="mb-3 flex items-center justify-between text-[10px]">
                <span className="font-semibold">Members&apos; chat</span>
                <span className="rounded-full bg-brand-100 px-2 py-[2px] text-[9px] text-brand-700">
                  Live
                </span>
              </div>
              <div className="space-y-2">
                <div className="rounded-2xl bg-brand-100/80 px-3 py-2">
                  <p className="text-[10px] font-medium">
                    Saturday roll-up · 8:12 tee
                  </p>
                  <p className="text-[9px] text-black/70">
                    “We&apos;ve got two spots free if anyone wants to join.”
                  </p>
                </div>
                <div className="ml-6 rounded-2xl bg-white px-3 py-2 shadow-sm">
                  <p className="text-[9px] font-medium text-brand-700">
                    Pro Shop
                  </p>
                  <p className="text-[9px] text-black/75">
                    New wedges clinic on Thursday · tap to book.
                  </p>
                </div>
                <div className="mt-4 rounded-xl bg-ink-900 px-3 py-2 text-sand-50">
                  <p className="text-[9px] font-medium">
                    Push notification preview
                  </p>
                  <p className="text-[9px] text-sand-100/80">
                    “Tonight: Curry & Quiz · 7:30pm · 8 spots left”
                  </p>
                </div>
              </div>
            </div>

            <div className="h-[260px] w-[180px] rounded-3xl bg-gradient-to-b from-ink-900 to-ink-900/95 p-4 text-xs text-sand-50 shadow-card">
              <div className="mb-3 flex items-center justify-between text-[10px]">
                <span className="font-semibold">Back office · Clifton Downs GC</span>
                <span className="rounded-full bg-brand-500/15 px-2 py-[2px] text-[9px] text-brand-100">
                  Manager view
                </span>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[9px] font-semibold">Today&apos;s focus</p>
                  <ul className="mt-1 space-y-1 text-[9px] text-sand-100/85">
                    <li>• Push “Saturday Stableford” reminder</li>
                    <li>• Feature Pro&apos;s short-game clinic</li>
                    <li>• Update bar menu specials</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[9px] font-semibold">Roles at a glance</p>
                  <p className="mt-1 text-[9px] text-sand-100/80">
                    Manager · Pro Shop · Caterer each manage their own content,
                    with clear permissions.
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-400/60 bg-brand-500/10 px-3 py-2">
                  <p className="text-[9px] font-semibold text-brand-100">
                    Multi-club ready
                  </p>
                  <p className="mt-1 text-[9px] text-sand-100/80">
                    One app, many clubs — each with its own back office,
                    members, and branding.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

