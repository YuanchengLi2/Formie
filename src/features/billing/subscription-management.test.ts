import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { subscriptionManagementCopy } from "@/features/billing/subscription-management";

const routeSource = readFileSync(resolve(__dirname, "../../app/account/manage-subscription.tsx"), "utf8");

describe("native subscription management copy", () => {
  it("distinguishes cancellation from renewal without changing the paid-through period", () => {
    expect(subscriptionManagementCopy("active_cancelled", "2026-08-11T02:34:50Z")).toMatchObject({ title: "Automatic renewal is off" });
    expect(subscriptionManagementCopy("active_renewing", "2026-08-11T02:34:50Z")).toMatchObject({ title: "Automatic renewal is on" });
  });

  it("describes provider reconciliation at the renewal boundary", () => {
    expect(subscriptionManagementCopy("renewal_pending", "2026-08-11T02:34:50Z")).toMatchObject({ title: "Checking the next billing period" });
  });
});

describe("native subscription management route", () => {
  it("uses one provider-management action and relies on automatic entitlement refresh", () => {
    expect(routeSource).toMatch(/billing\.manageSubscription\(\)/);
    expect(routeSource).not.toMatch(/Refresh subscription status|access\.refresh\(\)|busy\s*===\s*["']refresh["']/);
  });
});
