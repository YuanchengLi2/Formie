import { act, render, waitFor } from "@testing-library/react-native";

import SubscriptionRoute from "@/app/subscription";

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockOpenUrl = jest.fn();
const mockRestore = jest.fn();
const mockPurchase = jest.fn();
const mockRefresh = jest.fn();
const mockCompleteAccess = jest.fn();
let capturedProps: Record<string, unknown> | null = null;
let mockReturnTo: string | undefined;

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => ({ returnTo: mockReturnTo }),
}));
jest.mock("expo-linking", () => ({ openURL: (...args: unknown[]) => mockOpenUrl(...args) }));
jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ phase: "authenticated", user: { id: "user-1" } }),
}));
jest.mock("@/features/auth/legal-config", () => ({
  getLegalLinks: () => ({
    termsUrl: "https://useformie.com/terms",
    privacyUrl: "https://useformie.com/privacy",
    retentionUrl: "https://useformie.com/retention",
  }),
}));
jest.mock("@/features/access/access-provider", () => ({
  useAccess: () => ({
    access: { status: "expired", lifecycleState: "expired", remaining: 0 },
    refresh: mockRefresh,
  }),
}));
jest.mock("@/features/onboarding/onboarding-store", () => ({
  useOnboarding: () => ({ status: "premium_required", completeAccess: mockCompleteAccess }),
}));
jest.mock("@/features/billing/billing-provider", () => ({
  useBilling: () => ({
    state: "ready",
    plans: { monthly: { identifier: "$rc_monthly", productIdentifier: "formie_monthly", priceString: "$12.49", title: "Formie Monthly" }, annual: null },
    error: null,
    restoreMessage: "Purchase restored.",
    restore: mockRestore,
    purchase: mockPurchase,
    retryPurchaseSync: jest.fn(),
  }),
}));
jest.mock("@/screens/onboarding/premium-screen", () => ({
  PremiumScreen: (props: Record<string, unknown>) => { capturedProps = props; return null; },
}));

describe("SubscriptionRoute", () => {
  beforeEach(() => {
    capturedProps = null;
    mockReplace.mockClear();
    mockBack.mockClear();
    mockOpenUrl.mockClear();
    mockRestore.mockReset().mockResolvedValue(false);
    mockPurchase.mockReset().mockResolvedValue("inactive");
    mockRefresh.mockReset().mockResolvedValue(undefined);
    mockCompleteAccess.mockReset().mockResolvedValue(undefined);
    mockReturnTo = undefined;
  });

  it("forwards the live price, restore state, and production legal actions", async () => {
    render(<SubscriptionRoute />);
    await waitFor(() => expect(capturedProps).not.toBeNull());

    expect(capturedProps?.price).toBe("$12.49");
    expect(capturedProps?.restoreMessage).toBe("Purchase restored.");
    await act(async () => { (capturedProps?.onRestore as () => void)(); });
    await act(async () => { (capturedProps?.onOpenTerms as () => void)(); });
    await act(async () => { (capturedProps?.onOpenPrivacy as () => void)(); });

    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(mockOpenUrl).toHaveBeenNthCalledWith(1, "https://useformie.com/terms");
    expect(mockOpenUrl).toHaveBeenNthCalledWith(2, "https://useformie.com/privacy");
  });

  it("continues a new account into exercise selection after purchase", async () => {
    mockReturnTo = "/exercise-selection";
    mockPurchase.mockResolvedValue("active");
    render(<SubscriptionRoute />);
    await waitFor(() => expect(capturedProps).not.toBeNull());

    await act(async () => { await (capturedProps?.onPurchase as () => Promise<void>)(); });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockCompleteAccess).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/exercise-selection");
  });
});
