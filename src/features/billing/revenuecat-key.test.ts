import { assertRevenueCatPublicKey } from "./constants";

describe("RevenueCat key validation", () => {
  it("rejects a Test Store key in a release build", () => {
    expect(() => assertRevenueCatPublicKey("test_example", { platform: "web", releaseBuild: true })).toThrow(
      /Test Store.*release/i,
    );
  });

  it.each(["ios", "android"] as const)("rejects a Test Store key for native %s development", (platform) => {
    expect(() => assertRevenueCatPublicKey("test_example", { platform, releaseBuild: false })).toThrow(
      /Test Store.*native/i,
    );
  });

  it("keeps Test Store available to web development and accepts the App Store key on iOS", () => {
    expect(() => assertRevenueCatPublicKey("test_example", { platform: "web", releaseBuild: false })).not.toThrow();
    expect(() => assertRevenueCatPublicKey("appl_example", { platform: "ios", releaseBuild: false })).not.toThrow();
  });
});
