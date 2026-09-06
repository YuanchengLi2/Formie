import { creatorCode, previewFromRows, referralToken, type ReferralPreviewRow } from "../_shared/referral-attribution.ts";

type ReferralMethod = "creator_code";

type Dependencies = {
  authenticate: (request: Request) => Promise<string>;
  hashToken: (token: string) => Promise<string>;
  createToken: () => string;
  issueCode: (input: { code: string; tokenHash: string }) => Promise<unknown>;
  preview: (tokenHash: string) => Promise<unknown>;
  claim: (input: { tokenHash: string; userId: string; method: ReferralMethod }) => Promise<unknown>;
  status: (userId: string) => Promise<unknown>;
  finalize: (input: { userId: string; tokenHash: string | null; method: ReferralMethod; profile: Record<string, unknown>; acquisition: Record<string, unknown> }) => Promise<unknown>;
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function claimedRow(value: unknown) {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const item = row as Record<string, unknown>;
  return typeof item.creator_display_name === "string" && typeof item.attributed_at === "string" ? item : null;
}

export async function referralContextHandler(request: Request, dependencies: Dependencies): Promise<Response> {
  if (request.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ code: "INVALID_BODY" }, 400); }
  const action = body.action;
  if (action === "code_preview") {
    const code = creatorCode(body.code);
    if (!code) return json({ code: "INVALID_CREATOR_CODE" }, 400);
    const token = dependencies.createToken();
    const tokenHash = await dependencies.hashToken(token);
    try {
      const preview = previewFromRows(await dependencies.issueCode({ code: code.toLowerCase(), tokenHash }));
      if (!preview?.eligible) return json({ code: "CREATOR_CODE_UNAVAILABLE" }, 404);
      return json({ referral: {
        token,
        visitId: preview.visit_id,
        creatorCode: code,
        creatorDisplayName: preview.creator_display_name,
        issuedAt: preview.issued_at,
        expiresAt: preview.expires_at,
        eligible: true,
      } satisfies Record<string, unknown> });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("RATE_LIMITED")) return json({ code: "RATE_LIMITED" }, 429);
      if (message.includes("REFERRAL_ISSUANCE_DISABLED")) return json({ code: "REFERRAL_PROGRAM_DISABLED" }, 409);
      return json({ code: "CREATOR_CODE_UNAVAILABLE" }, 404);
    }
  }
  if (action === "status") {
    try {
      const userId = await dependencies.authenticate(request);
      return json({ referral: await dependencies.status(userId) });
    } catch { return json({ code: "UNAUTHORIZED" }, 401); }
  }
  if (action === "finalize") {
    try {
      const userId = await dependencies.authenticate(request);
      const profile = body.profile;
      const acquisition = body.acquisition;
      if (!profile || typeof profile !== "object" || Array.isArray(profile) || !acquisition || typeof acquisition !== "object" || Array.isArray(acquisition)) return json({ code: "INVALID_BODY" }, 400);
      const rawToken = body.token === null || body.token === undefined ? null : referralToken(body.token);
      if (body.token !== null && body.token !== undefined && !rawToken) return json({ code: "INVALID_REFERRAL_TOKEN" }, 400);
      if (body.method !== undefined && body.method !== "creator_code") return json({ code: "INVALID_REFERRAL_METHOD" }, 400);
      const result = await dependencies.finalize({
        userId,
        tokenHash: rawToken ? await dependencies.hashToken(rawToken) : null,
        method: "creator_code",
        profile: profile as Record<string, unknown>,
        acquisition: acquisition as Record<string, unknown>,
      });
      return json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("UNAUTHORIZED")) return json({ code: "UNAUTHORIZED" }, 401);
      return json({ code: "ONBOARDING_FINALIZATION_FAILED" }, 422);
    }
  }
  const token = referralToken(body.token);
  if (!token) return json({ code: "INVALID_REFERRAL_TOKEN" }, 400);
  const tokenHash = await dependencies.hashToken(token);
  if (action === "preview") {
    const preview = previewFromRows(await dependencies.preview(tokenHash));
    if (!preview?.eligible) return json({ code: "REFERRAL_UNAVAILABLE" }, 404);
    return json({ referral: {
      visitId: preview.visit_id,
      creatorDisplayName: preview.creator_display_name,
      issuedAt: preview.issued_at,
      expiresAt: preview.expires_at,
      eligible: preview.eligible,
    } satisfies Record<string, unknown> });
  }
  if (action === "claim") {
    try {
      const userId = await dependencies.authenticate(request);
      if (body.method !== "creator_code") return json({ code: "INVALID_REFERRAL_METHOD" }, 400);
      const referral = claimedRow(await dependencies.claim({ tokenHash, userId, method: "creator_code" }));
      if (!referral) return json({ code: "REFERRAL_UNAVAILABLE" }, 409);
      return json({ referral: { creatorDisplayName: referral.creator_display_name, attributedAt: referral.attributed_at, alreadyClaimed: referral.already_claimed === true } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("UNAUTHORIZED")) return json({ code: "UNAUTHORIZED" }, 401);
      if (message.includes("INELIGIBLE") || message.includes("AFTER_ACCOUNT_CREATION") || message.includes("ALREADY_CLAIMED")) return json({ code: "REFERRAL_ACCOUNT_INELIGIBLE" }, 409);
      return json({ code: "REFERRAL_UNAVAILABLE" }, 404);
    }
  }
  return json({ code: "INVALID_ACTION" }, 400);
}
