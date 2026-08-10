import { fireEvent, render } from "@testing-library/react-native";

import ManageSubscriptionRoute from "@/app/account/manage-subscription";

const mockReplace = jest.fn();
const mockManageSubscription = jest.fn<Promise<void>, []>();
let mockAccess: Record<string, unknown>;

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/features/access/access-provider", () => ({
  useAccess: () => ({ access: mockAccess }),
}));

jest.mock("@/features/billing/billing-provider", () => ({
  useBilling: () => ({ manageSubscription: mockManageSubscription }),
}));

describe("ManageSubscriptionRoute", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockManageSubscription.mockReset().mockResolvedValue(undefined);
    mockAccess = {
      status: "active",
      lifecycleState: "active_renewing",
      store: "app_store",
      paidThrough: "2026-08-11T02:34:50Z",
      remaining: 9,
      quotaLimit: 10,
      planCode: "monthly",
      willRenew: true,
    };
  });

  it("loads current Apple subscription state and opens native management", async () => {
    const screen = await render(<ManageSubscriptionRoute />);

    expect(screen.getByText("Automatic renewal is on")).toBeTruthy();
    expect(screen.getByText("9/10 analyses remaining")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Manage in Apple" }));
    expect(mockManageSubscription).toHaveBeenCalledTimes(1);
  });

  it("routes an expired account to the in-app resubscription purchase", async () => {
    mockAccess = { ...mockAccess, status: "expired", lifecycleState: "expired", willRenew: false };
    const screen = await render(<ManageSubscriptionRoute />);

    expect(screen.getByText("Your subscription has ended")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Resubscribe in Formie" }));
    expect(mockReplace).toHaveBeenCalledWith("/subscription");
  });
});
