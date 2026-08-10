const mockShowManageSubscriptions = jest.fn<Promise<void>, []>();
const mockGetCustomerInfo = jest.fn();
const mockOpenURL = jest.fn<Promise<unknown>, [string]>();
const mockIsConfigured = jest.fn<Promise<boolean>, []>();
const mockConfigure = jest.fn();
const mockLogIn = jest.fn<Promise<unknown>, [string]>();
const mockLogOut = jest.fn<Promise<unknown>, []>();

jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    showManageSubscriptions: mockShowManageSubscriptions,
    getCustomerInfo: mockGetCustomerInfo,
    isConfigured: mockIsConfigured,
    configure: mockConfigure,
    logIn: mockLogIn,
    logOut: mockLogOut,
  },
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
  Linking: { openURL: mockOpenURL },
}));

describe("native subscription management", () => {
  beforeEach(() => {
    jest.resetModules();
    mockShowManageSubscriptions.mockReset().mockResolvedValue(undefined);
    mockGetCustomerInfo.mockReset().mockResolvedValue({
      entitlements: { all: {}, active: {} },
      originalAppUserId: "supabase-user-from-google",
      managementURL: null,
    });
    mockOpenURL.mockReset().mockResolvedValue(undefined);
    mockIsConfigured.mockReset().mockResolvedValue(true);
    mockConfigure.mockReset();
    mockLogIn.mockReset().mockResolvedValue({});
    mockLogOut.mockReset().mockResolvedValue({});
    process.env.EXPO_OS = "ios";
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_PUBLIC_KEY = "appl_test_public_key";
  });

  it("uses Apple's native subscription sheet on iOS", async () => {
    const { showNativeSubscriptionManagement } = require("./purchases.native") as typeof import("./purchases.native");
    await showNativeSubscriptionManagement();
    expect(mockShowManageSubscriptions).toHaveBeenCalledTimes(1);
    expect(mockGetCustomerInfo).not.toHaveBeenCalled();
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it("identifies an authenticated Google session by its Supabase UUID before billing reads", async () => {
    const { purchasesClient } = require("./purchases.native") as typeof import("./purchases.native");

    await purchasesClient.configure(null);
    await purchasesClient.configure("supabase-user-from-google");
    await purchasesClient.getCustomerInfo();

    expect(mockLogIn).toHaveBeenCalledWith("supabase-user-from-google");
    expect(mockLogIn.mock.invocationCallOrder[0]).toBeLessThan(mockGetCustomerInfo.mock.invocationCallOrder[0]);
  });

  it("does not create a second RevenueCat identity when the same Supabase user configures again", async () => {
    const { purchasesClient } = require("./purchases.native") as typeof import("./purchases.native");

    await purchasesClient.configure("shared-supabase-user");
    await purchasesClient.configure("shared-supabase-user");

    expect(mockLogIn).toHaveBeenCalledTimes(1);
    expect(mockLogIn).toHaveBeenCalledWith("shared-supabase-user");
  });
});
