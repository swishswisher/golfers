﻿// File: src/components/demo/DemoExperience.tsx
"use client";

import { useMemo, useState } from "react";
import { ManagerPanel } from "@/components/demo/ManagerPanel";
import { ProShopPanel } from "@/components/demo/ProShopPanel";
import { CatererPanel } from "@/components/demo/CatererPanel";
import { AnalyticsPanel } from "@/components/demo/AnalyticsPanel";
import { MemberDirectoryPanel } from "@/components/demo/MemberDirectoryPanel";

type DemoClubId = "clifton" | "riverside" | "northshore";

type DemoMessage = {
  id: string;
  author: string;
  role: "Member" | "Pro Shop" | "Caterer" | "Manager";
  text: string;
  time: string;
  fromSelf?: boolean;
};

type DemoClub = {
  id: DemoClubId;
  name: string;
  location: string;
  members: number;
  activeToday: number;
  segments: string[];
  primaryGroup: string;
};

type DemoMember = {
  name: string;
  tag: string;
  handicap: string;
  joined: string;
};

const demoClubs: DemoClub[] = [
  {
    id: "clifton",
    name: "Clifton Downs Golf Club",
    location: "Bristol, UK",
    members: 720,
    activeToday: 264,
    segments: ["Saturday roll-up", "Ladies section", "Juniors coaching"],
    primaryGroup: "Saturday roll-up � 8:12 tee",
  },
  {
    id: "riverside",
    name: "Riverside Links",
    location: "Surrey, UK",
    members: 540,
    activeToday: 189,
    segments: ["Seniors", "Academy", "Twilight golfers"],
    primaryGroup: "Twilight 9-hole group",
  },
  {
    id: "northshore",
    name: "North Shore Park Golf",
    location: "Leeds, UK",
    members: 410,
    activeToday: 133,
    segments: ["Monday swindle", "Ladies 9-hole", "Junior academy"],
    primaryGroup: "Ladies 9-hole � Tuesday",
  },
];

const demoMessagesByClub: Record<DemoClubId, DemoMessage[]> = {
  clifton: [
    {
      id: "c1",
      author: "James H",
      role: "Member",
      text: "We�ve got two spots free for the 8:12 if anyone wants to jump in.",
      time: "08:14",
    },
    {
      id: "c2",
      author: "Pro Shop",
      role: "Pro Shop",
      text: "Short-game clinic now full � added a second slot next Thursday.",
      time: "08:16",
    },
    {
      id: "c3",
      author: "Club Manager",
      role: "Manager",
      text: "Remember: Curry & Quiz Night tonight, 7:30pm � 6 tables left.",
      time: "08:20",
    },
  ],
  riverside: [
    {
      id: "r1",
      author: "Seniors Captain",
      role: "Member",
      text: "Seniors roll-up tomorrow 9:04 onwards � please confirm if you�re in.",
      time: "10:02",
    },
    {
      id: "r2",
      author: "Catering",
      role: "Caterer",
      text: "Today�s special: Steak & Ale pie + pint for �11.95 � 12�3pm.",
      time: "10:10",
    },
    {
      id: "r3",
      author: "Head Pro",
      role: "Pro Shop",
      text: "New fitting cart arrives Friday � twilight slots available to test drivers.",
      time: "10:15",
    },
  ],
  northshore: [
    {
      id: "n1",
      author: "Ladies Captain",
      role: "Member",
      text: "We�re trialling a 9-hole social on Tuesdays � who�s interested?",
      time: "09:26",
    },
    {
      id: "n2",
      author: "Junior Coach",
      role: "Pro Shop",
      text: "Junior academy spaces left for August � share with parents please.",
      time: "09:31",
    },
    {
      id: "n3",
      author: "Club Manager",
      role: "Manager",
      text: "Course inspection at 2pm after the rain � updates will be posted here.",
      time: "09:40",
    },
  ],
};

const demoMembersByClub: Record<DemoClubId, DemoMember[]> = {
  clifton: [
    {
      name: "James H",
      tag: "Saturday roll-up � 8:12",
      handicap: "6",
      joined: "2018",
    },
    {
      name: "Emily R",
      tag: "Ladies section",
      handicap: "12",
      joined: "2020",
    },
    {
      name: "Tom S",
      tag: "Juniors coach",
      handicap: "4",
      joined: "2016",
    },
  ],
  riverside: [
    {
      name: "Alan P",
      tag: "Seniors captain",
      handicap: "14",
      joined: "2012",
    },
    {
      name: "Chloe M",
      tag: "Twilight golfer",
      handicap: "18",
      joined: "2019",
    },
    {
      name: "Jack K",
      tag: "Academy parent",
      handicap: "22",
      joined: "2021",
    },
  ],
  northshore: [
    {
      name: "Sarah L",
      tag: "Ladies 9-hole",
      handicap: "20",
      joined: "2017",
    },
    {
      name: "Ollie B",
      tag: "Monday swindle",
      handicap: "8",
      joined: "2015",
    },
    {
      name: "Mia J",
      tag: "Junior academy",
      handicap: "�",
      joined: "2023",
    },
  ],
};

const analyticsByClub: Record<
  DemoClubId,
  {
    roundsThisWeek: number;
    messagesToday: number;
    eventsThisMonth: number;
    pushOpenRate: string;
  }
> = {
  clifton: {
    roundsThisWeek: 412,
    messagesToday: 86,
    eventsThisMonth: 9,
    pushOpenRate: "63%",
  },
  riverside: {
    roundsThisWeek: 338,
    messagesToday: 54,
    eventsThisMonth: 7,
    pushOpenRate: "58%",
  },
  northshore: {
    roundsThisWeek: 291,
    messagesToday: 42,
    eventsThisMonth: 6,
    pushOpenRate: "61%",
  },
};

export function DemoExperience() {
  const [selectedClubId, setSelectedClubId] = useState<DemoClubId>("clifton");
  const [draftMessage, setDraftMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<
    Record<DemoClubId, DemoMessage[] | undefined>
  >({});

  const selectedClub = useMemo(
    () => demoClubs.find((c) => c.id === selectedClubId)!,
    [selectedClubId]
  );

  const mergedMessages = useMemo(() => {
    const base = demoMessagesByClub[selectedClubId];
    const extra = localMessages[selectedClubId] ?? [];
    return [...base, ...extra];
  }, [selectedClubId, localMessages]);

  function handleSend() {
    const trimmed = draftMessage.trim();
    if (!trimmed) return;

    const nextMessage: DemoMessage = {
      id: `${selectedClubId}-${Date.now()}`,
      author: "You (demo)",
      role: "Member",
      text: trimmed,
      time: "Now",
      fromSelf: true,
    };

    setLocalMessages((prev) => ({
      ...prev,
      [selectedClubId]: [...(prev[selectedClubId] ?? []), nextMessage],
    }));
    setDraftMessage("");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] lg:items-start">
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl bg-white p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
            Multi-tenant preview
          </p>
          <h2 className="mt-2 text-sm font-semibold text-ink-900">
            Switch between clubs. The data follows.
          </h2>
          <p className="mt-2 text-xs text-black/70">
            In the real platform, each of these clubs is a separate tenant on
            one codebase, with isolated members, content and staff access.
          </p>
          <div className="mt-4 grid gap-2">
            {demoClubs.map((club) => (
              <button
                key={club.id}
                type="button"
                onClick={() => setSelectedClubId(club.id)}
                className={
                  "flex flex-col items-start rounded-2xl border px-3 py-2 text-left text-xs transition " +
                  (club.id === selectedClubId
                    ? "border-brand-500 bg-brand-50"
                    : "border-black/10 bg-sand-50 hover:border-brand-300")
                }
              >
                <span className="text-[11px] font-semibold text-ink-900">
                  {club.name}
                </span>
                <span className="text-[11px] text-black/60">
                  {club.location}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-ink-900 p-5 text-sand-50 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-200">
            {selectedClub.name}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[10px] text-sand-100/80">Total members</p>
              <p className="mt-1 text-lg font-semibold">
                {selectedClub.members.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[10px] text-sand-100/80">Active today</p>
              <p className="mt-1 text-lg font-semibold">
                {selectedClub.activeToday.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px]">
            <p className="font-semibold text-sand-50">Key segments</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {selectedClub.segments.map((segment) => (
                <span
                  key={segment}
                  className="rounded-full bg-ink-900/40 px-2 py-[3px] text-[10px]"
                >
                  {segment}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[11px] text-sand-100/80">
            Primary group highlighted here: {selectedClub.primaryGroup}.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col rounded-3xl bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-ink-900">
                {selectedClub.primaryGroup}
              </p>
              <p className="text-[11px] text-black/60">
                Club members, Pro Shop and staff in one shared conversation.
              </p>
            </div>
            <span className="rounded-full bg-brand-100 px-3 py-1 text-[11px] font-medium text-brand-700">
              Demo chat
            </span>
          </div>

          <div className="flex-1 rounded-2xl border border-black/5 bg-sand-50/80 p-3 text-xs">
            <div className="flex h-64 flex-col gap-2 overflow-y-auto">
              {mergedMessages.map((message) => (
                <div
                  key={message.id}
                  className={
                    "flex " +
                    (message.fromSelf ? "justify-end" : "justify-start")
                  }
                >
                  <div
                    className={
                      "max-w-[80%] rounded-2xl px-3 py-2 " +
                      (message.fromSelf
                        ? "bg-brand-500 text-white"
                        : message.role === "Pro Shop"
                        ? "bg-white text-black shadow-sm border border-brand-100"
                        : message.role === "Caterer"
                        ? "bg-[#fdf4e3] text-black border border-[#f1d9a6]"
                        : message.role === "Manager"
                        ? "bg-ink-900 text-sand-50"
                        : "bg-white text-black shadow-sm")
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold">
                        {message.author}
                      </span>
                      <span className="text-[9px] opacity-70">
                        {message.role} � {message.time}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug">
                      {message.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={draftMessage}
              onChange={(e) => setDraftMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a sample member message here�"
              className="flex-1 rounded-full border border-black/10 bg-sand-50 px-3 py-2 text-xs outline-none ring-brand-500/40 focus:border-brand-500 focus:ring-2"
            />
            <button
              type="button"
              onClick={handleSend}
              className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-card hover:bg-brand-600"
            >
              Send
            </button>
          </div>
          <p className="mt-2 text-[11px] text-black/60">
            Front-end only demo. In the real build, messages flow through a
            .NET 8 API with SignalR and are stored per club tenant.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ManagerPanel clubName={selectedClub.name} />
          <ProShopPanel clubName={selectedClub.name} />
          <CatererPanel clubName={selectedClub.name} />
          <AnalyticsPanel
            clubName={selectedClub.name}
            stats={analyticsByClub[selectedClubId]}
          />
          <MemberDirectoryPanel
            clubName={selectedClub.name}
            members={demoMembersByClub[selectedClubId]}
          />
        </div>
      </div>
    </div>
  );
}
