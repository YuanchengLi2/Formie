import { safeAnalyticsProperties } from "./product-analytics-utils";

describe("product analytics", () => {
  it("keeps raw video and free-form coaching content out of properties", () => {
    expect(safeAnalyticsProperties({ step: 3, onboardingVersion: "certainty-v1", video: { uri: "private" }, question: "raw text" })).toEqual({ step: 3, onboardingVersion: "certainty-v1" });
  });
});
