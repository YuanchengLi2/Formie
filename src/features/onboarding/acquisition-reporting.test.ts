import { initialOnboardingAnswers } from "./types";
import { recordOnboardingAcquisition } from "./acquisition-reporting";

describe("recordOnboardingAcquisition", () => {
  it("records only the minimal normalized acquisition payload", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: "response-1", error: null });
    const answers = { ...initialOnboardingAnswers, acquisitionSource: "instagram" as const };

    await expect(recordOnboardingAcquisition({ rpc }, answers, "ios")).resolves.toBe("response-1");
    expect(rpc).toHaveBeenCalledWith("record_onboarding_acquisition", {
      p_source: "instagram",
      p_other_detail: "",
      p_platform: "ios",
      p_onboarding_version: "approved-v1",
    });
  });

  it("requires and trims bounded Other detail", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: "response-2", error: null });
    const answers = { ...initialOnboardingAnswers, acquisitionSource: "other" as const, acquisitionSourceOther: "  Podcast  " };
    await recordOnboardingAcquisition({ rpc }, answers, "windows");
    expect(rpc).toHaveBeenCalledWith("record_onboarding_acquisition", expect.objectContaining({ p_other_detail: "Podcast", p_platform: "unknown" }));
  });

  it("fails profile sync when the required answer is absent or durable storage fails", async () => {
    await expect(recordOnboardingAcquisition({ rpc: jest.fn() }, initialOnboardingAnswers, "ios")).rejects.toThrow(/required/i);
    await expect(recordOnboardingAcquisition({ rpc: jest.fn().mockResolvedValue({ data: null, error: { message: "database unavailable" } }) }, { ...initialOnboardingAnswers, acquisitionSource: "youtube" }, "android")).rejects.toThrow("database unavailable");
  });
});
