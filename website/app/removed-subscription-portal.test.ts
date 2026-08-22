import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const websiteRoot = resolve(__dirname, "..");

test("the public website has no customer subscription-management surface", () => {
  const removedPaths = [
    "app/manage-subscription/page.tsx",
    "app/manage-subscription/manage-subscription-client.tsx",
    "app/auth/callback/route.ts",
    "components/account-portal-shell.tsx",
    "lib/oauth-redirect.ts",
    "lib/account-dashboard.ts",
    "lib/supabase/browser.ts",
    "lib/supabase/server.ts",
    "lib/supabase/route.ts",
    "lib/subscription-intent.ts",
  ];

  for (const path of removedPaths) {
    assert.equal(existsSync(resolve(websiteRoot, path)), false, `${path} must stay removed`);
  }

  const proxy = readFileSync(resolve(websiteRoot, "proxy.ts"), "utf8");
  assert.doesNotMatch(proxy, /manage-subscription|subscription-intent|account-portal/i);

  const siteShell = readFileSync(resolve(websiteRoot, "components/site-shell.tsx"), "utf8");
  assert.doesNotMatch(siteShell, /manage-subscription|Manage Subscription/i);

  const adminPage = readFileSync(resolve(websiteRoot, "app/admin/page.tsx"), "utf8");
  assert.match(adminPage, /FounderDashboardPage/);
  assert.doesNotMatch(siteShell, /admin|founder dashboard/i);
});
