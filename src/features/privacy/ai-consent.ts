export const AI_PROCESSING_NOTICE_VERSION = "2026-09-01";

export const AI_PROCESSING_NOTICE = "Formie sends your exercise video, exercise declaration, and relevant profile information to Formie's servers and the paid Google Gemini API to provide the analysis you request. Google may retain limited data for abuse and safety monitoring. You can withdraw consent for future analyses and delete analyses or your account.";

export const AI_PROCESSING_NOTICE_SHA256 = "739cb7347c35cdf9e4bfec5588113dde724eff88d0b28b215745549dd9a2be20";

export type AiProcessingConsent = {
  version: string;
  noticeSha256: string;
  acceptedAt: string;
  revokedAt: string | null;
};

type ConsentRow = {
  version: string;
  notice_sha256: string;
  accepted_at: string;
  revoked_at: string | null;
};

type RpcResult = Promise<{
  data: ConsentRow | ConsentRow[] | null;
  error: { message?: string } | null;
}>;

export type AiConsentClient = {
  rpc: (name: string, parameters?: Record<string, string>) => RpcResult;
};

function throwRpcError(error: { message?: string } | null, fallback: string): void {
  if (error) throw new Error(error.message ?? fallback);
}

function normalizeConsent(data: ConsentRow | ConsentRow[] | null): AiProcessingConsent | null {
  const row = Array.isArray(data) ? data[0] ?? null : data;
  if (!row) return null;
  return {
    version: row.version,
    noticeSha256: row.notice_sha256,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
  };
}

export function isCurrentAiProcessingConsent(consent: AiProcessingConsent | null): boolean {
  return Boolean(
    consent
    && consent.version === AI_PROCESSING_NOTICE_VERSION
    && consent.noticeSha256 === AI_PROCESSING_NOTICE_SHA256
    && !consent.revokedAt,
  );
}

export async function currentAiProcessingConsent(client: AiConsentClient): Promise<AiProcessingConsent | null> {
  const { data, error } = await client.rpc("current_ai_processing_consent");
  throwRpcError(error, "AI processing consent could not be loaded.");
  return normalizeConsent(data);
}

export async function acceptAiProcessingConsent(client: AiConsentClient): Promise<void> {
  const { error } = await client.rpc("record_ai_processing_consent", {
    p_version: AI_PROCESSING_NOTICE_VERSION,
    p_notice_sha256: AI_PROCESSING_NOTICE_SHA256,
  });
  throwRpcError(error, "AI processing consent could not be saved.");
}

export async function revokeAiProcessingConsent(client: AiConsentClient): Promise<void> {
  const { error } = await client.rpc("revoke_ai_processing_consent", {
    p_version: AI_PROCESSING_NOTICE_VERSION,
  });
  throwRpcError(error, "AI processing consent could not be withdrawn.");
}
