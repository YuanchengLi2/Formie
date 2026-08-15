import { act, render, waitFor } from "@testing-library/react-native";

import ProfileRoute from "@/app/(tabs)/(profile)";

const mockReplace = jest.fn();
const mockDeleteAccount = jest.fn();
const mockBillingLogOut = jest.fn();
const mockMarkLoggedOut = jest.fn();
const mockAuthLogOut = jest.fn();
const callOrder: string[] = [];
let capturedProps: Record<string, unknown> | null = null;
let mockSession: { access_token: string } | null = { access_token: "access-token" };
let mockAccess: Record<string, unknown>;

jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }));
jest.mock("@/screens/profile", () => ({ ProfileScreen: (props: Record<string, unknown>) => { capturedProps = props; return null; } }));
jest.mock("@/features/account-deletion/api", () => ({ deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args) }));
jest.mock("@/features/auth/auth-provider", () => ({ useAuth: () => ({
  session: mockSession,
  user: { email: "athlete@example.com" },
  logOut: (...args: unknown[]) => mockAuthLogOut(...args),
}) }));
jest.mock("@/features/billing/billing-provider", () => ({ useBilling: () => ({ logOut: (...args: unknown[]) => mockBillingLogOut(...args) }) }));
jest.mock("@/features/onboarding/onboarding-store", () => ({ useOnboarding: () => ({ markLoggedOut: (...args: unknown[]) => mockMarkLoggedOut(...args) }) }));
jest.mock("@/features/capture/capture-preferences", () => ({
  useCapturePreferences: (selector: (state: Record<string, unknown>) => unknown) => selector({ preferences: {}, hydrate: jest.fn(), update: jest.fn() }),
}));
jest.mock("@/features/profile/profile-provider", () => ({ useProfile: () => ({ profile: null, saveProfile: jest.fn() }) }));
jest.mock("@/features/access/access-provider", () => ({
  useAccess: () => ({ access: mockAccess, reconcile: jest.fn(), refresh: jest.fn() }),
  useBillingSurfaceRefresh: jest.fn(),
}));
jest.mock("@/features/billing/subscription-management-presentation", () => ({ createSubscriptionPresentation: () => ({ badgeLabel: "Active" }) }));
jest.mock("@/features/billing/subscription-test-controls", () => ({ runSubscriptionTestControl: jest.fn(), setSubscriptionTestRemaining: jest.fn() }));
jest.mock("@/features/auth/legal-config", () => ({ getLegalLinks: () => ({}) }));

describe("ProfileRoute account deletion", () => {
  beforeEach(() => {
    capturedProps = null;
    callOrder.length = 0;
    mockReplace.mockReset();
    mockSession = { access_token: "access-token" };
    mockAccess = {
      status: "active",
      lifecycleState: "active_renewing",
      store: "app_store",
      planCode: "monthly",
      willRenew: true,
      paidThrough: "2026-09-01T00:00:00Z",
      sandbox: true,
      remaining: 8,
    };
    mockDeleteAccount.mockReset().mockImplementation(async () => { callOrder.push("server"); });
    mockBillingLogOut.mockReset().mockImplementation(async () => { callOrder.push("billing"); });
    mockMarkLoggedOut.mockReset().mockImplementation(async () => { callOrder.push("onboarding"); });
    mockAuthLogOut.mockReset().mockImplementation(async () => { callOrder.push("auth"); });
  });

  async function getDeleteCallback(): Promise<() => Promise<void>> {
    render(<ProfileRoute />);
    await waitFor(() => expect(capturedProps).not.toBeNull());
    return capturedProps?.onDeleteAccount as () => Promise<void>;
  }

  it("deletes on the server before local cleanup and shows signed-out confirmation", async () => {
    const callback = await getDeleteCallback();
    await act(async () => { await callback(); });
    expect(mockDeleteAccount).toHaveBeenCalledWith({ accessToken: "access-token" });
    expect(callOrder).toEqual(["server", "billing", "onboarding", "auth"]);
    expect(mockBillingLogOut).toHaveBeenCalledTimes(1);
    expect(mockMarkLoggedOut).toHaveBeenCalledTimes(1);
    expect(mockAuthLogOut).toHaveBeenCalledWith("user");
    expect(mockReplace).toHaveBeenCalledWith("/login?accountDeleted=1");
  });

  it("rejects without an access token before any deletion or cleanup", async () => {
    mockSession = null;
    const callback = await getDeleteCallback();
    await expect(callback()).rejects.toThrow("Sign in again");
    expect(mockDeleteAccount).not.toHaveBeenCalled();
    expect(mockBillingLogOut).not.toHaveBeenCalled();
    expect(mockMarkLoggedOut).not.toHaveBeenCalled();
    expect(mockAuthLogOut).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("keeps the signed-in route intact when server deletion fails", async () => {
    mockDeleteAccount.mockRejectedValueOnce(new Error("server failed"));
    const callback = await getDeleteCallback();
    await expect(callback()).rejects.toThrow("server failed");
    expect(mockBillingLogOut).not.toHaveBeenCalled();
    expect(mockMarkLoggedOut).not.toHaveBeenCalled();
    expect(mockAuthLogOut).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("continues local teardown when RevenueCat logout fails after confirmed deletion", async () => {
    mockBillingLogOut.mockRejectedValueOnce(new Error("RevenueCat unavailable"));
    const callback = await getDeleteCallback();
    await act(async () => { await callback(); });
    expect(mockMarkLoggedOut).toHaveBeenCalledTimes(1);
    expect(mockAuthLogOut).toHaveBeenCalledWith("user");
    expect(mockReplace).toHaveBeenCalledWith("/login?accountDeleted=1");
  });

  it.each([
    ["app_store", "active_renewing", true],
    ["app_store", "active_cancelled", true],
    [null, "not_subscribed", false],
    ["app_store", "expired", false],
  ])("sets managed-subscription guidance for %s/%s", async (store, lifecycleState, expected) => {
    mockAccess = { ...mockAccess, store, lifecycleState };
    render(<ProfileRoute />);
    await waitFor(() => expect(capturedProps?.hasManagedSubscription).toBe(expected));
  });
});
