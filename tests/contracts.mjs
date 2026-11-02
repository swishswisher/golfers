import { z } from "zod";
import assert from "node:assert/strict";
import fs from "node:fs";
const base = "http://127.0.0.1:5225",
  jar = new Map(),
  checks = [];
async function request(path, method = "GET", body, token, status = 200) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Cookie: [...jar].map(([k, v]) => k + "=" + v).join(";"),
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
  assert.equal(r.status, status);
  return r.json();
}
const token = (await request("/api/auth/csrf")).token;
await request(
  "/api/auth/login",
  "POST",
  { email: "manager@clubline.test", password: "ClublineDemo!2026" },
  token,
);
const clubSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  country: z.string().length(2),
  currency: z.string().length(3),
  timeZone: z.string(),
  sports: z.array(z.string()),
  brandColor: z.string().regex(/^#[\da-f]{6}$/i),
  isDemonstration: z.boolean(),
  role: z.enum([
    "Owner",
    "Manager",
    "Coach",
    "ProShop",
    "Treasurer",
    "Caterer",
    "Member",
    "Guardian",
  ]),
});
const me = z
  .object({
    id: z.string(),
    displayName: z.string(),
    email: z.email(),
    isPlatformAdmin: z.boolean(),
    clubs: z.array(clubSchema),
  })
  .parse(await request("/api/auth/me"));
checks.push("Session and club contract");
const club = me.clubs.find((c) => c.slug === "demo-harbour").id,
  B = "/api/clubs/" + club;
const activity = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  kind: z.string(),
  sport: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  capacity: z.number().int().positive(),
  priceMinor: z.number().int().nonnegative(),
  registeredCount: z.number().int().nonnegative(),
  status: z.string(),
});
const list = z.array(activity).parse(await request(B + "/activities"));
z.object({
  activity,
  canManage: z.boolean(),
  participants: z.array(z.object({ id: z.uuid(), name: z.string() })),
  registrations: z.array(z.object({ id: z.uuid(), status: z.string() })),
}).parse(await request(B + "/activities/" + list[0].id));
checks.push("Activity list and member detail contract");
const conversations = await request(B + "/conversations");
z.object({
  messages: z.array(
    z.object({
      id: z.uuid(),
      clientMessageId: z.uuid(),
      sequence: z.number().int(),
      body: z.string(),
      senderId: z.string(),
      senderName: z.string(),
      createdAt: z.string(),
    }),
  ),
  nextCursor: z.number().int(),
}).parse(
  await request(B + "/conversations/" + conversations[0].id + "/messages"),
);
checks.push("Cursor message history contract");
z.object({
  subscription: z.object({
    id: z.uuid(),
    plan: z.string(),
    status: z.string(),
    memberLimit: z.number().int(),
    periodEnd: z.string(),
    cancelAtPeriodEnd: z.boolean(),
  }),
  invoices: z.array(
    z.object({
      id: z.uuid(),
      amountMinor: z.number().int(),
      currency: z.string(),
    }),
  ),
  onlineBillingAvailable: z.boolean(),
  memberFeesAreSeparate: z.literal(true),
}).parse(await request(B + "/billing"));
checks.push("Subscription and invoice contract");
z.object({
  type: z.string(),
  title: z.string(),
  status: z.literal(403),
  traceId: z.string(),
}).parse(await request("/api/admin/clubs", "GET", undefined, undefined, 403));
checks.push("Problem Details permission contract");
const spec = await request("/api/openapi/v1.json");
fs.writeFileSync("docs/openapi.json", JSON.stringify(spec, null, 2) + "\n");
fs.writeFileSync(
  "docs/evidence/contracts.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      checks: checks.map((name) => ({ name, status: "passed" })),
    },
    null,
    2,
  ),
);
console.log(`${checks.length} API contract checks passed.`);
