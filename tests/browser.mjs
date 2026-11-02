import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
const executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch({
  executablePath,
  args: [
    "--no-sandbox",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-dev-shm-usage",
    "--no-zygote",
    "--single-process",
  ],
});
const checks = [],
  issues = [],
  base = process.env.TEST_WEB_URL || "http://127.0.0.1:3000";
fs.mkdirSync("docs/evidence/screenshots", { recursive: true });
const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage();
page.on("pageerror", (e) => issues.push(e.message));
async function check(path, label, axe = false) {
  const started = performance.now();
  await page.goto(base + path);
  await page.locator("h1").first().waitFor();
  await expect(
    page.getByText("We couldn’t load this page.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Unable to load this page.", { exact: true }),
  ).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 2,
  );
  if (overflow) throw new Error("Horizontal overflow " + path);
  if (axe) {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const serious = result.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact),
    );
    if (serious.length)
      throw new Error(
        "Accessibility " +
          path +
          ": " +
          JSON.stringify(
            serious.map((v) => ({
              id: v.id,
              nodes: v.nodes.map((n) => n.target),
            })),
          ),
      );
  }
  checks.push({
    label,
    path,
    width: page.viewportSize().width,
    ms: Math.round(performance.now() - started),
    status: "passed",
  });
  console.log("PASS " + label);
}
async function login(who) {
  await page.goto(base + "/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(who + "@clubline.test");
  await page.getByLabel("Password", { exact: true }).fill("ClublineDemo!2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/app\//, { timeout: 60000 });
  return page.url().match(/\/app\/([^/]+)/)[1];
}
try {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of [
      "/",
      "/platform",
      "/sports",
      "/solutions",
      "/pricing",
      "/experience",
      "/about",
      "/trust",
      "/contact",
      "/demo",
      "/resources",
      "/login",
      "/signup",
    ])
      await check(path, "Public " + path, true);
    await page.goto(base + "/");
    await page.screenshot({
      path: `docs/evidence/screenshots/home-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const club = await login("manager");
  for (const path of [
    "",
    "/members",
    "/activities",
    "/activities/new",
    "/teams",
    "/bookings",
    "/messages",
    "/payments",
    "/refunds",
    "/reports",
    "/website",
    "/automations",
    "/settings",
    "/billing",
    "/delivery",
    "/support",
    "/preferences",
    "/enquiries",
    "/audit",
  ])
    await check(
      "/app/" + club + path,
      "Manager " + (path || "overview"),
      ["", "/members", "/payments", "/activities/new"].includes(path),
    );
  await page.goto(base + "/app/" + club);
  await page.locator("h1").waitFor();
  await page.screenshot({
    path: "docs/evidence/screenshots/manager-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "",
    "/members",
    "/activities",
    "/messages",
    "/payments",
    "/settings",
    "/billing",
    "/preferences",
  ])
    await check("/app/" + club + path, "Mobile manager " + path, true);
  await page.goto(base + "/app/" + club);
  await page.locator("h1").waitFor();
  await page.screenshot({
    path: "docs/evidence/screenshots/manager-mobile.png",
    fullPage: true,
  });
  // Real form-driven publish → member registration → manager attendance.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/app/" + club + "/activities/new");
  const title = "Browser QA " + Date.now();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page
    .getByLabel("Description")
    .fill("Browser-tested session with recorded registration.");
  await page.getByLabel("Venue").fill("QA court");
  await page
    .getByLabel("Start in your device time zone")
    .fill(new Date(Date.now() + 172800000).toISOString().slice(0, 16));
  await page
    .getByLabel("End in your device time zone")
    .fill(new Date(Date.now() + 176400000).toISOString().slice(0, 16));
  await page.getByRole("button", { name: "Save & review draft" }).click();
  await page.waitForURL(/\/activities\/[a-f0-9-]+$/, { timeout: 60000 });
  const activityPath = new URL(page.url()).pathname;
  await page.getByRole("button", { name: "Publish & notify" }).click();
  await page.waitForURL(/\/delivery/, { timeout: 60000 });
  await context.clearCookies();
  await login("member");
  await page.goto(base + activityPath);
  await page.getByLabel("Who is joining?").selectOption({ index: 1 });
  await page
    .getByLabel(
      "I accept the activity terms and am the participant or an authorised guardian.",
    )
    .check();
  await page.getByRole("button", { name: "Register for session" }).click();
  await expect(
    page.getByText("Your registration has been recorded.", { exact: false }),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  checks.push({
    label: "Form-driven publish and member registration",
    status: "passed",
  });
  for (const p of [
    "/feed",
    "/activities",
    "/messages",
    "/notifications",
    "/membership",
    "/directory",
    "/preferences",
  ])
    await check("/app/" + club + p, "Member " + p, true);
  await page.goto(base + "/app/" + club + "/feed");
  await page.locator("h1").waitFor();
  await page.screenshot({
    path: "docs/evidence/screenshots/member-desktop.png",
    fullPage: true,
  });
  await context.clearCookies();
  await login("manager");
  await page.goto(base + activityPath + "/attendance");
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Undo check-in" })).toBeVisible(
    { timeout: 60000 },
  );
  checks.push({
    label: "Form-driven attendance counts update",
    status: "passed",
  });
  for (const [who, paths] of [
    ["coach", ["/teams", "/activities", "/attendance"]],
    ["treasurer", ["/payments", "/refunds", "/reports"]],
    ["caterer", ["/catering", "/activities"]],
    ["guardian", ["/family", "/activities", "/preferences"]],
  ]) {
    await context.clearCookies();
    await login(who);
    for (const p of paths) await check("/app/" + club + p, who + " " + p, true);
  }
  await context.clearCookies();
  await page.goto(base + "/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("platform@clubline.test");
  await page.getByLabel("Password", { exact: true }).fill("ClublineDemo!2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/admin/, { timeout: 60000 });
  for (const p of [
    "",
    "/clubs",
    "/support",
    "/enquiries",
    "/content",
    "/audit",
  ])
    await check("/admin" + p, "Platform " + p, true);
  if (issues.length) throw new Error("Browser errors: " + issues.join("\n"));
} finally {
  fs.writeFileSync(
    "docs/evidence/browser-tests.json",
    JSON.stringify(
      { at: new Date().toISOString(), checks, pageErrors: issues },
      null,
      2,
    ),
  );
  await browser.close();
}
console.log(`${checks.length} browser checks passed.`);
