// File: src/components/demo/AnalyticsPanel.tsx

interface AnalyticsStats {
  roundsThisWeek: number;
  messagesToday: number;
  eventsThisMonth: number;
  pushOpenRate: string;
}

interface AnalyticsPanelProps {
  clubName: string;
  stats: AnalyticsStats;
}

export function AnalyticsPanel({ clubName, stats }: AnalyticsPanelProps) {
  return (
    <div className="flex flex-col rounded-3xl bg-ink-900 p-5 text-sand-50 shadow-card h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Engagement Snapshot</h2>
        <span className="rounded-full bg-brand-500/20 px-3 py-1 text-[11px] font-medium text-brand-100">
          Analytics
        </span>
      </div>

      <p className="text-[11px] text-sand-100/80 mb-3">
        High-level engagement for <span className="font-semibold">{clubName}</span> in
        the last 7 days (sample data).
      </p>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <p className="text-[10px] text-sand-100/80">Rounds logged</p>
          <p className="mt-1 text-lg font-semibold">
            {stats.roundsThisWeek.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <p className="text-[10px] text-sand-100/80">Messages today</p>
          <p className="mt-1 text-lg font-semibold">
            {stats.messagesToday.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <p className="text-[10px] text-sand-100/80">Events this month</p>
          <p className="mt-1 text-lg font-semibold">
            {stats.eventsThisMonth.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <p className="text-[10px] text-sand-100/80">Push open rate</p>
          <p className="mt-1 text-lg font-semibold">{stats.pushOpenRate}</p>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-sand-100/80">
        In the full build, this card would pull live data and let you compare
        different segments, events and campaigns over time.
      </p>
    </div>
  );
}
