import {
  assertGenerallyAvailableGeminiModel,
  geminiGovernanceFromValues,
} from "./gemini-governance";

describe("Gemini production governance", () => {
  it("requires a billing-enabled paid service", () => {
    expect(() => geminiGovernanceFromValues({
      paidServiceConfirmed: "false",
      voluntaryLogSharingDisabled: "true",
    })).toThrow("GEMINI_PAID_SERVICE_NOT_CONFIRMED");
  });

  it("requires voluntary log sharing to be disabled", () => {
    expect(() => geminiGovernanceFromValues({
      paidServiceConfirmed: "true",
      voluntaryLogSharingDisabled: "false",
    })).toThrow("GEMINI_VOLUNTARY_LOG_SHARING_NOT_DISABLED");
  });

  it("accepts the exact confirmed production configuration", () => {
    expect(geminiGovernanceFromValues({
      paidServiceConfirmed: "true",
      voluntaryLogSharingDisabled: "true",
    })).toBeDefined();
  });

  it.each([
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
    "gemini-flash-latest",
    "gemini-3.7-flash-exp",
    "gemini-3.7-flash-001",
    "gemini-test",
  ])("rejects non-GA or mutable model id %s", (model) => {
    expect(() => assertGenerallyAvailableGeminiModel(model)).toThrow("GEMINI_MODEL_NOT_APPROVED_FOR_PRODUCTION");
  });

  it.each([
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
  ])("accepts official stable model id %s", (model) => {
    expect(() => assertGenerallyAvailableGeminiModel(model)).not.toThrow();
  });
});
