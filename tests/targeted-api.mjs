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
  guardian = await new Client().login("guardian"),
  outside = await new Client().login("outside"),
  club = owner.me.clubs.find((c) => c.slug === "demo-harbour").id,
  B = "/api/clubs/" + club;
try {
  await test("Cancelling two junior registrations notifies their shared guardian once", async () => {
    const children = await guardian.call(B + "/family"),
      a = await owner.call(
        B + "/activities",
        "POST",
        {
          title: "QA family cancellation " + run,
          description: "QA fixture",
          kind: "Social",
          sport: "Tennis",
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          endsAt: new Date(Date.now() + 90000000).toISOString(),
          place: "QA clubhouse",
          capacity: 2,
          priceMinor: 0,
          audience: "All",
        },
        201,
      );
    await owner.call(B + "/activities/" + a.id + "/publish", "POST");
    for (const child of children.slice(0, 2))
      await guardian.call(B + "/activities/" + a.id + "/register", "POST", {
        memberId: child.id,
        consent: true,
        joinWaitlist: false,
      });
    await owner.call(B + "/activities/" + a.id + "/cancel", "POST");
    await owner.call(B + "/activities/" + a.id + "/cancel", "POST");
    assert.ok(
      (await owner.call(B + "/activities/" + a.id + "/registrations")).every(
        (r) => r.status === "Cancelled",
      ),
    );
    const count = await pool.query(
      'SELECT count(*)::int n FROM "Notifications" WHERE "ClubId"=$1 AND "OperationKey"=$2',
      [club, "cancel-activity:" + a.id + ":" + guardian.me.id],
    );
    assert.equal(count.rows[0].n, 1);
  });
  await test("Database composite foreign keys reject cross-club payment links", async () => {
    const foreign = (
        await outside.call("/api/clubs/" + outside.me.clubs[0].id + "/account")
      ).member.id,
      payment = (await owner.call(B + "/payments"))[0];
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await assert.rejects(
        c.query('UPDATE "Payments" SET "MemberId"=$1 WHERE "Id"=$2', [
          foreign,
          payment.id,
        ]),
        (e) => e.code === "23503",
      );
    } finally {
      await c.query("ROLLBACK");
      c.release();
    }
  });
  await test("Database exclusion constraint rejects overlapping bookings independently of the API", async () => {
    const booking = (await owner.call(B + "/bookings"))[0],
      c = await pool.connect();
    assert.ok(booking);
    try {
      await c.query("BEGIN");
      await assert.rejects(
        c.query(
          'INSERT INTO "Bookings" ("Id","ClubId","CreatedAt","ResourceId","UserId","Title","StartsAt","EndsAt","Status") SELECT $1,"ClubId",now(),"ResourceId","UserId",\'QA direct constraint\',"StartsAt","EndsAt",\'Confirmed\' FROM "Bookings" WHERE "Id"=$2',
          [crypto.randomUUID(), booking.id],
        ),
        (e) => e.code === "23P01",
      );
    } finally {
      await c.query("ROLLBACK");
      c.release();
    }
  });
  await test("Re-registration binds receipts to a new attempt and rejects an earlier callback", async () => {
    const member = await new Client().login("member"),
      m = (await member.call(B + "/account")).member,
      a = await owner.call(
        B + "/activities",
        "POST",
        {
          title: "QA re-registration " + run,
          description: "QA attempt isolation fixture",
          kind: "Social",
          sport: "Tennis",
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          endsAt: new Date(Date.now() + 90000000).toISOString(),
          place: "QA room",
          capacity: 1,
          priceMinor: 1000,
          audience: "All",
        },
        201,
      );
    await owner.call(B + "/activities/" + a.id + "/publish", "POST");
    const first = await member.call(
        B + "/activities/" + a.id + "/register",
        "POST",
        { memberId: m.id, consent: true, joinWaitlist: false },
      ),
      input = {
        registrationId: first.id,
        reference: "QA first receipt " + run,
        operationKey: "qa-attempt:" + run,
      },
      p = await owner.call(B + "/payments/offline", "POST", input);
    await member.call(B + "/registrations/" + first.id + "/cancel", "POST");
    const second = await member.call(
      B + "/activities/" + a.id + "/register",
      "POST",
      { memberId: m.id, consent: true, joinWaitlist: false },
    );
    assert.equal(first.id, second.id);
    assert.notEqual(first.attemptId, second.attemptId);
    const accountId = "acct_attempt_" + run,
      checkoutId = "cs_attempt_" + run,
      previous = (
        await pool.query(
          'SELECT "StripeAccountId" FROM "Clubs" WHERE "Id"=$1',
          [club],
        )
      ).rows[0].StripeAccountId;
    try {
      await pool.query(
        'UPDATE "Clubs" SET "StripeAccountId"=$2 WHERE "Id"=$1',
        [club, accountId],
      );
      await pool.query('UPDATE "Payments" SET "ProviderId"=$2 WHERE "Id"=$1', [
        p.id,
        checkoutId,
      ]);
      const event = {
          id: "evt_attempt_" + run,
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
              payment_intent: "pi_attempt_" + run,
              metadata: { paymentId: p.id, clubId: club },
            },
          },
        },
        body = JSON.stringify(event),
        t = event.created,
        sig = crypto
          .createHmac("sha256", "clubline-local-webhook-fixture")
          .update(t + "." + body)
          .digest("hex"),
        response = await fetch(origin + "/api/webhooks/stripe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Stripe-Signature": `t=${t},v1=${sig}`,
          },
          body,
        });
      assert.equal(response.status, 200, await response.text());
      assert.equal(
        (await member.call(B + "/activities/" + a.id)).registrations[0].status,
        "PendingPayment",
      );
      const current = await owner.call(B + "/payments/offline", "POST", {
        ...input,
        reference: "QA second receipt " + run,
      });
      assert.notEqual(current.id, p.id);
      assert.equal(
        (
          await owner.call(B + "/payments/offline", "POST", {
            ...input,
            reference: "QA second receipt " + run,
          })
        ).id,
        current.id,
      );
      assert.equal(
        (await owner.call(B + "/activities/" + a.id + "/registrations")).filter(
          (r) => r.status === "Confirmed",
        ).length,
        1,
      );
    } finally {
      await pool.query(
        'UPDATE "Clubs" SET "StripeAccountId"=$2 WHERE "Id"=$1',
        [club, previous],
      );
    }
  });
  await test("Active-member allowances apply atomically to activation and archived imports", async () => {
    const platform = await new Client().login("platform"),
      created = await owner.call(
        "/api/clubs",
        "POST",
        {
          name: "QA allowance " + run,
          country: "KE",
          currency: "KES",
          timeZone: "Africa/Nairobi",
          sports: ["Tennis"],
          brandColor: "#235c45",
        },
        201,
      ),
      C = "/api/clubs/" + created.id;
    await pool.query(
      'UPDATE "Clubs" SET "IsDemonstration"=true WHERE "Id"=$1',
      [created.id],
    );
    const config = {
      plan: "Trial",
      status: "Trialing",
      memberLimit: 1,
      periodEnd: new Date(Date.now() + 86400000).toISOString(),
      suspended: false,
    };
    await platform.call("/api/admin/clubs/" + created.id, "PUT", config);
    const body = {
        name: "QA archive A",
        email: "archive-a-" + run + "@clubline.test",
        sport: "Tennis",
        junior: false,
        directoryVisible: false,
        emergencyContact: "",
        status: "Inactive",
      },
      a = await owner.call(C + "/members", "POST", body, 201),
      b = await owner.call(
        C + "/members",
        "POST",
        {
          ...body,
          name: "QA archive B",
          email: "archive-b-" + run + "@clubline.test",
        },
        201,
      );
    await owner.call(
      C + "/members/" + a.id,
      "PUT",
      { ...body, status: "Active" },
      409,
    );
    await owner.call(C + "/members/import", "POST", {
      commit: true,
      rows: [
        {
          ...body,
          name: "QA archive import",
          email: "archive-import-" + run + "@clubline.test",
        },
      ],
    });
    await platform.call("/api/admin/clubs/" + created.id, "PUT", {
      ...config,
      memberLimit: 2,
    });
    const results = await Promise.allSettled([
      owner.call(C + "/members/" + a.id, "PUT", { ...body, status: "Active" }),
      owner.call(C + "/members/" + b.id, "PUT", {
        ...body,
        name: "QA archive B",
        email: "archive-b-" + run + "@clubline.test",
        status: "Active",
      }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      (await owner.call(C + "/members")).filter((m) => m.status === "Active")
        .length,
      2,
    );
  });
} finally {
  await pool.end();
  fs.writeFileSync(
    "docs/evidence/targeted-api.json",
    JSON.stringify({ at: new Date().toISOString(), checks }, null, 2),
  );
}
console.log(`${checks.length} targeted API checks passed.`);
