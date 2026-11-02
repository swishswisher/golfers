import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-dev-shm-usage",
      "--no-zygote",
      "--single-process",
    ],
  }),
  base = "http://127.0.0.1:3000",
  checks = [];
const ownerBrowser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: [
    "--no-sandbox",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-dev-shm-usage",
    "--no-zygote",
    "--single-process",
  ],
});
checks.push = function (value) {
  console.log("PASS " + value.name);
  return Array.prototype.push.call(this, value);
};
const owner = await ownerBrowser.newContext(),
  staff = await browser.newContext({ viewport: { width: 390, height: 844 } });
async function api(ctx, path, method = "GET", data) {
  const headers = {};
  if (method !== "GET")
    headers["X-CSRF-TOKEN"] = (
      await (await ctx.request.get(base + "/api/auth/csrf")).json()
    ).token;
  const r = await ctx.request.fetch(base + path, { method, data, headers });
  if (!r.ok())
    throw new Error(
      method + " " + path + " " + r.status() + " " + (await r.text()),
    );
  return r.status() === 204 ? null : r.json();
}
async function login(ctx, who) {
  await api(ctx, "/api/auth/login", "POST", {
    email: who + "@clubline.test",
    password: "ClublineDemo!2026",
  });
  return api(ctx, "/api/auth/me");
}
let membership, ownerCookie, clubId;
const page = await staff.newPage();
try {
  const me = await login(owner, "manager"),
    club = me.clubs.find((c) => c.slug === "demo-harbour").id,
    B = "/api/clubs/" + club,
    people = await api(owner, B + "/staff");
  clubId = club;
  ownerCookie = (await owner.cookies())
    .map((c) => c.name + "=" + c.value)
    .join("; ");
  membership = people.find((p) => p.email === "member2@clubline.test");
  await api(owner, B + "/staff/" + membership.id, "PATCH", {
    email: membership.email,
    role: "ProShop",
  });
  await login(staff, "member2");
  await page.goto(base + "/app/" + club);
  await expect(
    page.getByRole("heading", { name: "Find your next club day." }),
  ).toBeVisible();
  checks.push({ name: "Pro Shop workspace navigation", status: "passed" });
  await page.goto(base + "/app/" + club + "/activities/new");
  await page
    .getByLabel("Title", { exact: true })
    .fill("Pro Shop browser QA " + Date.now());
  await page
    .getByLabel("Description")
    .fill("A coached session with reviewed club terms.");
  await page.getByLabel("Venue").fill("Practice range");
  await page
    .getByLabel("Start in your device time zone")
    .fill(new Date(Date.now() + 259200000).toISOString().slice(0, 16));
  await page
    .getByLabel("End in your device time zone")
    .fill(new Date(Date.now() + 262800000).toISOString().slice(0, 16));
  await page.getByRole("button", { name: "Save & review draft" }).click();
  await page.waitForURL(/\/activities\/[a-f0-9-]+$/);
  const activityPath = new URL(page.url()).pathname;
  await page.getByRole("link", { name: "Edit draft", exact: true }).click();
  await expect(page.getByLabel("Venue")).toHaveValue("Practice range");
  await page.getByLabel("Venue").fill("Practice range B");
  await page.getByRole("button", { name: "Save & review draft" }).click();
  await page.waitForURL(base + activityPath);
  await expect(
    page.getByText("Practice range B", { exact: true }),
  ).toBeVisible();
  checks.push({
    name: "Draft editing preserves activity identity and changes",
    status: "passed",
  });
  await page.getByRole("button", { name: "Publish & notify" }).click();
  await expect(
    page.getByRole("link", { name: "Manage attendance" }),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    page.getByText("Permission required.", { exact: true }),
  ).toHaveCount(0);
  checks.push({
    name: "Pro Shop publishing returns an authorised member preview",
    status: "passed",
  });
  const id = activityPath.split("/").at(-1);
  const data = await api(staff, B + "/activities/" + id);
  if (!data.canManage)
    throw new Error("Owner of Pro Shop activity cannot manage it");
  const managerActivity = await api(owner, B + "/activities", "POST", {
    title: "Owner permission QA " + Date.now(),
    description: "QA author permission fixture",
    kind: "Coaching",
    sport: "Tennis",
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    endsAt: new Date(Date.now() + 90000000).toISOString(),
    place: "QA court",
    capacity: 4,
    priceMinor: 0,
    audience: "All",
  });
  await api(
    owner,
    B + "/activities/" + managerActivity.id + "/publish",
    "POST",
  );
  const other = await api(staff, B + "/activities/" + managerActivity.id);
  if (other.canManage)
    throw new Error("Pro Shop can manage another author activity");
  checks.push({
    name: "Server-provided activity management permission",
    status: "passed",
  });
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Cancel activity", exact: true })
    .click();
  await expect(page.getByText(/Tennis · Cancelled/)).toBeVisible({
    timeout: 60000,
  });
  checks.push({
    name: "Staff activity cancellation persists",
    status: "passed",
  });
  await page.goto(base + "/app/" + club + "/members");
  await expect(
    page.getByRole("heading", { name: "Permission required." }),
  ).toBeVisible();
  checks.push({
    name: "Restricted role sees a permission state",
    status: "passed",
  });
  await page.goto(base + "/app/" + club + "/preferences");
  await page.locator("h1").waitFor();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await staff.setOffline(true);
  await page.goto(base + "/app/" + club + "/feed");
  await expect(
    page.getByRole("heading", { name: "Ready when you reconnect." }),
  ).toBeVisible();
  await staff.setOffline(false);
  await page.goto(base + "/app/" + club + "/preferences");
  await page.locator("h1").waitFor();
  const urls = await page.evaluate(async () => {
    const values = [];
    for (const key of await caches.keys()) {
      for (const r of await (await caches.open(key)).keys())
        values.push(new URL(r.url).pathname);
    }
    return values;
  });
  if (urls.some((x) => x !== "/offline.html"))
    throw new Error("Sensitive content was cached: " + urls);
  checks.push({
    name: "Offline recovery and no authenticated data caching",
    status: "passed",
  });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  if (axe.violations.some((v) => ["critical", "serious"].includes(v.impact)))
    throw new Error("Accessibility regression");
  checks.push({ name: "Mobile preference accessibility", status: "passed" });

  const conversations = await api(staff, B + "/conversations"),
    conversation = conversations[0];
  const ownerPage = await owner.newPage();
  await page.goto(base + "/app/" + club + "/messages/" + conversation.id);
  await ownerPage.goto(base + "/app/" + club + "/messages/" + conversation.id);
  await expect(page.getByText("Connected", { exact: true })).toBeVisible({
    timeout: 45000,
  });
  const first = "Browser QA message " + Date.now();
  await ownerPage.getByLabel("Message to conversation").fill(first);
  await ownerPage.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(first, { exact: true })).toBeVisible({
    timeout: 30000,
  });
  checks.push({
    name: "Two browser sessions exchange persistent messages through the frontend proxy",
    status: "passed",
  });
  await staff.setOffline(true);
  const second = "Browser QA reconnect " + Date.now();
  await ownerPage.getByLabel("Message to conversation").fill(second);
  await ownerPage.getByRole("button", { name: "Send", exact: true }).click();
  await expect(ownerPage.getByText(second, { exact: true })).toBeVisible();
  await staff.setOffline(false);
  await expect(page.getByText(second, { exact: true })).toBeVisible({
    timeout: 45000,
  });
  checks.push({
    name: "Browser messaging recovers saved history after reconnect",
    status: "passed",
  });
  await ownerPage.close();

  const enquiryName = "Browser trial QA " + Date.now();
  await page.goto(base + "/clubs/demo-harbour");
  await page.getByLabel("I am interested in").selectOption("Trial");
  await page.getByLabel("Your name", { exact: true }).fill(enquiryName);
  await page
    .getByLabel("Email address", { exact: true })
    .fill("qa-trial-" + Date.now() + "@clubline.test");
  await page
    .getByLabel("Tell us about the participant and preferred activity")
    .fill("Fictional browser trial enquiry for tennis.");
  await page.getByLabel("I agree to be contacted about this enquiry.").check();
  await page.getByRole("button", { name: "Send enquiry", exact: true }).click();
  await expect(
    page.getByText("Your enquiry has been recorded for review.", {
      exact: false,
    }),
  ).toBeVisible({ timeout: 30000 });
  checks.push({
    name: "Public club trial enquiry is recorded",
    status: "passed",
  });
  const enquiriesPage = await owner.newPage();
  await enquiriesPage.goto(base + "/app/" + club + "/enquiries");
  await enquiriesPage
    .getByLabel("Follow-up for " + enquiryName)
    .selectOption("Contacted");
  await expect(
    enquiriesPage.getByLabel("Follow-up for " + enquiryName),
  ).toHaveValue("Contacted");
  const records = await api(owner, B + "/enquiries");
  if (
    !records.some(
      (e) =>
        e.name === enquiryName &&
        e.kind === "Trial" &&
        e.status === "Contacted",
    )
  )
    throw new Error("Trial follow-up was not persisted");
  checks.push({ name: "Staff enquiry follow-up persists", status: "passed" });
  await enquiriesPage.close();
  const resources = await api(owner, "/api/public/resources");
  if (resources.length) {
    await page.goto(base + "/resources/" + resources[0].slug);
    await expect(
      page.getByRole("heading", { level: 1, name: resources[0].title }),
    ).toBeVisible();
    checks.push({
      name: "Published resource has a direct public page",
      status: "passed",
    });
  }
  await page.goto(base + "/resend-verification");
  await expect(page.getByLabel("Email address")).toBeVisible();
  checks.push({ name: "Email confirmation recovery screen", status: "passed" });
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await staff.setOffline(false).catch(() => {});
  if (membership && ownerCookie) {
    const csrf = await (
      await fetch(base + "/api/auth/csrf", { headers: { Cookie: ownerCookie } })
    ).json();
    const response = await fetch(
      base + "/api/clubs/" + clubId + "/staff/" + membership.id,
      {
        method: "PATCH",
        headers: {
          Cookie: ownerCookie,
          "X-CSRF-TOKEN": csrf.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: membership.email, role: "Member" }),
      },
    );
    if (!response.ok)
      throw new Error("Could not restore QA role: " + response.status);
  }
  fs.writeFileSync(
    "docs/evidence/browser-regression.json",
    JSON.stringify({ at: new Date().toISOString(), checks }, null, 2),
  );
  await browser.close();
  await ownerBrowser.close();
}
console.log(`${checks.length} focused browser checks passed.`);
