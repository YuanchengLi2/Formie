import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SubscriptionAccessGate } from "./subscription-access-gate";

const mockRefresh = jest.fn().mockResolvedValue({ status: "active" });
const mockPurchase = jest.fn().mockResolvedValue(true);
const mockRestore = jest.fn().mockResolvedValue(true);
const mockBillingLogOut = jest.fn().mockResolvedValue(undefined);
const mockAuthLogOut = jest.fn().mockResolvedValue(undefined);
let mockProviderStatus: "loading" | "ready" | "error" = "ready";
let mockAccessStatus: "active" | "expired" | "unknown" = "active";

jest.mock("expo-linking", () => ({ openURL: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/features/auth/auth-provider", () => ({ useAuth: () => ({ phase: "authenticated", user: { id: "user-1" }, logOut: mockAuthLogOut }) }));
jest.mock("@/features/profile/profile-provider", () => ({ useProfile: () => ({ profile: { onboardingCompleted: true, onboardingVersion: "approved-v1" } }) }));
jest.mock("@/features/access/access-provider", () => ({ useAccess: () => ({ status: mockProviderStatus, access: { status: mockAccessStatus }, error: mockProviderStatus === "error" ? "offline" : null, refresh: mockRefresh }) }));
jest.mock("@/features/billing/billing-provider", () => ({ useBilling: () => ({ state: "ready", priceString: "$9.99", purchase: mockPurchase, restore: mockRestore, logOut: mockBillingLogOut, error: null, restoreMessage: null }) }));

describe("SubscriptionAccessGate", () => {
  const gated = () => <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}><SubscriptionAccessGate><Text>Protected history</Text></SubscriptionAccessGate></SafeAreaProvider>;
  beforeEach(() => {
    jest.clearAllMocks();
    mockProviderStatus = "ready";
    mockAccessStatus = "active";
  });

  it("renders protected application content only for active completed accounts", async () => {
    const screen = await render(gated());
    expect(screen.getByText("Protected history")).toBeTruthy();
  });

  it("keeps application content visible after paid access ends", async () => {
    mockAccessStatus = "expired";
    const screen = await render(gated());
    expect(screen.getByText("Protected history")).toBeTruthy();
    expect(screen.queryByText("Subscription required")).toBeNull();
    expect(mockPurchase).not.toHaveBeenCalled();
    expect(mockRestore).not.toHaveBeenCalled();
  });

  it("keeps unknown access distinct from expiry and offers retry, support, and sign out", async () => {
    mockProviderStatus = "error";
    mockAccessStatus = "unknown";
    const screen = await render(gated());
    expect(screen.queryByText("Subscription required")).toBeNull();
    expect(screen.getByText("We couldn’t verify your subscription")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Retry access check" }));
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockBillingLogOut).toHaveBeenCalledTimes(1);
    expect(mockAuthLogOut).toHaveBeenCalledWith("user");
  });
});
