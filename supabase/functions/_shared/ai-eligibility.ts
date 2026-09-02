export type AiEligibilityErrorCode = "AGE_RESTRICTED" | "AI_CONSENT_REQUIRED";

export class AiEligibilityError extends Error {
  readonly status = 403;
  constructor(readonly code: AiEligibilityErrorCode) {
    super(code === "AGE_RESTRICTED" ? "Formie AI processing is available only to adults 18 or older." : "Review and accept the current AI processing notice before continuing.");
    this.name = "AiEligibilityError";
  }
}

export async function requireAiEligibility({
  userId,
  requiredConsentVersion,
  requiredNoticeSha256,
  loadProfile,
  loadConsent,
}: {
  userId: string;
  requiredConsentVersion: string;
  requiredNoticeSha256: string;
  loadProfile: (userId: string) => Promise<{ ageYears: number | null } | null>;
  loadConsent: (userId: string) => Promise<{ version: string; noticeSha256: string; revokedAt: string | null } | null>;
}): Promise<void> {
  const profile = await loadProfile(userId);
  if (!profile || typeof profile.ageYears !== "number" || profile.ageYears < 18) {
    throw new AiEligibilityError("AGE_RESTRICTED");
  }
  const consent = await loadConsent(userId);
  if (!consent || consent.version !== requiredConsentVersion || consent.noticeSha256 !== requiredNoticeSha256 || consent.revokedAt !== null) {
    throw new AiEligibilityError("AI_CONSENT_REQUIRED");
  }
}

export function requiredAiConsentNotice(): { version: string; noticeSha256: string } {
  const version = Deno.env.get("AI_PROCESSING_CONSENT_VERSION")?.trim() ?? "";
  const noticeSha256 = Deno.env.get("AI_PROCESSING_NOTICE_SHA256")?.trim() ?? "";
  if (!version) throw new Error("AI_PROCESSING_CONSENT_VERSION is not configured");
  if (!/^[a-f0-9]{64}$/.test(noticeSha256)) throw new Error("AI_PROCESSING_NOTICE_SHA256 is not configured");
  return { version, noticeSha256 };
}

type EligibilityAdmin = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        is(column: string, value: null): { order(column: string, options: { ascending: boolean }): { limit(count: number): { maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown }> } } };
        maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown }>;
      };
    };
  };
};

export async function requireCurrentAiEligibility(admin: EligibilityAdmin, userId: string, notice = requiredAiConsentNotice()): Promise<void> {
  return requireAiEligibility({
    userId,
    requiredConsentVersion: notice.version,
    requiredNoticeSha256: notice.noticeSha256,
    loadProfile: async () => {
      const { data, error } = await admin.from("user_profiles").select("age_years").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data ? { ageYears: typeof data.age_years === "number" ? data.age_years : null } : null;
    },
    loadConsent: async () => {
      const { data, error } = await admin.from("user_consents")
        .select("version,notice_sha256,revoked_at,accepted_at")
        .eq("user_id", userId)
        .is("revoked_at", null)
        .order("accepted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? { version: String(data.version), noticeSha256: String(data.notice_sha256), revokedAt: typeof data.revoked_at === "string" ? data.revoked_at : null } : null;
    },
  });
}

export function aiEligibilityErrorResponse(error: unknown): Response | null {
  if (!(error instanceof AiEligibilityError)) return null;
  return new Response(JSON.stringify({ message: error.message, code: error.code }), {
    status: error.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
