import { activeRevenueCatEntitlement, deleteRevenueCatCustomer, parseRevenueCatSubscriber, resolveRevenueCatEntitlement, resolveSubscriptionState } from "./revenuecat";

describe("RevenueCat entitlement mapping", () => {
  it("only treats the configured entitlement as active before its expiry", () => {
    const now = new Date("2026-08-04T12:00:00.000Z");
    const subscriber = {
      appUserId: "user-1",
      entitlements: [
        { identifier: "formie_pro", productIdentifier: "monthly", purchaseDate: "2026-08-01T00:00:00.000Z", expirationDate: "2026-09-01T00:00:00.000Z" },
      ],
    };
    expect(activeRevenueCatEntitlement(subscriber, "formie_pro", now)?.productIdentifier).toBe("monthly");
    expect(activeRevenueCatEntitlement(subscriber, "formie_pro", new Date("2026-10-01T00:00:00.000Z"))).toBeNull();
  });

  it("maps an expired entitlement to an expired persistence snapshot", () => {
    const subscriber = {
      appUserId: "user-1",
      entitlements: [
        { identifier: "formie_pro", productIdentifier: "monthly", purchaseDate: "2026-08-01T00:00:00.000Z", expirationDate: "2026-08-04T11:59:59.000Z" },
      ],
    };

    expect(resolveRevenueCatEntitlement(subscriber, "formie_pro", new Date("2026-08-04T12:00:00.000Z"))).toEqual({
      status: "expired",
      entitlementId: "formie_pro",
      productIdentifier: "monthly",
      purchaseDate: "2026-08-01T00:00:00.000Z",
      expirationDate: "2026-08-04T11:59:59.000Z",
    });
  });
});

describe("RevenueCat customer deletion", () => {
  it("permanently deletes the identified customer and treats an absent customer as success", async () => {
    const fetcher = jest.fn().mockResolvedValueOnce(new Response(null, { status: 200 })).mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(deleteRevenueCatCustomer("user/1", "secret", fetcher)).resolves.toBeUndefined();
    await expect(deleteRevenueCatCustomer("user/1", "secret", fetcher)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith("https://api.revenuecat.com/v1/subscribers/user%2F1", expect.objectContaining({ method: "DELETE", headers: expect.objectContaining({ Authorization: "Bearer secret" }) }));
  });
});

describe("RevenueCat subscription management", () => {
  it("distinguishes an account that never subscribed from an expired account", () => {
    const subscriber = parseRevenueCatSubscriber("u1", { subscriber: { entitlements: {}, subscriptions: {} } });

    expect(resolveSubscriptionState(subscriber, new Date("2026-08-10T00:00:00Z"))).toEqual({
      state: "not_subscribed",
      planCode: null,
      willRenew: false,
      billingPeriodStart: null,
      productIdentifier: null,
      store: null,
      paidThrough: null,
      cancelUrl: null,
      renewalUrl: null,
      sandbox: false,
    });
  });

  it("preserves historical entitlement evidence as expired when subscription metadata is absent", () => {
    const subscriber = parseRevenueCatSubscriber("u1", { subscriber: { entitlements: { formie_pro: { product_identifier: "monthly", purchase_date: "2026-07-01T00:00:00Z", expires_date: "2026-08-01T00:00:00Z" } }, subscriptions: {} } });

    expect(resolveSubscriptionState(subscriber, new Date("2026-08-10T00:00:00Z"))).toMatchObject({
      state: "expired",
      productIdentifier: "monthly",
      paidThrough: "2026-08-01T00:00:00Z",
    });
  });

  it("parses Apple management and cancelled paid-through access", () => {
    const subscriber = parseRevenueCatSubscriber("u1", { subscriber: { management_url: "https://apps.apple.com/account/subscriptions", entitlements: { formie_pro: { product_identifier: "monthly", purchase_date: "2026-08-01T00:00:00Z", expires_date: "2026-09-01T00:00:00Z" } }, subscriptions: { monthly: { store: "app_store", purchase_date: "2026-08-01T00:00:00Z", original_purchase_date: "2026-07-01T00:00:00Z", expires_date: "2026-09-01T00:00:00Z", unsubscribe_detected_at: "2026-08-05T00:00:00Z", is_sandbox: false, ownership_type: "PURCHASED" } } } });
    expect(subscriber.managementUrl).toContain("apple.com");
    expect(subscriber.subscriptions?.[0]).toMatchObject({ purchaseDate: "2026-08-01T00:00:00Z", originalPurchaseDate: "2026-07-01T00:00:00Z", ownershipType: "PURCHASED" });
    expect(resolveSubscriptionState(subscriber, new Date("2026-08-10T00:00:00Z"))).toMatchObject({ state: "active_cancelled", planCode: "monthly", willRenew: false, billingPeriodStart: "2026-08-01T00:00:00Z", store: "app_store", paidThrough: "2026-09-01T00:00:00Z", renewalUrl: "https://apps.apple.com/account/subscriptions" });
  });

  it("maps yearly product aliases to the annual plan", () => {
    const subscriber = parseRevenueCatSubscriber("u1", { subscriber: { entitlements: { formie_pro: { product_identifier: "yearly", purchase_date: "2026-08-01T00:00:00Z", expires_date: "2027-08-01T00:00:00Z" } }, subscriptions: { yearly: { store: "test_store", purchase_date: "2026-08-01T00:00:00Z", expires_date: "2027-08-01T00:00:00Z", is_sandbox: true } } } });
    expect(resolveSubscriptionState(subscriber, new Date("2026-08-10T00:00:00Z"))).toMatchObject({ planCode: "annual", willRenew: true });
  });

  it("uses a Google renewal fallback after expiration", () => {
    const subscriber = parseRevenueCatSubscriber("u1", { subscriber: { management_url: null, entitlements: {}, subscriptions: { monthly: { store: "play_store", expires_date: "2026-08-01T00:00:00Z", is_sandbox: false } } } });
    expect(resolveSubscriptionState(subscriber, new Date("2026-08-10T00:00:00Z"))).toMatchObject({ state: "expired", renewalUrl: expect.stringContaining("play.google.com") });
  });

  it("selects the latest paid-through subscription and exposes Test Store", () => {
    const subscriber = parseRevenueCatSubscriber("u1", { subscriber: { entitlements: {}, subscriptions: { old: { store: "app_store", expires_date: "2026-08-01T00:00:00Z" }, current: { store: "test_store", expires_date: "2026-09-01T00:00:00Z", is_sandbox: true } } } });
    expect(resolveSubscriptionState(subscriber, new Date("2026-08-10T00:00:00Z"))).toMatchObject({ productIdentifier: "current", sandbox: true, state: "active_renewing" });
  });

  it("selects the subscription attached to the configured entitlement instead of an unrelated newer product", () => {
    const subscriber = parseRevenueCatSubscriber("u1", { subscriber: {
      entitlements: { formie_pro: { product_identifier: "formie_monthly", purchase_date: "2026-08-01T00:00:00Z", expires_date: "2026-09-01T00:00:00Z" } },
      subscriptions: {
        formie_monthly: { store: "app_store", expires_date: "2026-09-01T00:00:00Z", is_sandbox: false },
        unrelated_yearly: { store: "play_store", expires_date: "2027-08-01T00:00:00Z", is_sandbox: false },
      },
    } });

    expect(resolveSubscriptionState(subscriber, new Date("2026-08-10T00:00:00Z"), "formie_pro")).toMatchObject({
      state: "active_renewing",
      productIdentifier: "formie_monthly",
      store: "app_store",
    });
  });

});
