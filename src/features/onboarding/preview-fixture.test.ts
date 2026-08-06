import { onboardingPreviewFixture } from "./preview-fixture";

describe("onboarding preview fixture", () => {
  it("keeps the showcase internally consistent", () => {
    expect(onboardingPreviewFixture.issueTitle).toContain("descent");
    expect(onboardingPreviewFixture.timestamp).toMatch(/^\d{2}:\d{2}\.\d$/);
    expect(onboardingPreviewFixture.strengths.length).toBeGreaterThan(0);
    expect(onboardingPreviewFixture.cue).toContain("lowering");
  });
});
