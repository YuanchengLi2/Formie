/* eslint-disable import/first */
const mockPersist = jest.fn();
const mockHistory = jest.fn();
const mockRpc = jest.fn();
const mockSubscriber = jest.fn();
jest.mock("../_shared/auth.ts", () => ({
  createAdminClient: () => ({ rpc: mockRpc }), requireUserId: async () => "user-1",
}));
jest.mock("../_shared/cors.ts", () => ({ secureBrowserRequest: async () => null, withCors: (_request: Request, response: Response) => response }));
jest.mock("../_shared/entitlement-ledger.ts", () => ({ persistEntitlementLedger: (...args: unknown[]) => mockPersist(...args) }));
jest.mock("../_shared/revenue-ledger.ts", () => ({ reconcileRevenueCatTransactionHistory: (...args: unknown[]) => mockHistory(...args) }));
jest.mock("../_shared/revenuecat.ts", () => ({
  ...jest.requireActual("../_shared/revenuecat.ts"), fetchRevenueCatSubscriber: (...args: unknown[]) => mockSubscriber(...args),
}));

it("confirms server access independently of the financial-history service", async () => {
  let handler!: (request: Request) => Promise<Response>;
  const originalDeno = (globalThis as any).Deno;
  (globalThis as any).Deno = { env: { get: () => undefined }, serve: (callback: typeof handler) => { handler = callback; } };
  mockSubscriber.mockResolvedValue({ appUserId: "user-1", entitlements: [], subscriptions: [] });
  mockPersist.mockResolvedValue({ status: "active" });
  mockHistory.mockRejectedValue(new Error("REVENUECAT_PROJECT_ID is not configured"));
  mockRpc.mockResolvedValue({ data: { status: "active", lifecycle_state: "active_cancelled", can_analyze: true, will_renew: false, source: "revenuecat" }, error: null });
  try {
    require("./index");
    const response = await handler(new Request("https://example.test/refresh-entitlement", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(mockPersist).toHaveBeenCalled();
    expect(mockHistory).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ access: { status: "active", willRenew: false } });
  } finally {
    (globalThis as any).Deno = originalDeno;
  }
});
