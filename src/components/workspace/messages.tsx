"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import { api, post } from "@/lib/api";
import type {
  Club,
  Conversation,
  Member,
  Message,
  MessagePage,
  Session,
} from "@/lib/contracts";
import { useTask } from "@/lib/use-task";
import {
  Action,
  Badge,
  Button,
  Card,
  CheckField,
  Field,
  Notice,
  PageHead,
  Select,
} from "@/components/ui";
export function ConversationsView({
  club,
  records,
  directory,
  role,
}: {
  club: Club;
  records: Conversation[];
  directory: Member[];
  role: string;
}) {
  const task = useTask(),
    router = useRouter();
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await task.run(async () => {
      const r = await post<Conversation>(
        `/api/clubs/${club.id}/conversations`,
        {
          title: form.get("title"),
          kind: form.get("kind"),
          userIds: form.getAll("participant"),
        },
      );
      router.push(`/app/${club.id}/messages/${r.id}`);
    });
  }
  return (
    <>
      <PageHead
        title="Your club conversations."
        subtitle="Private messages and group conversations stay together, with saved history."
        actions={
          ["Owner", "Manager"].includes(role) ? (
            <Action href={`/app/${club.id}/moderation`} kind="secondary">
              Moderation
            </Action>
          ) : undefined
        }
      />
      <div className="grid two">
        {records.map((c) => (
          <Card title={c.title} key={c.id}>
            <div className="row between">
              <Badge kind="neutral">{c.kind}</Badge>
              <Badge kind={c.unreadCount ? "blue" : "neutral"}>
                {c.unreadCount} unread
              </Badge>
            </div>
            <div className="actions">
              <Action href={`/app/${club.id}/messages/${c.id}`}>
                Open conversation
              </Action>
            </div>
          </Card>
        ))}
      </div>
      {!records.length && (
        <Notice>
          No conversations yet. Start one with eligible club members below.
        </Notice>
      )}
      <Card title="Start a conversation" className="mt">
        <form method="post" onSubmit={create}>
          <div className="formgrid">
            <Field
              label="Conversation title"
              name="title"
              maxLength={160}
              required
            />
            <Select label="Conversation type" name="kind">
              <option value="Group">Group conversation</option>
              <option value="Private">
                Private message (two participants)
              </option>
            </Select>
          </div>
          <h3 className="mt">Participants</h3>
          <div className="grid two">
            {directory
              .filter((m) => m.userId)
              .map((m) => (
                <CheckField
                  key={m.id}
                  label={m.name}
                  name="participant"
                  value={m.userId}
                />
              ))}
          </div>
          {task.error && <Notice kind="error">{task.error}</Notice>}
          <Button type="submit" disabled={task.busy} className="mt">
            Create conversation
          </Button>
          <p className="small mt">
            You are included automatically. Junior communication uses verified
            guardians.
          </p>
        </form>
      </Card>
    </>
  );
}
type Pending = { id: string; body: string; failed: boolean };
export function ConversationView({
  club,
  conversation,
  initial,
  session,
}: {
  club: Club;
  conversation: Conversation;
  initial: MessagePage;
  session: Session;
}) {
  const [records, setRecords] = useState(initial.messages),
    [draft, setDraft] = useState(""),
    [pending, setPending] = useState<Pending[]>([]),
    [connectionState, setConnectionState] = useState("Connecting"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    cursor = useRef(initial.nextCursor),
    bottom = useRef<HTMLDivElement>(null);
  const base = `/api/clubs/${club.id}/conversations/${conversation.id}`,
    key = `clubline-draft-v1:${session.id}:${club.id}:${conversation.id}`;
  const merge = useRef((incoming: Message[]) => {
    setRecords((previous) => {
      const items = new Map(previous.map((m) => [m.id, m]));
      for (const m of incoming) {
        items.set(m.id, { ...items.get(m.id), ...m });
      }
      return [...items.values()].sort((a, b) => a.sequence - b.sequence);
    });
  });
  useEffect(() => {
    setDraft(sessionStorage.getItem(key) || "");
  }, [key]);
  useEffect(() => {
    sessionStorage.setItem(key, draft);
  }, [draft, key]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [records.length, pending.length]);
  useEffect(() => {
    let disposed = false;
    const connection = new HubConnectionBuilder()
      .withUrl("/hubs/chat")
      .withAutomaticReconnect([0, 1500, 5000, 15000])
      .configureLogging(LogLevel.Error)
      .build();
    let recovering: Promise<void> | null = null;
    function catchUp(): Promise<void> {
      if (recovering) return recovering;
      recovering = (async () => {
        let count = 100;
        while (!disposed && count === 100) {
          const fresh = await api<MessagePage>(
            base + "/messages?after=" + cursor.current,
          );
          if (disposed) return;
          merge.current(fresh.messages);
          cursor.current = fresh.nextCursor;
          count = fresh.messages.length;
        }
        if (!disposed) await post(base + "/read", { through: cursor.current });
      })().finally(() => {
        recovering = null;
      });
      return recovering;
    }
    async function recover() {
      await connection.invoke(
        "JoinConversation",
        club.id,
        conversation.id,
        cursor.current,
      );
      await catchUp();
    }
    connection.on(
      "messageAdded",
      async (m: Message & { conversationId: string }) => {
        if (m.conversationId !== conversation.id || disposed) return;
        merge.current([m]);
        setPending((p) => p.filter((x) => x.id !== m.clientMessageId));
        await catchUp().catch(() => {});
      },
    );
    connection.onreconnecting(() => {
      if (!disposed) setConnectionState("Reconnecting");
    });
    connection.onreconnected(async () => {
      try {
        await recover();
        if (!disposed) setConnectionState("Connected");
      } catch {
        if (!disposed) setConnectionState("Access needs review");
      }
    });
    connection.onclose(() => {
      if (!disposed) setConnectionState("Disconnected");
    });
    const poll = window.setInterval(
      () => void catchUp().catch(() => {}),
      15000,
    );
    void connection
      .start()
      .then(async () => {
        if (disposed) return;
        await recover();
        if (!disposed) setConnectionState("Connected");
      })
      .catch(() => {
        if (!disposed)
          setConnectionState(
            "Realtime unavailable — history remains available",
          );
      });
    return () => {
      disposed = true;
      window.clearInterval(poll);
      if (connection.state !== HubConnectionState.Disconnected)
        void connection.stop();
    };
  }, [base, club.id, conversation.id]);
  async function send(message: Pending) {
    setError("");
    setPending((items) =>
      items.some((x) => x.id === message.id)
        ? items.map((x) => (x.id === message.id ? { ...x, failed: false } : x))
        : [...items, message],
    );
    try {
      const saved = await post<Message>(base + "/messages", {
        clientMessageId: message.id,
        body: message.body,
      });
      merge.current([saved]);
      setPending((items) => items.filter((x) => x.id !== message.id));
    } catch (e) {
      setPending((items) =>
        items.map((x) => (x.id === message.id ? { ...x, failed: true } : x)),
      );
      setError(
        e instanceof Error
          ? e.message
          : "Message could not be saved. Retry with the same message ID.",
      );
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    const message = {
      id: crypto.randomUUID(),
      body: draft.trim(),
      failed: false,
    };
    setBusy(true);
    setDraft("");
    await send(message);
    setBusy(false);
  }
  async function report(id: string) {
    const reason = window.prompt("Briefly explain the message concern.");
    if (!reason) return;
    try {
      await post(`/api/clubs/${club.id}/messages/${id}/report`, { reason });
      setError("Your report was recorded for authorised review.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save report.");
    }
  }
  return (
    <>
      <PageHead
        title={conversation.title}
        subtitle="Messages are saved by the club service and recover after reconnecting."
        actions={
          <Action href={`/app/${club.id}/messages`} kind="secondary">
            All conversations
          </Action>
        }
      />
      <div className="chatlayout" style={{ gridTemplateColumns: "1fr" }}>
        <section className="chatpanel">
          <div className="chathead">
            <div className="row between">
              <h3>{conversation.title}</h3>
              <Badge kind={connectionState === "Connected" ? "" : "amber"}>
                {connectionState}
              </Badge>
            </div>
            <p>{conversation.kind} conversation · authorised participants</p>
          </div>
          <div className="messages">
            {records.map((m) => (
              <div
                className={
                  "message " + (m.senderId === session.id ? "mine" : "")
                }
                key={m.id}
              >
                <div className="bubble">{m.body}</div>
                <small>
                  {m.senderId === session.id
                    ? "You"
                    : m.senderName || "Club participant"}{" "}
                  ·{" "}
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
                <button
                  type="button"
                  className="small"
                  style={{ border: 0, background: "none", padding: "7px 0" }}
                  onClick={() => report(m.id)}
                >
                  Report
                </button>
              </div>
            ))}
            {pending.map((m) => (
              <div className="message mine" key={m.id}>
                <div className="bubble">{m.body}</div>
                <small>
                  {m.failed ? "Not saved — retry required" : "Saving…"}
                </small>
                {m.failed && (
                  <Button kind="secondary" onClick={() => send(m)}>
                    Retry message
                  </Button>
                )}
              </div>
            ))}
            {!records.length && (
              <p>No messages yet. Start with a friendly introduction.</p>
            )}
            <div ref={bottom} />
          </div>
          {error && (
            <div style={{ padding: "0 20px" }}>
              <Notice kind="info">{error}</Notice>
            </div>
          )}
          <form method="post" className="chatcomposer" onSubmit={submit}>
            <label className="sr-only" htmlFor="message-draft">
              Message to conversation
            </label>
            <input
              id="message-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a message…"
              maxLength={4000}
              required
            />
            <Button type="submit" disabled={busy || !draft.trim()}>
              Send
            </Button>
          </form>
        </section>
      </div>
    </>
  );
}
