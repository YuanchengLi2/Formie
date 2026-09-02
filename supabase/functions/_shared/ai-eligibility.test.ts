import { AiEligibilityError, requireAiEligibility } from "./ai-eligibility";

describe("AI eligibility", () => {
  it("allows only an adult profile with the exact current consent version", async () => {
    await expect(requireAiEligibility({
      userId: "user-1",
      requiredConsentVersion: "2026-09-01",
      requiredNoticeSha256: "current-notice-hash",
      loadProfile: async () => ({ ageYears: 18 }),
      loadConsent: async () => ({ version: "2026-09-01", noticeSha256: "current-notice-hash", revokedAt: null }),
    })).resolves.toBeUndefined();
  });

  it.each([null, 17])("fails closed for non-adult age %p", async (ageYears) => {
    await expect(requireAiEligibility({
      userId: "user-1",
      requiredConsentVersion: "2026-09-01",
      requiredNoticeSha256: "current-notice-hash",
      loadProfile: async () => ({ ageYears }),
      loadConsent: async () => ({ version: "2026-09-01", noticeSha256: "current-notice-hash", revokedAt: null }),
    })).rejects.toEqual(expect.objectContaining<Partial<AiEligibilityError>>({ code: "AGE_RESTRICTED", status: 403 }));
  });

  it.each([
    null,
    { version: "old-version", noticeSha256: "current-notice-hash", revokedAt: null },
    { version: "2026-09-01", noticeSha256: "wrong-notice-hash", revokedAt: null },
    { version: "2026-09-01", noticeSha256: "current-notice-hash", revokedAt: "2026-09-01T12:00:00Z" },
  ])("fails closed when current consent is absent, stale, or revoked", async (consent) => {
    await expect(requireAiEligibility({
      userId: "user-1",
      requiredConsentVersion: "2026-09-01",
      requiredNoticeSha256: "current-notice-hash",
      loadProfile: async () => ({ ageYears: 27 }),
      loadConsent: async () => consent,
    })).rejects.toEqual(expect.objectContaining<Partial<AiEligibilityError>>({ code: "AI_CONSENT_REQUIRED", status: 403 }));
  });
});
