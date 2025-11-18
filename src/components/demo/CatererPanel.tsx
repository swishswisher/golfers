// File: src/components/demo/CatererPanel.tsx

interface CatererPanelProps {
  clubName: string;
}

export function CatererPanel({ clubName }: CatererPanelProps) {
  return (
    <div className="flex flex-col rounded-3xl bg-white p-5 shadow-card h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink-900">Caterer Panel</h2>
        <span className="rounded-full bg-brand-100 px-3 py-1 text-[11px] font-medium text-brand-700">
          Food &amp; nights
        </span>
      </div>

      <p className="text-[11px] text-black/60 mb-3">
        A snapshot of how catering at <span className="font-semibold">{clubName}</span>{" "}
        can keep members in the loop without PDFs or posters.
      </p>

      <div className="space-y-4 text-xs text-black/75">
        <div className="rounded-2xl border border-black/10 bg-sand-50 p-3">
          <p className="text-[11px] font-semibold text-ink-900">
            Today&apos;s specials
          </p>
          <ul className="mt-2 space-y-1">
            <li>� Roast chicken ciabatta</li>
            <li>� Jacket potato + tuna mayo</li>
            <li>� Chocolate brownie + cream</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-black/10 bg-sand-50 p-3">
          <p className="text-[11px] font-semibold text-ink-900">
            Weekly menu preview
          </p>
          <ul className="mt-2 space-y-1">
            <li>Mon � Pasta &amp; garlic bread</li>
            <li>Tue � Steak &amp; Ale pie</li>
            <li>Wed � Curry Night</li>
            <li>Thu � Fish &amp; Chips</li>
            <li>Fri � Mexican bowls</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-black/10 bg-sand-50 p-3">
          <p className="text-[11px] font-semibold text-ink-900">
            Upcoming themed nights
          </p>
          <ul className="mt-2 space-y-1">
            <li>� Curry &amp; Quiz � Tonight, 7:30pm</li>
            <li>� BBQ Night � This Saturday</li>
            <li>� Italian Evening � 27 Feb</li>
          </ul>
        </div>

        <button className="w-full rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-card hover:bg-brand-600">
          Post menu &amp; specials to members (demo)
        </button>

        <p className="text-[10px] text-black/50">
          In the real MVP, this panel publishes to the member feed and sends
          optional pushes to segments like &quot;Evening diners&quot; or
          &quot;Seniors&quot;.
        </p>
      </div>
    </div>
  );
}

