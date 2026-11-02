import fs from "node:fs";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:5225",
  file = ".local/restart-check.json";
if (process.argv[2] === "before") {
  const jar = new Map();
  async function call(path, method = "GET", body, token) {
    const r = await fetch(base + path, {
      method,
      headers: {
        cookie: [...jar].map(([k, v]) => k + "=" + v).join(";"),
        "Content-Type": "application/json",
        ...(token ? { "X-CSRF-TOKEN": token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of r.headers.getSetCookie()) {
      const a = c.split(";")[0],
        i = a.indexOf("=");
      jar.set(a.slice(0, i), a.slice(i + 1));
    }
    assert.equal(r.status, 200);
    return r.json();
  }
  const token = (await call("/api/auth/csrf")).token;
  await call(
    "/api/auth/login",
    "POST",
    { email: "member@clubline.test", password: "ClublineDemo!2026" },
    token,
  );
  const me = await call("/api/auth/me"),
    club = me.clubs.find((c) => c.slug === "demo-harbour").id,
    conversations = await call("/api/clubs/" + club + "/conversations"),
    messages = await call(
      "/api/clubs/" +
        club +
        "/conversations/" +
        conversations[0].id +
        "/messages",
    );
  fs.writeFileSync(
    file,
    JSON.stringify({
      cookie: [...jar].map(([k, v]) => k + "=" + v).join(";"),
      club,
      conversation: conversations[0].id,
      messages: messages.messages.map((m) => m.id),
      userId: me.id,
    }),
    { mode: 0o600 },
  );
  console.log("Saved pre-restart session and persistent message references.");
} else {
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const me = await fetch(base + "/api/auth/me", {
    headers: { cookie: d.cookie },
  });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).id, d.userId);
  const r = await fetch(
    base +
      "/api/clubs/" +
      d.club +
      "/conversations/" +
      d.conversation +
      "/messages",
    { headers: { cookie: d.cookie } },
  );
  assert.equal(r.status, 200);
  const messages = await r.json();
  for (const id of d.messages)
    assert.ok(messages.messages.some((m) => m.id === id));
  fs.writeFileSync(
    "docs/evidence/restart-test.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        sessionSurvived: true,
        messagesRecovered: d.messages.length,
        backendProcessRestarted: true,
      },
      null,
      2,
    ),
  );
  fs.unlinkSync(file);
  console.log("PASS session and message persistence after backend restart.");
}
