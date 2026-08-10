const mockShowManageSubscriptions = jest.fn<Promise<void>, []>();
const mockGetCustomerInfo = jest.fn();
const mockOpenURL = jest.fn<Promise<unknown>, [string]>();

jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    showManageSubscriptions: mockShowManageSubscriptions,
    getCustomerInfo: mockGetCustomerInfo,
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
    mockGetCustomerInfo.mockReset();
    mockOpenURL.mockReset().mockResolvedValue(undefined);
  });

  it("uses Apple's native subscription sheet on iOS", async () => {
    const { showNativeSubscriptionManagement } = require("./purchases.native") as typeof import("./purchases.native");
    await showNativeSubscriptionManagement();
    expect(mockShowManageSubscriptions).toHaveBeenCalledTimes(1);
    expect(mockGetCustomerInfo).not.toHaveBeenCalled();
    expect(mockOpenURL).not.toHaveBeenCalled();
  });
});
