import { expect, test, type Page } from "@playwright/test";

const adminEmail = process.env.FORMIE_E2E_ADMIN_EMAIL;
const adminPassword = process.env.FORMIE_E2E_ADMIN_PASSWORD;
const creatorEmail = process.env.FORMIE_E2E_CREATOR_EMAIL;
const creatorPassword = process.env.FORMIE_E2E_CREATOR_PASSWORD;

async function signIn(page: Page, route: "/admin/login" | "/creators/login", email: string, password: string) {
  await page.goto(route);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(route === "/admin/login" ? /\/admin$/ : /\/creators$/, { timeout: 30_000 });
}

test.describe("founder business dashboard", () => {
  test.skip(!adminEmail || !adminPassword, "Set isolated founder E2E credentials to exercise authenticated business operations.");

  test.beforeEach(async ({ page }) => signIn(page, "/admin/login", adminEmail!, adminPassword!));

  test("navigates all real reporting sections and applies bounded filters", async ({ page }) => {
    await expect(page.getByText("Founder dashboard")).toBeVisible();
    for (const [name, route] of [["Revenue", "/admin/revenue"], ["Creators", "/admin/creators"], ["Growth", "/admin/growth"], ["Overview", "/admin"]] as const) {
      await page.getByRole("link", { name }).click();
      await expect.poll(() => new URL(page.url()).pathname).toBe(route);
      await expect(page.locator("main")).toBeVisible();
    }
    await page.getByRole("link", { name: "7 days" }).click();
    await expect(page).toHaveURL(/window=7d/);
    await page.getByLabel("From").fill("2026-08-01");
    await page.getByLabel("To").fill("2026-08-31");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/window=custom.*start=2026-08-01.*end=2026-08-31/);
  });

  test("renders creator operations and remains usable on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/creators");
    await expect(page.getByRole("heading", { name: "Links, conversions, bonuses, and payouts" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add creator and create invitation" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  (process.env.FORMIE_E2E_PROVISION_CREATOR === "true" ? test : test.skip)("can provision an isolated creator invitation when explicitly enabled", async ({ page }) => {
    await page.goto("/admin/creators");
    const suffix = crypto.randomUUID().slice(0, 8);
    await page.getByLabel("Display name").fill(`E2E Creator ${suffix}`);
    await page.getByLabel("Portal email").fill(`creator-${suffix}@example.test`);
    await page.getByLabel("Commission %").fill("15");
    await page.getByRole("button", { name: "Add creator and create invitation" }).click();
    await expect(page.getByRole("status")).toContainText("Creator provisioned");
    await expect(page.getByLabel("Invitation link")).toHaveValue(/^https:\/\//);
  });

  (process.env.FORMIE_E2E_APPLE_REPORT_PATH ? test : test.skip)("imports a fixture Apple report when a path is configured", async ({ page }) => {
    await page.goto("/admin/revenue");
    await page.locator('input[name="report"]').setInputFiles(process.env.FORMIE_E2E_APPLE_REPORT_PATH!);
    await page.getByRole("button", { name: "Validate and reconcile" }).click();
    await expect(page.getByRole("status")).toContainText(/reconciled|allocated|pending/i);
  });
});

test.describe("creator-owned portal", () => {
  test.skip(!creatorEmail || !creatorPassword, "Set an isolated creator membership to exercise tenant-scoped reporting.");

  test.beforeEach(async ({ page }) => signIn(page, "/creators/login", creatorEmail!, creatorPassword!));

  test("shows only the authenticated creator and ignores tenant query parameters", async ({ page }) => {
    const creatorName = await page.locator(".creator-brand small").textContent();
    await page.goto("/creators?creatorId=00000000-0000-0000-0000-000000000000");
    await expect(page.locator(".creator-brand small")).toHaveText(creatorName ?? "");
    await expect(page.getByRole("button", { name: "Copy creator code" })).toBeVisible();
  });

  test("navigates referrals, earnings, and account without exposing personal activity", async ({ page }) => {
    for (const [name, heading] of [["referrals", "Attributed accounts"], ["earnings", "Payout ledger"]] as const) {
      await page.getByRole("link", { name }).click();
      await expect(page.getByRole("heading", { name: heading, exact: false })).toBeVisible();
      await expect(page.getByText(/exercise activity|demographic/i)).toHaveCount(name === "referrals" ? 1 : 0);
    }
    const statement = await page.request.get("/creators/earnings/statement");
    expect(statement.status()).toBe(200);
    expect(statement.headers()["content-type"]).toContain("text/csv");
    expect(await statement.text()).toMatch(/^"Entry ID","Type","Amount","Currency","Status"/);
    await page.getByRole("link", { name: "account" }).click();
    await expect(page.locator(".creator-hero h1")).toBeVisible();
    await expect(page.getByLabel("New password")).toBeVisible();
  });
});
