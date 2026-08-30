import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { subscriptionManagementCopy } from "@/features/billing/subscription-management";
import { createSubscriptionPresentation } from "@/features/billing/subscription-management-presentation";

const routeSource = readFileSync(resolve(__dirname, "../../screens/subscription-management/index.tsx"), "utf8");

describe("native subscription management copy", () => {
  it("distinguishes cancellation from renewal without changing the paid-through period", () => {
    expect(subscriptionManagementCopy("active_cancelled", "2026-08-11T02:34:50Z")).toMatchObject({ title: "Automatic renewal is off" });
    expect(subscriptionManagementCopy("active_renewing", "2026-08-11T02:34:50Z")).toMatchObject({ title: "Automatic renewal is on" });
  });

  it("describes provider reconciliation at the renewal boundary", () => {
    expect(subscriptionManagementCopy("renewal_pending", "2026-08-11T02:34:50Z")).toMatchObject({ title: "Checking the next billing period" });
  });
});

describe("shared subscription presentation", () => {
  it.each([
    ["active_renewing", "is on", "Active", false],
    ["active_cancelled", "is off", "Renewal off", false],
    ["renewal_pending", "renewal", "Checking", false],
    ["expired", "has ended", "Expired", true],
    ["not_subscribed", "Formie Pro", "Available", true],
  ] as const)("maps %s to stable screen geometry and lifecycle copy", (lifecycleState, accent, badge, showPurchase) => {
    expect(createSubscriptionPresentation({ lifecycleState, willRenew: lifecycleState === "active_renewing", paidThrough: "2026-08-11T02:34:50Z", status: lifecycleState === "expired" || lifecycleState === "not_subscribed" ? "expired" : "active", sandbox: false })).toMatchObject({ headlineAccent: accent, badgeLabel: badge, showPurchase });
  });

  it("does not render explanatory hero copy below the renewal headline", () => {
    expect(routeSource).not.toContain("presentation.heroDetail");
  });

  it("does not claim another automatic renewal during an Apple sandbox test period", () => {
    const sandboxAccess = {
      lifecycleState: "active_renewing",
      willRenew: true,
      paidThrough: "2026-08-31T15:04:01Z",
      status: "active",
      sandbox: true,
    } as Parameters<typeof createSubscriptionPresentation>[0] & { sandbox: boolean };

    expect(createSubscriptionPresentation(sandboxAccess)).toMatchObject({
      headlineLead: "Sandbox subscription",
      headlineAccent: "is active",
      badgeLabel: "Sandbox active",
      boundaryRowLabel: "Current period ends",
      automaticRenewalValue: "Test-limited",
    });
  });
});

describe("native subscription management route", () => {
  it("uses one provider-management action and relies on automatic entitlement refresh", () => {
    expect(routeSource).toMatch(/billing\.manageSubscription\(\)/);
    expect(routeSource).not.toMatch(/Refresh subscription status|access\.refresh\(\)|busy\s*===\s*["']refresh["']/);
  });
});
