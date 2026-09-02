const APPROVED_GA_MODELS = new Set([
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
]);

declare const governanceBrand: unique symbol;

export type GeminiGovernance = Readonly<{
  paidServiceConfirmed: true;
  voluntaryLogSharingDisabled: true;
  [governanceBrand]: true;
}>;

export type GeminiGovernanceValues = {
  paidServiceConfirmed: string | undefined;
  voluntaryLogSharingDisabled: string | undefined;
};

export function geminiGovernanceFromValues(values: GeminiGovernanceValues): GeminiGovernance {
  if (values.paidServiceConfirmed !== "true") {
    throw Object.assign(new Error("GEMINI_PAID_SERVICE_NOT_CONFIRMED"), { code: "GEMINI_PAID_SERVICE_NOT_CONFIRMED" });
  }
  if (values.voluntaryLogSharingDisabled !== "true") {
    throw Object.assign(new Error("GEMINI_VOLUNTARY_LOG_SHARING_NOT_DISABLED"), { code: "GEMINI_VOLUNTARY_LOG_SHARING_NOT_DISABLED" });
  }
  return {
    paidServiceConfirmed: true,
    voluntaryLogSharingDisabled: true,
  } as GeminiGovernance;
}

export function geminiGovernanceFromEnvironment(get: (name: string) => string | undefined): GeminiGovernance {
  return geminiGovernanceFromValues({
    paidServiceConfirmed: get("GEMINI_PAID_SERVICE_CONFIRMED")?.trim(),
    voluntaryLogSharingDisabled: get("GEMINI_VOLUNTARY_LOG_SHARING_DISABLED")?.trim(),
  });
}

export function assertGenerallyAvailableGeminiModel(model: string): void {
  if (!APPROVED_GA_MODELS.has(model)) {
    throw Object.assign(new Error(`GEMINI_MODEL_NOT_APPROVED_FOR_PRODUCTION: ${model || "missing"}`), {
      code: "GEMINI_MODEL_NOT_APPROVED_FOR_PRODUCTION",
    });
  }
}
