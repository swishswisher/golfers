import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import pg from "pg";
const origin = "http://127.0.0.1:5225",
  run = Date.now().toString(),
  checks = [];
const cfg = JSON.parse(fs.readFileSync(".local/settings.json", "utf8")),
  parts = Object.fromEntries(
    (cfg.localConnectionString || cfg.connectionString).split(";").map((x) => {
      const i = x.indexOf("=");
      return [x.slice(0, i), x.slice(i + 1).replace(/^"|"$/g, "")];
    }),
  ),
  pool = new pg.Pool({
    host: parts.Host,
    port: Number(parts.Port),
    user: parts.Username,
    password: parts.Password,
    database: parts.Database,
    max: 5,
    connectionTimeoutMillis: 15000,
  });
class Client {
  cookies = new Map();
  token = "";
  async call(path, method = "GET", body, status = 200) {
    const r = await fetch(origin + path, {
      method,
      headers: {
        Cookie: [...this.cookies].map(([k, v]) => k + "=" + v).join(";"),
        "Content-Type": "application/json",
        ...(this.token ? { "X-CSRF-TOKEN": this.token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of r.headers.getSetCookie()) {
      const a = c.split(";")[0],
        i = a.indexOf("=");
      this.cookies.set(a.slice(0, i), a.slice(i + 1));
    }
    const data = await r.json().catch(() => null);
    assert.equal(
      r.status,
      status === 200 && r.status === 204 ? 204 : status,
      `${method} ${path}: ${JSON.stringify(data)}`,
    );
    return data;
  }
  async csrf() {
    this.token = (await this.call("/api/auth/csrf")).token;
  }
  async login(name) {
    await this.csrf();
    await this.call("/api/auth/login", "POST", {
      email: name.includes("@") ? name : name + "@clubline.test",
      password: "ClublineDemo!2026",
    });
    await this.csrf();
    this.me = await this.call("/api/auth/me");
    return this;
  }
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms)),
  test = async (name, fn) => {
    await fn();
    checks.push({ name, status: "passed" });
    console.log("PASS " + name);
  },
  poll = async (fn, seconds = 90) => {
    for (let i = 0; i < seconds; i++) {
      const value = await fn();
      if (value) return value;
      await delay(1000);
    }
    throw new Error("Timed out waiting for persisted background operation");
  };
const owner = await new Client().login("manager"),
  member = await new Client().login("member"),
  platform = await new Client().login("platform"),
  club = owner.me.clubs.find((c) => c.slug === "demo-harbour").id,
  B = "/api/clubs/" + club,
  account = await member.call(B + "/account");
try {
  await test("Membership fee assignment, verified payment and renewal are retry-safe", async () => {
    const until = new Date(Date.now() + 365 * 86400000).toISOString(),
      body = {
        memberId: account.member.id,
        amountMinor: 50000,
        description: "QA annual membership " + run,
        renewalUntil: until,
        operationKey: "membership:" + run,
      };
    const p = await owner.call(B + "/fees", "POST", body);
    assert.equal((await owner.call(B + "/fees", "POST", body)).id, p.id);
    assert.ok(
      (await member.call(B + "/my-payments")).some((x) => x.id === p.id),
    );
    await member.call(
      B + "/payments/" + p.id + "/verify-offline",
      "POST",
      { reason: "forged" },
      403,
    );
    await owner.call(B + "/payments/" + p.id + "/verify-offline", "POST", {
      reason: "QA bank " + run,
    });
    await owner.call(B + "/payments/" + p.id + "/verify-offline", "POST", {
      reason: "QA bank " + run,
    });
    assert.equal(
      new Date((await member.call(B + "/account")).member.renewalAt).getTime(),
      new Date(until).getTime(),
    );
  });
  await test("Reminder automation creates one persistent notification across worker retries", async () => {
    await owner.call(B + "/automations/Reminder", "PUT", {
      enabled: true,
      offsetHours: 24,
      template: "QA reminder for {club}",
    });
    const a = await owner.call(
      B + "/activities",
      "POST",
      {
        title: "QA reminder " + run,
        description: "QA fixture",
        kind: "Social",
        sport: "Tennis",
        startsAt: new Date(Date.now() + 3600000).toISOString(),
        endsAt: new Date(Date.now() + 7200000).toISOString(),
        place: "QA room",
        capacity: 4,
        priceMinor: 0,
        audience: "All",
      },
      201,
    );
    await owner.call(B + "/activities/" + a.id + "/publish", "POST");
    const r = await member.call(
      B + "/activities/" + a.id + "/register",
      "POST",
      { memberId: account.member.id, consent: true, joinWaitlist: false },
    );
    await poll(async () => {
      const row = await pool.query(
        'SELECT count(*)::int n FROM "Notifications" WHERE "ClubId"=$1 AND "OperationKey"=$2',
        [club, "reminder:" + r.id],
      );
      return row.rows[0].n === 1;
    });
    await pool.query(
      'UPDATE "AutomationRules" SET "LastRunAt"=NULL WHERE "ClubId"=$1 AND "Kind"=\'Reminder\'',
      [club],
    );
    await delay(4000);
    assert.equal(
      (
        await pool.query(
          'SELECT count(*)::int n FROM "Notifications" WHERE "ClubId"=$1 AND "OperationKey"=$2',
          [club, "reminder:" + r.id],
        )
      ).rows[0].n,
      1,
    );
    await owner.call(B + "/automations/Reminder", "PUT", {
      enabled: false,
      offsetHours: 24,
      template: "QA disabled",
    });
  });
  await test("Email opt-out prevents notification email jobs", async () => {
    await member.call(B + "/preferences", "PUT", {
      email: false,
      push: false,
      digest: false,
      language: "en",
      timeZone: "Africa/Nairobi",
    });
    const a = await owner.call(
      B + "/activities",
      "POST",
      {
        title: "QA preference " + run,
        description: "QA fixture",
        kind: "Announcement",
        sport: "Tennis",
        startsAt: new Date().toISOString(),
        endsAt: new Date().toISOString(),
        place: "Club",
        capacity: 1,
        priceMinor: 0,
        audience: "All",
      },
      201,
    );
    await owner.call(B + "/activities/" + a.id + "/publish", "POST");
    const rows = await pool.query(
      'SELECT count(*)::int n FROM "Outbox" WHERE "OperationKey"=$1',
      ["email:publish:" + a.id + ":" + member.me.id],
    );
    assert.equal(rows.rows[0].n, 0);
    await member.call(B + "/preferences", "PUT", {
      email: true,
      push: false,
      digest: true,
      language: "en",
      timeZone: "Africa/Nairobi",
    });
  });
  await test("Sign-up, email confirmation, club creation, invitation acceptance and welcome persist", async () => {
    const newcomer = new Client(),
      email = "qa-" + run + "@clubline.test";
    await newcomer.csrf();
    await newcomer.call("/api/auth/register", "POST", {
      name: "QA newcomer " + run,
      email,
      password: "ClublineDemo!2026",
    });
    await newcomer.call(
      "/api/auth/login",
      "POST",
      { email, password: "ClublineDemo!2026" },
      401,
    );
    const mail = await poll(async () => {
      const inbox = await newcomer.call("/api/development/inbox");
      return inbox.find(
        (x) =>
          x.recipient === email && x.subject === "Confirm your Clubline email",
      );
    });
    const link = new URL(mail.body.match(/https?:\/\/\S+/)[0]);
    await newcomer.call("/api/auth/verify", "POST", {
      userId: link.searchParams.get("userId"),
      token: link.searchParams.get("token"),
    });
    await newcomer.login(email);
    const created = await newcomer.call(
      "/api/clubs",
      "POST",
      {
        name: "QA Tokyo " + run,
        country: "JP",
        currency: "JPY",
        timeZone: "Asia/Tokyo",
        sports: ["Martial arts"],
        brandColor: "#235c45",
      },
      201,
    );
    await pool.query(
      'UPDATE "Clubs" SET "IsDemonstration"=true WHERE "Id"=$1',
      [created.id],
    );
    assert.equal(
      (await newcomer.call("/api/clubs/" + created.id + "/")).currency,
      "JPY",
    );
    await owner.call(B + "/automations/Welcome", "PUT", {
      enabled: true,
      offsetHours: 24,
      template: "QA welcome to {club}",
    });
    await owner.call(B + "/invitations", "POST", { email, role: "Member" });
    const invite = await poll(async () => {
      const inbox = await newcomer.call("/api/development/inbox");
      return inbox.find(
        (x) =>
          x.recipient === email && x.subject === "Join your club on Clubline",
      );
    });
    const token = new URL(
      invite.body.match(/https?:\/\/\S+/)[0],
    ).searchParams.get("token");
    await newcomer.call("/api/invitations/accept", "POST", { token });
    assert.equal(
      (await newcomer.call("/api/invitations/accept", "POST", { token }))
        .clubId,
      club,
    );
    assert.ok(
      (await newcomer.call(B + "/notifications")).some(
        (n) => n.title === "Welcome to Harbour Sports Club",
      ),
    );
  });
  await test("Support responses and public CMS writes are stored and audited", async () => {
    const t = await member.call("/api/support", "POST", {
      clubId: club,
      subject: "QA support " + run,
      body: "QA request",
    });
    await platform.call("/api/admin/support/" + t.id, "PATCH", {
      status: "Resolved",
      response: "QA response " + run,
    });
    assert.equal(
      (await member.call("/api/support")).find((x) => x.id === t.id).response,
      "QA response " + run,
    );
    const c = await platform.call("/api/admin/content", "POST", {
      slug: "qa-" + run,
      title: "QA resource " + run,
      body: "QA published resource",
      published: true,
    });
    assert.ok(
      (await owner.call("/api/public/resources")).some((x) => x.id === c.id),
    );
    await platform.call("/api/admin/content/" + c.id, "PUT", {
      slug: "qa-" + run,
      title: c.title,
      body: "QA unpublished resource",
      published: false,
    });
    assert.ok(
      !(await owner.call("/api/public/resources")).some((x) => x.id === c.id),
    );
    assert.ok(
      (await platform.call("/api/admin/audit")).some(
        (x) => x.action === "Created public resource",
      ),
    );
  });
  await test("Expired reservations release capacity before late payments are reviewed", async () => {
    const a = await owner.call(
      B + "/activities",
      "POST",
      {
        title: "QA expiry " + run,
        description: "QA fixture",
        kind: "Social",
        sport: "Tennis",
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 90000000).toISOString(),
        place: "QA court",
        capacity: 1,
        priceMinor: 1000,
        audience: "All",
      },
      201,
    );
    await owner.call(B + "/activities/" + a.id + "/publish", "POST");
    const r = await member.call(
      B + "/activities/" + a.id + "/register",
      "POST",
      { memberId: account.member.id, consent: true, joinWaitlist: false },
    );
    await pool.query(
      'UPDATE "Registrations" SET "ReservationExpiresAt"=now()-interval \'1 minute\' WHERE "Id"=$1',
      [r.id],
    );
    await poll(async () => {
      const rows = await pool.query(
        'SELECT "Status" FROM "Registrations" WHERE "Id"=$1',
        [r.id],
      );
      return rows.rows[0].Status === "Expired";
    });
    assert.equal(
      (await member.call(B + "/activities/" + a.id)).activity.registeredCount,
      0,
    );
    const accountId = "acct_qa_" + run,
      paymentId = crypto.randomUUID(),
      checkoutId = "cs_qa_" + run;
    const previous = (
      await pool.query('SELECT "StripeAccountId" FROM "Clubs" WHERE "Id"=$1', [
        club,
      ])
    ).rows[0].StripeAccountId;
    try {
      await pool.query(
        'UPDATE "Clubs" SET "StripeAccountId"=$2 WHERE "Id"=$1',
        [club, accountId],
      );
      await pool.query(
        'INSERT INTO "Payments" ("Id","ClubId","RegistrationId","RegistrationAttemptId","UserId","Purpose","AmountMinor","Currency","Status","OperationKey","ProviderId","RefundedMinor","CreatedAt","Description") VALUES ($1,$2,$3,$7,$4,\'Activity\',1000,\'KES\',\'Pending\',$5,$6,0,now(),\'Simulated signed QA event; no external charge\')',
        [
          paymentId,
          club,
          r.id,
          member.me.id,
          "qa-late:" + run,
          checkoutId,
          r.attemptId,
        ],
      );
      const event = {
          id: "evt_late_" + run,
          type: "checkout.session.completed",
          created: Math.floor(Date.now() / 1000),
          livemode: false,
          account: accountId,
          data: {
            object: {
              id: checkoutId,
              payment_status: "paid",
              amount_total: 1000,
              currency: "kes",
              payment_intent: "pi_qa_" + run,
              metadata: { paymentId, clubId: club },
            },
          },
        },
        body = JSON.stringify(event),
        t = Math.floor(Date.now() / 1000),
        signature = crypto
          .createHmac("sha256", "clubline-local-webhook-fixture")
          .update(t + "." + body)
          .digest("hex");
      for (let i = 0; i < 2; i++) {
        const response = await fetch(origin + "/api/webhooks/stripe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Stripe-Signature": `t=${t},v1=${signature}`,
          },
          body,
        });
        assert.equal(response.status, 200, await response.text());
      }
      assert.equal(
        (
          await pool.query('SELECT "Status" FROM "Payments" WHERE "Id"=$1', [
            paymentId,
          ])
        ).rows[0].Status,
        "PaidNeedsReview",
      );
      assert.equal(
        (await member.call(B + "/activities/" + a.id)).activity.registeredCount,
        0,
      );
      const input = {
          amountMinor: 1000,
          reason: "Simulated QA late-payment recovery; no external charge",
          operationKey: "qa-late-refund:" + run,
        },
        refund = await owner.call(
          B + "/payments/" + paymentId + "/refund",
          "POST",
          input,
        );
      assert.equal(
        (
          await owner.call(
            B + "/payments/" + paymentId + "/refund",
            "POST",
            input,
          )
        ).id,
        refund.id,
      );
      const job = await poll(async () => {
        const rows = await pool.query(
          'SELECT "Id","Status","OperationKey" FROM "Outbox" WHERE "OperationKey"=$1',
          ["refund:" + refund.id],
        );
        return rows.rows[0]?.Status === "Blocked" ? rows.rows[0] : null;
      });
      await owner.call(B + "/delivery/" + job.Id + "/retry", "POST");
      await poll(async () => {
        const rows = await pool.query(
          'SELECT "Status" FROM "Outbox" WHERE "Id"=$1',
          [job.Id],
        );
        return rows.rows[0].Status === "Blocked";
      });
      assert.equal(
        (
          await pool.query(
            'SELECT count(*)::int n FROM "Outbox" WHERE "OperationKey"=$1',
            [job.OperationKey],
          )
        ).rows[0].n,
        1,
      );
    } finally {
      await pool.query(
        'UPDATE "Clubs" SET "StripeAccountId"=$2 WHERE "Id"=$1',
        [club, previous],
      );
    }
  });
} finally {
  await pool.end();
  fs.writeFileSync(
    "docs/evidence/advanced-tests.json",
    JSON.stringify({ at: new Date().toISOString(), checks }, null, 2),
  );
}
console.log(`${checks.length} advanced workflow checks passed.`);
