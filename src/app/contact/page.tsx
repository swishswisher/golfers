export default function Page() {
  return (
    <section className="section">
      <div className="container-page grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-3">
          <p className="section-heading">Next step</p>
          <h1 className="section-title">
            Book a short walkthrough of the MVP concept.
          </h1>
          <p className="text-sm text-black/70">
            This demo site is just the front door. Behind it is a clear plan
            for the mobile app, back office and multi-tenant backend. Share a
            few details about your clubs and I&apos;ll tailor the walkthrough
            and estimates.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-black/75">
            <li>• How many clubs you&apos;d like on the platform initially.</li>
            <li>• Rough member counts per club.</li>
            <li>• Any existing systems we should be aware of (bookings, CRM).</li>
          </ul>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-card">
          <form className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-black/70">
                Name
              </label>
              <input
                type="text"
                className="mt-1 w-full rounded-2xl border border-black/10 bg-sand-50 px-3 py-2 text-sm outline-none ring-brand-500/40 focus:border-brand-500 focus:ring-2"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-black/70">
                Email
              </label>
              <input
                type="email"
                className="mt-1 w-full rounded-2xl border border-black/10 bg-sand-50 px-3 py-2 text-sm outline-none ring-brand-500/40 focus:border-brand-500 focus:ring-2"
                placeholder="you@club.co.uk"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-black/70">
                Clubs &amp; context
              </label>
              <textarea
                rows={4}
                className="mt-1 w-full rounded-2xl border border-black/10 bg-sand-50 px-3 py-2 text-sm outline-none ring-brand-500/40 focus:border-brand-500 focus:ring-2"
                placeholder="Number of clubs, members, and anything else that will help tailor the MVP."
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-brand-600"
            >
              Send details (placeholder form)
            </button>
            <p className="text-[11px] text-black/60">
              This form is wired as a front-end placeholder in the MVP
              scaffold. In the live build, it would connect to your preferred
              CRM or email.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

