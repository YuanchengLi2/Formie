import { runSubscriptionTestControl, setSubscriptionTestRemaining } from "./subscription-test-controls";

const mockInvoke = jest.fn();
jest.mock("@/lib/supabase", () => ({ supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));

describe("runSubscriptionTestControl", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("invokes only supported lifecycle actions and returns the normalized snapshot", async () => {
    mockInvoke.mockResolvedValue({ data: { action: "uncancel", lifecycleState: "active_renewing", willRenew: true }, error: null });
    await expect(runSubscriptionTestControl("uncancel")).resolves.toMatchObject({ lifecycleState: "active_renewing", willRenew: true });
    expect(mockInvoke).toHaveBeenCalledWith("subscription-test-controls", { body: { action: "uncancel" } });
  });

  it("does not expose provider errors", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("provider secret") });
    await expect(runSubscriptionTestControl("renew_now")).rejects.toThrow("could not be applied");
  });

  it("sends a bounded remaining-balance command", async () => {
    mockInvoke.mockResolvedValue({ data: { remaining: 0, quota_used: 10 }, error: null });
    await expect(setSubscriptionTestRemaining(0)).resolves.toMatchObject({ action: "set_remaining", remaining: 0, quotaUsed: 10 });
    expect(mockInvoke).toHaveBeenCalledWith("subscription-test-controls", { body: { action: "set_remaining", remaining: 0 } });
    await expect(setSubscriptionTestRemaining(11)).rejects.toThrow("between 0 and 10");
  });
});
