import { safeAnalyticsProperties } from "./product-analytics-utils";

describe("product analytics", () => {
  it("keeps raw video and free-form coaching content out of properties", () => {
    expect(safeAnalyticsProperties("onboarding_screen_viewed", { step: 3, onboardingVersion: "certainty-v1", video: { uri: "private" }, question: "raw text" })).toEqual({ step: 3, onboardingVersion: "certainty-v1" });
  });

  it("uses event-specific property schemas", () => {
    expect(safeAnalyticsProperties("exercise_selected", { exerciseId: 42, source: "catalog", errorCategory: "leak" })).toEqual({ exerciseId: 42, source: "catalog" });
    expect(safeAnalyticsProperties("recording_failed", { errorCategory: "camera_unavailable", uri: "file:///private.mov" })).toEqual({ errorCategory: "camera_unavailable" });
  });

  it("collapses custom exercises and rejects unsafe scalar text", () => {
    expect(safeAnalyticsProperties("exercise_selected", { exerciseId: "custom", source: "custom" })).toEqual({ exerciseId: "custom", source: "custom" });
    expect(safeAnalyticsProperties("recording_failed", { errorCategory: "person@example.com" })).toEqual({});
  });
});
