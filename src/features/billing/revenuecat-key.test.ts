import { assertRevenueCatPublicKey } from "./constants";

describe("RevenueCat release key validation", () => {
  it("rejects a Test Store key in a release build", () => {
    expect(() => assertRevenueCatPublicKey("test_example", true)).toThrow(
      /Test Store.*release/i,
    );
  });

  it("allows Test Store keys only in development and accepts a real store key in release", () => {
    expect(() => assertRevenueCatPublicKey("test_example", false)).not.toThrow();
    expect(() => assertRevenueCatPublicKey("appl_example", true)).not.toThrow();
  });
});
