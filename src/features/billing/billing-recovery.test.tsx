import { act, render } from "@testing-library/react-native";
import { useEffect } from "react";
import { AppState, Text } from "react-native";
import { unknownAccess } from "@/features/access/types";

const mockAuth = { phase: "authenticated", user: { id: "first" }, session: { access_token: "token" } };
const mockConfigure = jest.fn();
const mockInfo = jest.fn();
const mockOfferings = jest.fn();
const mockRestore = jest.fn();
const mockPurchase = jest.fn();
const mockRefresh = jest.fn();
const mockAccess = { access: unknownAccess, refresh: jest.fn(async () => unknownAccess), reconcileUntilChanged: jest.fn() };
jest.mock("@/features/auth/auth-provider", () => ({ useAuth: () => mockAuth }));
jest.mock("@/features/access/access-provider", () => ({ useAccess: () => mockAccess }));
jest.mock("./api", () => ({ refreshEntitlement: (...args: unknown[]) => mockRefresh(...args) }));
jest.mock("./purchases", () => ({ purchasesClient: {
  configure: (...args: unknown[]) => mockConfigure(...args),
  getCustomerInfo: () => mockInfo(), getOfferings: () => mockOfferings(), purchasePackage: (...args: unknown[]) => mockPurchase(...args), restorePurchases: () => mockRestore(),
  subscribeCustomerInfo: () => () => undefined, logOut: async () => undefined,
} }));
import { BillingProvider, useBilling, type BillingContextValue } from "./billing-provider";

let billing: BillingContextValue;
function Probe() {
  const current = useBilling();
  useEffect(() => { billing = current; }, [current]);
  return <Text>{current.state}</Text>;
}

describe("mounted billing recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: jest.fn() });
    mockAuth.user = { id: "first" };
    mockConfigure.mockResolvedValue(undefined);
    mockInfo.mockResolvedValue({ activeEntitlementIds: [], subscription: null });
    mockOfferings.mockResolvedValue(null);
    mockRefresh.mockResolvedValue({ access: { ...unknownAccess, status: "expired", lifecycleState: "not_subscribed" }, subscription: { productIdentifier: null } });
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it("exits loading when native configuration never resolves", async () => {
    jest.useFakeTimers();
    mockConfigure.mockImplementation(() => new Promise(() => undefined));
    const screen = await render(<BillingProvider><Probe /></BillingProvider>);
    await act(async () => { await jest.advanceTimersByTimeAsync(45_000); });
    expect(screen.getByText("failed")).toBeTruthy();
    expect(billing.error).toBeTruthy();
  });

  it("releases a stalled purchase check so it can be retried", async () => {
    const screen = await render(<BillingProvider><Probe /></BillingProvider>);
    await screen.findByText("failed");
    jest.useFakeTimers();
    mockInfo.mockImplementation(() => new Promise(() => undefined));
    let result!: Promise<boolean>;
    await act(async () => { result = billing.retryPurchaseSync(); });
    await act(async () => { await jest.advanceTimersByTimeAsync(45_000); });
    await expect(result).resolves.toBe(false);
    expect(billing.state).toBe("sync_required");
    mockInfo.mockResolvedValue({ activeEntitlementIds: [], subscription: null });
    await act(async () => { await billing.retryPurchaseSync(); });
    expect(billing.state).toBe("ready");
  });

  it("leaves purchase reconciliation promptly when the entitlement endpoint rejects", async () => {
    mockOfferings.mockResolvedValue({ identifier: "default", packages: [{ identifier: "$rc_monthly", productIdentifier: "formie_monthly", priceString: "$9.99", title: "Monthly" }] });
    const activeCustomer = { activeEntitlementIds: ["formie_pro"], originalAppUserId: "first", subscription: { entitlementId: "formie_pro", productIdentifier: "formie_monthly", isActive: true, willRenew: true, expirationDate: "2026-10-01T00:00:00Z", managementURL: null, isSandbox: true, store: "APP_STORE" } };
    mockPurchase.mockResolvedValue({ customerInfo: activeCustomer, productIdentifier: "formie_monthly" });
    const screen = await render(<BillingProvider><Probe /></BillingProvider>);
    await screen.findByText("ready");
    mockRefresh.mockRejectedValue(new Error("Edge Function returned 415"));
    let result!: Promise<string>;
    await act(async () => { result = billing.purchase("monthly"); await Promise.resolve(); });
    await expect(result).resolves.toBe("sync_required");
    expect(billing.state).toBe("sync_required");
  });

  it("times out a hung entitlement refresh instead of leaving purchase on starting", async () => {
    jest.useFakeTimers();
    mockOfferings.mockResolvedValue({ identifier: "default", packages: [{ identifier: "$rc_monthly", productIdentifier: "formie_monthly", priceString: "$9.99", title: "Monthly" }] });
    const activeCustomer = { activeEntitlementIds: ["formie_pro"], originalAppUserId: "first", subscription: { entitlementId: "formie_pro", productIdentifier: "formie_monthly", isActive: true, willRenew: true, expirationDate: "2026-10-01T00:00:00Z", managementURL: null, isSandbox: true, store: "APP_STORE" } };
    mockPurchase.mockResolvedValue({ customerInfo: activeCustomer, productIdentifier: "formie_monthly" });
    const screen = await render(<BillingProvider><Probe /></BillingProvider>);
    await screen.findByText("ready");
    mockRefresh.mockImplementation(() => new Promise(() => undefined));
    let result!: Promise<string>;
    await act(async () => { result = billing.purchase("monthly"); });
    await act(async () => { await jest.advanceTimersByTimeAsync(12_000); });
    await expect(result).resolves.toBe("sync_required");
    expect(billing.state).toBe("sync_required");
  });

  it("ignores a restore result from the previous account", async () => {
    const screen = await render(<BillingProvider><Probe /></BillingProvider>);
    await screen.findByText("failed");
    let complete!: (value: unknown) => void;
    mockRestore.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    let restored!: Promise<boolean>;
    await act(async () => { restored = billing.restore(); });
    mockAuth.user = { id: "second" };
    await act(async () => { await screen.rerender(<BillingProvider><Probe /></BillingProvider>); });
    await screen.findByText("failed");
    await act(async () => { complete({ activeEntitlementIds: ["formie_pro"], subscription: { productIdentifier: "old-account-product" } }); await restored; });
    await expect(restored).resolves.toBe(false);
    expect(billing.subscription).toBeNull();
    expect(billing.restoreMessage).toBeNull();
  });
});
