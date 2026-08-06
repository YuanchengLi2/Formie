import { refreshEntitlement } from "./api";
import type { BillingCustomerInfo } from "./types";

const mockInvoke = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

describe("billing entitlement refresh", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ data: { access: { status: "active" }, source: "revenuecat" }, error: null });
  });

  it("does not send the store management URL back to the entitlement server", async () => {
    const customerInfo: BillingCustomerInfo = {
      activeEntitlementIds: ["formie_pro"],
      originalAppUserId: "user-1",
      subscription: {
        entitlementId: "formie_pro",
        productIdentifier: "formie_monthly",
        isActive: true,
        willRenew: true,
        expirationDate: "2026-09-05T12:00:00.000Z",
        managementURL: "https://billing.example/private-customer-portal",
        isSandbox: false,
        store: "APP_STORE",
      },
    };

    await refreshEntitlement("jwt", customerInfo);

    expect(mockInvoke).toHaveBeenCalledWith("refresh-entitlement", {
      body: { customerInfo: { activeEntitlementIds: ["formie_pro"], originalAppUserId: "user-1" } },
      headers: { Authorization: "Bearer jwt" },
    });
  });
});
