import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import pg from "pg";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
const origin = process.env.TEST_API_URL || "http://127.0.0.1:5225",
  run = Date.now().toString(),
  checks = [];
const cfg = JSON.parse(fs.readFileSync(".local/settings.json", "utf8")),
  parts = Object.fromEntries(
    (cfg.localConnectionString || cfg.connectionString)
      .split(";")
      .map((x) => x.split("=")),
  ),
  pool = new pg.Pool({
    host: parts.Host,
    port: Number(parts.Port),
    user: parts.Username?.replace(/^"|"$/g, ""),
    password: parts.Password?.replace(/^"|"$/g, ""),
    database: parts.Database?.replace(/^"|"$/g, ""),
    max: 8,
  });
class Client {
  cookies = new Map();
  token = "";
  async request(path, method = "GET", body, expected = 200) {
    const headers = {
      cookie: [...this.cookies].map(([k, v]) => k + "=" + v).join(";"),
    };
    if (this.token) headers["X-CSRF-TOKEN"] = this.token;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const r = await fetch(origin + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of r.headers.getSetCookie()) {
      const pair = c.split(";")[0],
        i = pair.indexOf("=");
      this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    const data = await r.json().catch(() => null);
    assert.equal(
      r.status,
      expected === 200 && method !== "GET" && r.status === 204 ? 204 : expected,
      `${method} ${path}: ${JSON.stringify(data)}`,
    );
    return data;
  }
  async csrf() {
    this.token = (await this.request("/api/auth/csrf")).token;
  }
  async login(email) {
    await this.csrf();
    await this.request("/api/auth/login", "POST", {
      email: email + "@clubline.test",
      password: "ClublineDemo!2026",
    });
    await this.csrf();
    this.me = await this.request("/api/auth/me");
    return this;
  }
  cookie() {
    return [...this.cookies].map(([k, v]) => k + "=" + v).join(";");
  }
}
const test = async (name, fn) => {
  const start = performance.now();
  await fn();
  checks.push({
    name,
    status: "passed",
    ms: Math.round(performance.now() - start),
  });
  console.log("PASS " + name);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const manager = await new Client().login("manager"),
  member = await new Client().login("member"),
  other = await new Client().login("member2"),
  coach = await new Client().login("coach"),
  treasurer = await new Client().login("treasurer"),
  caterer = await new Client().login("caterer"),
  guardian = await new Client().login("guardian"),
  outside = await new Client().login("outside"),
  platform = await new Client().login("platform");
const club = manager.me.clubs.find((c) => c.slug === "demo-harbour").id,
  B = "/api/clubs/" + club,
  memberId = (await member.request(B + "/account")).member.id,
  otherId = (await other.request(B + "/account")).member.id;
const makeActivity = async (overrides = {}) =>
  manager.request(
    B + "/activities",
    "POST",
    {
      title: "QA " + run,
      description: "Isolated automated test activity.",
      kind: "Social",
      sport: "Tennis",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 90000000).toISOString(),
      place: "QA court",
      capacity: 1,
      priceMinor: 0,
      audience: "All",
      teamId: null,
      ...overrides,
    },
    201,
  );
let activity, registration, conversation, hub1, hub2;
try {
  await test("Readiness and explicit API schema", async () => {
    await manager.request("/health/ready");
    const spec = await manager.request("/api/openapi/v1.json");
    assert.ok(
      spec.paths[B.replace(club, "{clubId}") + "/activities"] ||
        Object.keys(spec.paths).some((x) => x.includes("/activities")),
    );
  });
  await test("Anonymous and CSRF protection", async () => {
    await new Client().request(B + "/members", "GET", undefined, 401);
    await new Client().request(
      "/api/auth/login",
      "POST",
      { email: "member@clubline.test", password: "ClublineDemo!2026" },
      400,
    );
  });
  await test("Cross-club isolation on HTTP and administration", async () => {
    await outside.request(B + "/members", "GET", undefined, 403);
    await member.request("/api/admin/clubs", "GET", undefined, 403);
    assert.ok((await platform.request("/api/admin/clubs")).length >= 2);
  });
  await test("Staff roles cannot perform manager or finance operations", async () => {
    for (const c of [member, coach, treasurer, caterer])
      await c.request(B + "/members", "GET", undefined, 403);
    await coach.request(B + "/payments", "GET", undefined, 403);
    await caterer.request(
      B + "/resources",
      "POST",
      { name: "Denied", sport: "Tennis", slotMinutes: 60 },
      403,
    );
    await treasurer.request(
      B + "/content",
      "POST",
      { kind: "Menu", title: "Denied", body: "Denied", published: true },
      403,
    );
  });
  await test("Publish persists notifications and registration capacity is concurrent-safe", async () => {
    activity = await makeActivity();
    await manager.request(
      B + "/activities/" + activity.id + "/publish",
      "POST",
    );
    const before = await pool.query(
      'SELECT count(*)::int n FROM "Notifications" WHERE "ClubId"=$1 AND "OperationKey" LIKE $2',
      [club, "publish:" + activity.id + ":%"],
    );
    await manager.request(
      B + "/activities/" + activity.id + "/publish",
      "POST",
    );
    assert.equal(
      (
        await pool.query(
          'SELECT count(*)::int n FROM "Notifications" WHERE "ClubId"=$1 AND "OperationKey" LIKE $2',
          [club, "publish:" + activity.id + ":%"],
        )
      ).rows[0].n,
      before.rows[0].n,
    );
    const results = await Promise.allSettled(
      [
        [member, memberId],
        [other, otherId],
      ].map(async ([c, id]) => ({
        c,
        id,
        r: await c.request(
          B + "/activities/" + activity.id + "/register",
          "POST",
          { memberId: id, consent: true, joinWaitlist: true },
        ),
      })),
    );
    assert.ok(results.every((r) => r.status === "fulfilled"));
    const values = results.map((x) => x.value);
    assert.deepEqual(values.map((x) => x.r.status).sort(), [
      "Confirmed",
      "Waitlisted",
    ]);
    registration = values.find((x) => x.r.status === "Confirmed");
    const staff = await manager.request(
      B + "/activities/" + activity.id + "/registrations",
    );
    assert.equal(staff.filter((x) => x.status === "Confirmed").length, 1);
    assert.ok(
      (await member.request(B + "/notifications")).some(
        (n) => n.title === activity.title,
      ),
    );
  });
  await test("Attendance updates and waitlist promotion persist", async () => {
    await manager.request(
      B + "/registrations/" + registration.r.id + "/attendance",
      "POST",
      { status: "Present" },
    );
    assert.equal(
      (
        await manager.request(
          B + "/activities/" + activity.id + "/registrations",
        )
      ).find((r) => r.id === registration.r.id).attendance,
      "Present",
    );
    await registration.c.request(
      B + "/registrations/" + registration.r.id + "/cancel",
      "POST",
    );
    assert.equal(
      (
        await manager.request(
          B + "/activities/" + activity.id + "/registrations",
        )
      ).filter((r) => r.status === "Confirmed").length,
      1,
    );
  });
  await test("Guardian cannot register an ineligible linked child", async () => {
    const teams = await manager.request(B + "/teams"),
      team = teams.find((x) => x.sport === "Football");
    const a = await makeActivity({
      teamId: team.id,
      sport: "Football",
      kind: "Training",
    });
    await manager.request(B + "/activities/" + a.id + "/publish", "POST");
    const children = await guardian.request(B + "/family"),
      wrong = children.find((c) => c.sport !== "Football");
    assert.ok(wrong);
    await guardian.request(
      B + "/activities/" + a.id + "/register",
      "POST",
      { memberId: wrong.id, consent: true, joinWaitlist: false },
      403,
    );
  });
  await test("Resource conflicts are serialized across requests", async () => {
    const resource = await manager.request(B + "/resources", "POST", {
        name: "QA resource " + run,
        sport: "Tennis",
        slotMinutes: 60,
      }),
      body = {
        resourceId: resource.id,
        title: "QA " + run,
        startsAt: new Date(Date.now() + 172800000).toISOString(),
        endsAt: new Date(Date.now() + 176400000).toISOString(),
      };
    const results = await Promise.allSettled([
      member.request(B + "/bookings", "POST", body),
      other.request(B + "/bookings", "POST", body),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  });
  await test("Unauthorized conversation and SignalR access are rejected", async () => {
    conversation = (await member.request(B + "/conversations"))[0];
    assert.ok(conversation);
    await outside.request(
      B + "/conversations/" + conversation.id + "/messages",
      "GET",
      undefined,
      403,
    );
    const denied = new HubConnectionBuilder()
      .withUrl(origin + "/hubs/chat", { headers: { Cookie: outside.cookie() } })
      .configureLogging(LogLevel.None)
      .build();
    await denied.start();
    try {
      await assert.rejects(
        denied.invoke("JoinConversation", club, conversation.id, 0),
      );
    } finally {
      await denied.stop();
    }
  });
  await test("Persistent messaging across separate realtime sessions and duplicate sends", async () => {
    hub1 = new HubConnectionBuilder()
      .withUrl(origin + "/hubs/chat", { headers: { Cookie: member.cookie() } })
      .configureLogging(LogLevel.None)
      .build();
    hub2 = new HubConnectionBuilder()
      .withUrl(origin + "/hubs/chat", { headers: { Cookie: other.cookie() } })
      .configureLogging(LogLevel.None)
      .build();
    await Promise.all([hub1.start(), hub2.start()]);
    await Promise.all([
      hub1.invoke("JoinConversation", club, conversation.id, 0),
      hub2.invoke("JoinConversation", club, conversation.id, 0),
    ]);
    const clientMessageId = crypto.randomUUID();
    let received;
    hub2.on("messageAdded", (m) => {
      if (m.clientMessageId === clientMessageId) received = m;
    });
    const sent = await member.request(
      B + "/conversations/" + conversation.id + "/messages",
      "POST",
      { clientMessageId, body: "QA persisted " + run },
    );
    const duplicate = await member.request(
      B + "/conversations/" + conversation.id + "/messages",
      "POST",
      { clientMessageId, body: "QA persisted " + run },
    );
    assert.equal(sent.id, duplicate.id);
    await member.request(
      B + "/conversations/" + conversation.id + "/messages",
      "POST",
      { clientMessageId, body: "Conflicting content" },
      409,
    );
    for (let i = 0; i < 20 && !received; i++) await sleep(100);
    assert.equal(received?.id, sent.id);
    await hub2.stop();
    const offline = await member.request(
      B + "/conversations/" + conversation.id + "/messages",
      "POST",
      {
        clientMessageId: crypto.randomUUID(),
        body: "QA during disconnect " + run,
      },
    );
    await hub2.start();
    const history = await hub2.invoke(
      "JoinConversation",
      club,
      conversation.id,
      sent.sequence,
    );
    assert.ok(history.messages.some((m) => m.id === offline.id));
    await other.request(
      B + "/conversations/" + conversation.id + "/read",
      "POST",
      { through: offline.sequence },
    );
    assert.equal(
      (await other.request(B + "/conversations")).find(
        (c) => c.id === conversation.id,
      ).unreadCount,
      0,
    );
  });
  await test("Logout revokes both HTTP session and realtime connection", async () => {
    let closed = false;
    hub2.onclose(() => {
      closed = true;
    });
    await other.request("/api/auth/logout", "POST");
    await other.request(B + "/account", "GET", undefined, 401);
    for (let i = 0; i < 20 && !closed; i++) await sleep(100);
    assert.ok(closed);
    await other.login("member2");
  });
  await test("Private files enforce ownership and club authorization", async () => {
    const form = new FormData();
    form.set(
      "file",
      new Blob(["QA private file"], { type: "text/plain" }),
      "qa.txt",
    );
    const response = await fetch(origin + B + "/files", {
      method: "POST",
      headers: { Cookie: member.cookie(), "X-CSRF-TOKEN": member.token },
      body: form,
    });
    assert.equal(response.status, 200);
    const f = await response.json();
    await other.request(B + "/files/" + f.id, "GET", undefined, 403);
    await outside.request(B + "/files/" + f.id, "GET", undefined, 403);
  });
  await test("Offline payments and refunds use retry-safe operation keys", async () => {
    const a = await makeActivity({ capacity: 3, priceMinor: 12000 });
    await manager.request(B + "/activities/" + a.id + "/publish", "POST");
    const r = await member.request(
        B + "/activities/" + a.id + "/register",
        "POST",
        { memberId, consent: true, joinWaitlist: false },
      ),
      body = {
        registrationId: r.id,
        reference: "QA bank " + run,
        operationKey: "qa-payment:" + run,
      };
    const p = await treasurer.request(B + "/payments/offline", "POST", body),
      again = await treasurer.request(B + "/payments/offline", "POST", body);
    assert.equal(p.id, again.id);
    const rb = {
        amountMinor: 5000,
        reason: "QA refund",
        operationKey: "qa-refund:" + run,
      },
      rf = await treasurer.request(
        B + "/payments/" + p.id + "/refund",
        "POST",
        rb,
      );
    assert.equal(
      rf.id,
      (await treasurer.request(B + "/payments/" + p.id + "/refund", "POST", rb))
        .id,
    );
    await treasurer.request(
      B + "/refunds/" + rf.id + "/confirm-offline",
      "POST",
      { reason: "QA verified refund " + run },
    );
    await treasurer.request(
      B + "/refunds/" + rf.id + "/confirm-offline",
      "POST",
      { reason: "QA verified refund " + run },
    );
    assert.equal(
      (await treasurer.request(B + "/payments")).find((x) => x.id === p.id)
        .refundedMinor,
      5000,
    );
    await treasurer.request(
      B + "/payments/" + p.id + "/refund",
      "POST",
      { ...rb, amountMinor: 8000, operationKey: crypto.randomUUID() },
      409,
    );
  });
  await test("Signed duplicate provider events are stored once; tampering is rejected", async () => {
    const body = JSON.stringify({
        id: "evt_qa_" + run,
        type: "qa.test",
        livemode: false,
        created: Math.floor(Date.now() / 1000),
        data: { object: {} },
      }),
      t = Math.floor(Date.now() / 1000),
      hash = crypto
        .createHmac("sha256", "clubline-local-webhook-fixture")
        .update(t + "." + body)
        .digest("hex");
    for (let i = 0; i < 2; i++) {
      const r = await fetch(origin + "/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": `t=${t},v1=${hash}`,
        },
        body,
      });
      assert.equal(r.status, 200);
    }
    assert.equal(
      (
        await pool.query(
          'SELECT count(*)::int n FROM "ProviderEvents" WHERE "ProviderId"=$1',
          ["evt_qa_" + run],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await fetch(origin + "/api/webhooks/stripe", {
          method: "POST",
          headers: { "Stripe-Signature": `t=${t},v1=00` },
          body,
        })
      ).status,
      400,
    );
  });
  await test("Disabled providers return explicit configuration errors", async () => {
    await manager.request(
      B + "/billing/checkout",
      "POST",
      { plan: "Club", operationKey: crypto.randomUUID() },
      503,
    );
    await member.request(
      B + "/push-subscriptions",
      "POST",
      {
        endpoint: "https://fcm.googleapis.com/test",
        p256dh: "test",
        auth: "test",
      },
      503,
    );
  });
  await test("Logout and relogin retain saved messages and registrations", async () => {
    await member.request("/api/auth/logout", "POST");
    await member.login("member");
    const messages = await member.request(
      B + "/conversations/" + conversation.id + "/messages?after=0",
    );
    assert.ok(messages.messages.some((m) => m.body === "QA persisted " + run));
    assert.ok(
      (
        await manager.request(
          B + "/activities/" + activity.id + "/registrations",
        )
      ).length === 2,
    );
  });
} finally {
  await Promise.allSettled([hub1?.stop(), hub2?.stop()]);
  await pool.end();
  fs.mkdirSync("docs/evidence", { recursive: true });
  fs.writeFileSync(
    "docs/evidence/api-tests.json",
    JSON.stringify(
      {
        run,
        at: new Date().toISOString(),
        database: "PostgreSQL 17, real transactions",
        checks,
      },
      null,
      2,
    ),
  );
}
console.log(`${checks.length} API/integration checks passed.`);
