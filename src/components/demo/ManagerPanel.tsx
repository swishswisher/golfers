// File: src/components/demo/ManagerPanel.tsx

interface ManagerPanelProps {
  clubName: string;
}

export function ManagerPanel({ clubName }: ManagerPanelProps) {
  return (
    <div className="flex flex-col rounded-3xl bg-white p-5 shadow-card h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink-900">Manager Panel</h2>
        <span className="rounded-full bg-brand-100 px-3 py-1 text-[11px] font-medium text-brand-700">
          Events &amp; announcements
        </span>
      </div>

      <p className="text-[11px] text-black/60 mb-3">
        Preview of what a Club Manager for <span className="font-semibold">{clubName}</span>{" "}
        would see in the Back Office.
      </p>

      <div className="space-y-4 text-xs text-black/75">
        <div className="rounded-2xl border border-black/10 bg-sand-50 p-3">
          <p className="text-[11px] font-semibold text-ink-900">
            Today&apos;s priorities
          </p>
          <ul className="mt-2 space-y-1">
            <li>� Push reminder for Saturday Stableford.</li>
            <li>� Highlight Pro&apos;s short-game clinic in the feed.</li>
            <li>� Confirm numbers for tonight&apos;s themed night.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-black/10 bg-sand-50 p-3">
          <p className="text-[11px] font-semibold text-ink-900">
            Upcoming events (next 7 days)
          </p>
          <ul className="mt-2 space-y-1">
            <li>� Saturday Stableford � 96 booked</li>
            <li>� Junior Academy Open Day � 32 registered</li>
            <li>� Seniors Open � 54 confirmed</li>
          </ul>
        </div>

        <button className="w-full rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold text-sand-50 hover:bg-black">
          Create new announcement (demo)
        </button>

        <p className="text-[10px] text-black/50">
          In the real MVP, this panel pushes announcements and event updates
          instantly to member feeds and push notifications.
        </p>
      </div>
    </div>
  );
}
