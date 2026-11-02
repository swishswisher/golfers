import fs from "node:fs";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:5225",
  cookies = new Map();
async function call(path, method = "GET", body, token) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Cookie: [...cookies].map(([k, v]) => k + "=" + v).join(";"),
      "Content-Type": "application/json",
      ...(token ? { "X-CSRF-TOKEN": token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  for (const c of r.headers.getSetCookie()) {
    const a = c.split(";")[0],
      i = a.indexOf("=");
    cookies.set(a.slice(0, i), a.slice(i + 1));
  }
  assert.equal(r.status, 200);
  return r.json();
}
const token = (await call("/api/auth/csrf")).token;
await call(
  "/api/auth/login",
  "POST",
  { email: "manager@clubline.test", password: "ClublineDemo!2026" },
  token,
);
const me = await call("/api/auth/me"),
  club = me.clubs.find((c) => c.slug === "demo-harbour").id,
  samples = [];
for (let i = 0; i < 12; i++) {
  const t = performance.now(),
    r = await call("/api/clubs/" + club + "/activities");
  samples.push(performance.now() - t);
  assert.ok(r.length > 0);
}
samples.sort((a, b) => a - b);
const result = {
  at: new Date().toISOString(),
  scenario:
    "Authenticated bounded activity list, real PostgreSQL over local TLS-WebSocket proxy",
  requests: samples.length,
  medianMs: Math.round(samples[6]),
  p95Ms: Math.round(samples[11]),
  limit: 100,
  scaleClaim: "Smoke measurement only; not an internet-scale load test",
};
assert.ok(
  result.p95Ms < 5000,
  "Activity list performance exceeded the smoke budget",
);
fs.writeFileSync(
  "docs/evidence/performance.json",
  JSON.stringify(result, null, 2),
);
console.log(result);
