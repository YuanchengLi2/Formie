import { safeAnalyticsProperties } from "./product-analytics-utils";

describe("product analytics", () => {
  it("keeps raw video and free-form coaching content out of properties", () => {
    expect(safeAnalyticsProperties({ step: 3, onboardingVersion: "certainty-v1", video: { uri: "private" }, question: "raw text" })).toEqual({ step: 3, onboardingVersion: "certainty-v1" });
  });

  it("rejects identity, body/profile values, tutorial queries, AI content, and free text", () => {
    expect(safeAnalyticsProperties({
      screenId: "results",
      platform: "ios",
      email: "person@example.com",
      userId: "private-user-id",
      age: 32,
      gender: "female",
      heightCm: 170,
      weightKg: 70,
      health: "private",
      body: "private",
      exerciseVideo: "file:///private.mp4",
      tutorialQuery: "private custom text",
      declaration: { exercise: "private" },
      prompt: "private AI prompt",
      response: "private AI response",
      focusNote: "free text",
      supportMessage: "free text",
    })).toEqual({ screenId: "results", platform: "ios" });
  });
});
