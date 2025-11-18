// File: src/components/demo/ProShopPanel.tsx

interface ProShopPanelProps {
  clubName: string;
}

export function ProShopPanel({ clubName }: ProShopPanelProps) {
  return (
    <div className="flex flex-col rounded-3xl bg-white p-5 shadow-card h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink-900">Pro Shop Panel</h2>
        <span className="rounded-full bg-brand-100 px-3 py-1 text-[11px] font-medium text-brand-700">
          Lessons &amp; offers
        </span>
      </div>

      <p className="text-[11px] text-black/60 mb-3">
        How the Pro team at <span className="font-semibold">{clubName}</span> would manage
        coaching and promotions.
      </p>

      <div className="space-y-4 text-xs text-black/75">
        <div className="rounded-2xl border border-black/10 bg-sand-50 p-3">
          <p className="text-[11px] font-semibold text-ink-900">
            Lesson availability (next 3 days)
          </p>
          <ul className="mt-2 space-y-1">
            <li>� Today � 2 x 30min short-game slots</li>
            <li>� Tomorrow � 1 x 60min full-swing session</li>
            <li>� Friday � 3 x on-course strategy walks</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-black/10 bg-sand-50 p-3">
          <p className="text-[11px] font-semibold text-ink-900">
            Pro Shop promotions
          </p>
          <ul className="mt-2 space-y-1">
            <li>� New wedges demo day � 10 spots</li>
            <li>� Members-only ball bundle � save 15%</li>
            <li>� Free grip check with every lesson</li>
          </ul>
        </div>

        <button className="w-full rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-card hover:bg-brand-600">
          Publish &quot;Wedges clinic&quot; to members (demo)
        </button>

        <p className="text-[10px] text-black/50">
          In the live system, Pro Shop posts appear in relevant member feeds
          and can send targeted pushes (e.g. &quot;Short-game clinic&quot; to
          frequent players).
        </p>
      </div>
    </div>
  );
}
