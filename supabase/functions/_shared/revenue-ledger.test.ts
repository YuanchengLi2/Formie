import { projectRevenueCatWebhook, reconcileRevenueCatTransactionHistory, revenueCatHistoryEventToWebhook } from "./revenue-ledger";

function adminWithRpc(rpc = jest.fn().mockResolvedValue({ data: "transaction-id", error: null })) {
  return { rpc } as never;
}

describe("RevenueCat financial projection", () => {
  it("normalizes customer events without trusting client financial state", () => {
    expect(revenueCatHistoryEventToWebhook({
      id: "evt-1",
      type: "PURCHASES_RENEWAL",
      occurredAt: "2026-09-01T00:00:00.000Z",
      body: {
        app_user_id: "user-1",
        environment: "PRODUCTION",
        store: "APP_STORE",
        transaction_id: "tx-2",
        original_transaction_id: "original-1",
        product_id: "formie_monthly",
        purchased_at_ms: Date.parse("2026-09-01T00:00:00.000Z"),
        expiration_at_ms: Date.parse("2026-10-01T00:00:00.000Z"),
        price_in_purchased_currency: 9.99,
        currency: "USD",
      },
    }, "fallback-user")).toMatchObject({
      id: "history:evt-1",
      type: "RENEWAL",
      app_user_id: "user-1",
      environment: "PRODUCTION",
      transaction_id: "tx-2",
      price_in_purchased_currency: 9.99,
    });
  });

  it("projects older initial payments before a later renewal even when the provider returns them out of order", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: "transaction-id", error: null });
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [
        { id: "renewal", type: "PURCHASES_RENEWAL", occurred_at: Date.parse("2026-09-01T00:00:00Z"), body: { app_user_id: "user-1", environment: "PRODUCTION", store: "APP_STORE", transaction_id: "tx-2", original_transaction_id: "original-1", product_id: "formie_monthly", purchased_at_ms: Date.parse("2026-09-01T00:00:00Z"), expiration_at_ms: Date.parse("2026-10-01T00:00:00Z"), price_in_purchased_currency: 9.99, currency: "USD" } },
        { id: "initial", type: "PURCHASES_INITIAL_PURCHASE", occurred_at: Date.parse("2026-08-01T00:00:00Z"), body: { app_user_id: "user-1", environment: "PRODUCTION", store: "APP_STORE", transaction_id: "tx-1", original_transaction_id: "original-1", product_id: "formie_monthly", purchased_at_ms: Date.parse("2026-08-01T00:00:00Z"), expiration_at_ms: Date.parse("2026-09-01T00:00:00Z"), price_in_purchased_currency: 9.99, currency: "USD" } },
      ],
      next_page: null,
    }), { status: 200 }));

    await expect(reconcileRevenueCatTransactionHistory(adminWithRpc(rpc), "user-1", "user-1", "salt", { projectId: "project", secretApiKey: "secret", fetcher })).resolves.toBe(2);
    expect(rpc.mock.calls.map((call) => call[1].p_event_type)).toEqual(["INITIAL_PURCHASE", "RENEWAL"]);
  });

  it("does not replace the original positive amount with a negative refund webhook amount", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: "transaction-id", error: null });
    await expect(projectRevenueCatWebhook(adminWithRpc(rpc), "user-1", {
      id: "refund-1", type: "CANCELLATION", app_user_id: "user-1", environment: "PRODUCTION",
      store: "APP_STORE", transaction_id: "tx-1", original_transaction_id: "original-1",
      cancel_reason: "CUSTOMER_SUPPORT", price_in_purchased_currency: -9.99,
      raw_event: {}, recognized: true,
    }, "salt")).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("project_revenuecat_transaction", expect.objectContaining({ p_gross: null, p_refunded_at: expect.any(String) }));
  });
});
