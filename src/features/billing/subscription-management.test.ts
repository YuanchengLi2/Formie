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
  it("never reports an active renewal while access is unknown", () => {
    expect(createSubscriptionPresentation({
      lifecycleState: "unknown",
      willRenew: false,
      paidThrough: null,
      status: "unknown",
    })).toMatchObject({
      headlineAccent: "subscription",
      badgeLabel: "Checking",
      automaticRenewalValue: "Checking",
      showManage: false,
      showPurchase: false,
    });
  });

  it.each([
    ["active_renewing", "is on", "Active", false],
    ["active_cancelled", "is off", "Renewal off", false],
    ["renewal_pending", "renewal", "Checking", false],
    ["expired", "has ended", "Expired", true],
    ["not_subscribed", "Formie Pro", "Available", true],
  ] as const)("maps %s to stable screen geometry and lifecycle copy", (lifecycleState, accent, badge, showPurchase) => {
    expect(createSubscriptionPresentation({ lifecycleState, willRenew: lifecycleState === "active_renewing", paidThrough: "2026-08-11T02:34:50Z", status: lifecycleState === "expired" || lifecycleState === "not_subscribed" ? "expired" : "active" })).toMatchObject({ headlineAccent: accent, badgeLabel: badge, showPurchase });
  });

  it("does not render explanatory hero copy below the renewal headline", () => {
    expect(routeSource).not.toContain("presentation.heroDetail");
  });

  it("does not let a stale native renewal snapshot override server-authoritative access", () => {
    const serverAccess = { lifecycleState: "active_renewing" as const, willRenew: true, paidThrough: "2026-08-11T02:34:50Z", status: "active" as const, productIdentifier: "formie_monthly" };
    const nativeSubscription = { entitlementId: "formie_pro", productIdentifier: "formie_monthly", isActive: true, willRenew: false, expirationDate: "2026-08-11T02:34:50Z", managementURL: null, isSandbox: true, store: "APP_STORE" };

    expect(createSubscriptionPresentation(serverAccess, nativeSubscription)).toMatchObject({
      headlineAccent: "is on",
      automaticRenewalValue: "On",
    });
    expect(createSubscriptionPresentation({ ...serverAccess, lifecycleState: "active_cancelled", willRenew: false }, { ...nativeSubscription, willRenew: true })).toMatchObject({
      headlineAccent: "is off",
      automaticRenewalValue: "Off",
    });
  });

  it("does not let native renewal metadata fabricate active server access", () => {
    const expired = { lifecycleState: "expired" as const, willRenew: false, paidThrough: "2026-08-11T02:34:50Z", status: "expired" as const, productIdentifier: "formie_monthly" };
    const nativeSubscription = { entitlementId: "formie_pro", productIdentifier: "formie_monthly", isActive: true, willRenew: true, expirationDate: "2026-09-11T02:34:50Z", managementURL: null, isSandbox: true, store: "APP_STORE" };

    expect(createSubscriptionPresentation(expired, nativeSubscription)).toMatchObject({
      headlineAccent: "has ended",
      showPurchase: true,
    });
  });
});

describe("native subscription management route", () => {
  it("uses one provider-management action and relies on automatic entitlement refresh", () => {
    expect(routeSource).toMatch(/billing\.manageSubscription\(\)/);
    expect(routeSource).not.toMatch(/Refresh subscription status|access\.refresh\(\)|busy\s*===\s*["']refresh["']/);
  });
});
