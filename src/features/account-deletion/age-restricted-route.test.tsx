import { act, render, waitFor } from "@testing-library/react-native";

import AgeRestrictedRoute from "@/app/account/age-restricted";

const mockDeleteAccount = jest.fn();
const mockPrepare = jest.fn();
const mockRestore = jest.fn();
const mockMarkLoggedOut = jest.fn();
const mockAuthLogOut = jest.fn();
const mockReplace = jest.fn();
const order: string[] = [];
let capturedProps: Record<string, unknown> | null = null;

jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock("@/screens/age-restricted", () => ({ AgeRestrictedScreen: (props: Record<string, unknown>) => { capturedProps = props; return null; } }));
jest.mock("@/features/account-deletion/api", () => ({ deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args) }));
jest.mock("@/features/auth/auth-provider", () => ({ useAuth: () => ({ session: { access_token: "access-token" }, logOut: (...args: unknown[]) => mockAuthLogOut(...args) }) }));
jest.mock("@/features/billing/billing-provider", () => ({ useBilling: () => ({
  logOut: jest.fn(),
  manageSubscription: jest.fn(),
  prepareAccountDeletion: (...args: unknown[]) => mockPrepare(...args),
  restoreAfterFailedAccountDeletion: (...args: unknown[]) => mockRestore(...args),
}) }));
jest.mock("@/features/onboarding/onboarding-store", () => ({ useOnboarding: () => ({ markLoggedOut: (...args: unknown[]) => mockMarkLoggedOut(...args) }) }));

describe("age-restricted account deletion", () => {
  beforeEach(() => {
    capturedProps = null;
    order.length = 0;
    mockPrepare.mockReset().mockImplementation(async () => { order.push("prepare"); });
    mockDeleteAccount.mockReset().mockImplementation(async () => { order.push("server"); });
    mockRestore.mockReset().mockResolvedValue(undefined);
    mockMarkLoggedOut.mockReset().mockImplementation(async () => { order.push("onboarding"); });
    mockAuthLogOut.mockReset().mockImplementation(async () => { order.push("auth"); });
    mockReplace.mockReset();
  });

  async function deletionCallback() {
    render(<AgeRestrictedRoute />);
    await waitFor(() => expect(capturedProps).not.toBeNull());
    return capturedProps?.onDeleteAccount as () => Promise<void>;
  }

  it("uses the same RevenueCat-first deletion sequence as Settings", async () => {
    const callback = await deletionCallback();
    await act(async () => { await callback(); });
    expect(order).toEqual(["prepare", "server", "onboarding", "auth"]);
    expect(mockReplace).toHaveBeenCalledWith("/login?accountDeleted=1");
  });

  it("restores RevenueCat identification when server deletion fails", async () => {
    mockDeleteAccount.mockRejectedValueOnce(new Error("server failed"));
    const callback = await deletionCallback();
    await expect(callback()).rejects.toThrow("server failed");
    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(mockMarkLoggedOut).not.toHaveBeenCalled();
    expect(mockAuthLogOut).not.toHaveBeenCalled();
  });
});
