// File: src/components/demo/MemberDirectoryPanel.tsx

interface Member {
  name: string;
  tag: string;
  handicap: string;
  joined: string;
}

interface MemberDirectoryPanelProps {
  clubName: string;
  members: Member[];
}

export function MemberDirectoryPanel({
  clubName,
  members,
}: MemberDirectoryPanelProps) {
  return (
    <div className="flex flex-col rounded-3xl bg-white p-5 shadow-card h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink-900">Member Directory</h2>
        <span className="rounded-full bg-brand-100 px-3 py-1 text-[11px] font-medium text-brand-700">
          Sample view
        </span>
      </div>

      <p className="text-[11px] text-black/60 mb-3">
        A lightweight view of members at{" "}
        <span className="font-semibold">{clubName}</span>. In the full platform,
        this ties into roles, messaging and analytics.
      </p>

      <div className="space-y-2 text-xs max-h-56 overflow-y-auto">
        {members.map((m) => (
          <div
            key={m.name}
            className="flex items-center justify-between rounded-2xl border border-black/10 bg-sand-50 px-3 py-2"
          >
            <div>
              <p className="text-[11px] font-semibold text-ink-900">
                {m.name}
              </p>
              <p className="text-[10px] text-black/60">{m.tag}</p>
            </div>
            <div className="text-right text-[10px] text-black/60">
              <p>Hcp {m.handicap}</p>
              <p>Joined {m.joined}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[10px] text-black/50">
        In a later phase, this can support search, filters and quick messaging
        to segments (e.g. &quot;Saturday roll-up&quot; or &quot;Ladies
        section&quot;).
      </p>
    </div>
  );
}
