import { nextOnboardingStepForAnswers, previousOnboardingStepForAnswers } from "./types";

describe("creator code onboarding navigation", () => {
  it("opens the code page only for affiliated creator acquisition", () => {
    expect(nextOnboardingStepForAnswers("acquisition-source", "affiliated_creator")).toBe("creator-code");
    expect(nextOnboardingStepForAnswers("acquisition-source", "youtube")).toBe("long-term-value");
  });

  it("returns from long-term value to the correct prior page", () => {
    expect(previousOnboardingStepForAnswers("long-term-value", "affiliated_creator")).toBe("creator-code");
    expect(previousOnboardingStepForAnswers("long-term-value", "youtube")).toBe("acquisition-source");
  });
});
