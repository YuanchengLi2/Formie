import { reduceSubscriptionState, resolveRenewalBoundaryState, type SubscriptionLedgerState } from "./subscription-state";

const active: SubscriptionLedgerState = {
  lifecycleState: "active_renewing",
  productIdentifier: "formie_monthly",
  planCode: "monthly",
  store: "test_store",
  sandbox: true,
  willRenew: true,
  billingPeriodStart: "2026-08-06T23:27:16.000Z",
  billingPeriodEnd: "2026-08-06T23:32:16.000Z",
  latestEventAt: "2026-08-06T23:27:16.000Z",
  latestEventId: "initial",
};

describe("reduceSubscriptionState", () => {
  it("cancels at period end without shortening the paid period", () => {
    expect(reduceSubscriptionState(active, {
      id: "cancel",
      type: "CANCELLATION",
      eventAt: "2026-08-06T23:28:16.000Z",
      productIdentifier: "formie_monthly",
    })).toEqual({
      ...active,
      lifecycleState: "active_cancelled",
      willRenew: false,
      latestEventAt: "2026-08-06T23:28:16.000Z",
      latestEventId: "cancel",
    });
  });

  it("undoes cancellation without resetting the current period", () => {
    const cancelled = { ...active, lifecycleState: "active_cancelled" as const, willRenew: false };
    expect(reduceSubscriptionState(cancelled, {
      id: "uncancel",
      type: "UNCANCELLATION",
      eventAt: "2026-08-06T23:29:16.000Z",
      productIdentifier: "formie_monthly",
    })).toEqual({
      ...active,
      latestEventAt: "2026-08-06T23:29:16.000Z",
      latestEventId: "uncancel",
    });
  });

  it("renews into a new period after cancellation is undone", () => {
    const renewed = reduceSubscriptionState(active, {
      id: "renewal",
      type: "RENEWAL",
      eventAt: "2026-08-06T23:32:17.000Z",
      productIdentifier: "formie_monthly",
      purchasedAt: "2026-08-06T23:32:16.000Z",
      expiresAt: "2026-08-06T23:37:16.000Z",
    });
    expect(renewed).toMatchObject({
      lifecycleState: "active_renewing",
      willRenew: true,
      billingPeriodStart: "2026-08-06T23:32:16.000Z",
      billingPeriodEnd: "2026-08-06T23:37:16.000Z",
    });
  });

  it("ignores an old expiration after a newer renewal", () => {
    const current = { ...active, billingPeriodStart: "2026-08-06T23:32:16.000Z", billingPeriodEnd: "2026-08-06T23:37:16.000Z", latestEventAt: "2026-08-06T23:32:17.000Z", latestEventId: "renewal" };
    expect(reduceSubscriptionState(current, {
      id: "old-expiry",
      type: "EXPIRATION",
      eventAt: "2026-08-06T23:32:18.000Z",
      productIdentifier: "formie_monthly",
      expiresAt: "2026-08-06T23:32:16.000Z",
    })).toEqual(current);
  });

  it("records a scheduled product change without activating the new plan early", () => {
    expect(reduceSubscriptionState(active, {
      id: "scheduled-annual",
      type: "PRODUCT_CHANGE",
      eventAt: "2026-08-06T23:29:16.000Z",
      productIdentifier: "formie_yearly",
      planCode: "annual",
      purchasedAt: "2026-08-06T23:27:16.000Z",
      expiresAt: "2026-08-06T23:32:16.000Z",
    })).toEqual({
      ...active,
      latestEventAt: "2026-08-06T23:29:16.000Z",
      latestEventId: "scheduled-annual",
    });
  });

  it("uses a 90-second checking window at an expected renewal boundary", () => {
    expect(resolveRenewalBoundaryState(active, new Date("2026-08-06T23:32:45.000Z"))).toBe("renewal_pending");
    expect(resolveRenewalBoundaryState(active, new Date("2026-08-06T23:33:47.000Z"))).toBe("expired");
    expect(resolveRenewalBoundaryState({ ...active, lifecycleState: "active_cancelled", willRenew: false }, new Date("2026-08-06T23:32:17.000Z"))).toBe("expired");
  });
});
