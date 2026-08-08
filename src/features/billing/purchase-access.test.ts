import * as purchaseAccess from "./purchase-access";

const { customerHasEntitlement } = purchaseAccess;

describe("pre-account purchase access", () => {
  it("accepts the purchased anonymous RevenueCat entitlement before account creation", () => {
    expect(customerHasEntitlement({ activeEntitlementIds: ["formie_pro"], originalAppUserId: "$RCAnonymousID:device", subscription: null }, "formie_pro")).toBe(true);
  });

  it("does not advance to account creation without the configured entitlement", () => {
    expect(customerHasEntitlement({ activeEntitlementIds: [], originalAppUserId: "$RCAnonymousID:device", subscription: null }, "formie_pro")).toBe(false);
  });
});

describe("post-purchase confirmation", () => {
  const activeCustomer = { activeEntitlementIds: ["formie_pro"], originalAppUserId: "u1", subscription: null };

  it("exposes sync_required while the server snapshot catches up", () => {
    expect(purchaseAccess.resolvePurchaseCompletion(activeCustomer, "formie_pro", false)).toBe("sync_required");
  });

  it("succeeds only after both provider and server confirm access", () => {
    expect(purchaseAccess.resolvePurchaseCompletion(activeCustomer, "formie_pro", true)).toBe("active");
    expect(purchaseAccess.resolvePurchaseCompletion({ ...activeCustomer, activeEntitlementIds: [] }, "formie_pro", true)).toBe("failed");
  });
});

describe("subscription lifecycle mapping", () => {
  it("keeps a cancelled subscription active through its paid-through date", () => {
    const mapEntitlement = (purchaseAccess as typeof purchaseAccess & {
      subscriptionFromEntitlement: (input: Record<string, unknown>, managementURL: string | null) => unknown;
    }).subscriptionFromEntitlement;

    expect(mapEntitlement({
      identifier: "formie_pro",
      productIdentifier: "formie_monthly",
      isActive: true,
      willRenew: false,
      expirationDate: "2026-09-05T12:00:00.000Z",
      isSandbox: false,
      store: "APP_STORE",
    }, "https://apps.apple.com/account/subscriptions")).toEqual({
      entitlementId: "formie_pro",
      productIdentifier: "formie_monthly",
      isActive: true,
      willRenew: false,
      expirationDate: "2026-09-05T12:00:00.000Z",
      managementURL: "https://apps.apple.com/account/subscriptions",
      isSandbox: false,
      store: "APP_STORE",
    });
  });

  it("normalizes browser Date values without inventing an expiration", () => {
    const mapEntitlement = (purchaseAccess as typeof purchaseAccess & {
      subscriptionFromEntitlement: (input: Record<string, unknown>, managementURL: string | null) => unknown;
    }).subscriptionFromEntitlement;

    expect(mapEntitlement({
      identifier: "formie_pro",
      productIdentifier: "formie_monthly",
      isActive: true,
      willRenew: true,
      expirationDate: new Date("2026-09-05T12:00:00.000Z"),
      isSandbox: true,
      store: "TEST_STORE",
    }, null)).toMatchObject({ expirationDate: "2026-09-05T12:00:00.000Z", isSandbox: true });
  });
});
