import { supabase } from "@/lib/supabase";

export type PendingReferral = { token: string; visitId: string; creatorCode: string; creatorDisplayName: string; issuedAt: string; expiresAt: string };
export type ReferralMethod = "creator_code";
export type ReferralStatus = { state: "none" | "attributed"; creatorDisplayName: string | null; attributedAt: string | null };

function functionPayload(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {};
}

export class ReferralRequestError extends Error {
  constructor(message: string, readonly permanent: boolean) { super(message); this.name = "ReferralRequestError"; }
}

export function isPermanentReferralError(error: unknown): boolean {
  return error instanceof ReferralRequestError && error.permanent;
}

function invocationError(error: unknown): ReferralRequestError {
  const context = error && typeof error === "object" && "context" in error ? (error as { context?: unknown }).context : null;
  const status = context && typeof context === "object" && "status" in context ? Number((context as { status?: unknown }).status) : null;
  const message = status === 404
    ? "That creator code isn't valid. Check it and try again."
    : status === 409
      ? "Creator codes are temporarily unavailable. You can go back and continue without one."
      : status === 429
        ? "Too many code attempts. Wait a few minutes and try again."
      : error instanceof Error ? error.message : "REFERRAL_UNAVAILABLE";
  return new ReferralRequestError(message, status !== null && [400, 404, 409, 410, 422].includes(status));
}

export async function previewReferral(token: string): Promise<PendingReferral> {
  const { data, error } = await supabase.functions.invoke("referral-context", { body: { action: "preview", token } });
  if (error) throw invocationError(error);
  const referral = functionPayload(functionPayload(data).referral);
  if (referral.eligible !== true || typeof referral.visitId !== "string" || typeof referral.creatorDisplayName !== "string" || typeof referral.issuedAt !== "string" || typeof referral.expiresAt !== "string") throw new Error("REFERRAL_UNAVAILABLE");
  return { token, visitId: referral.visitId, creatorCode: typeof referral.creatorCode === "string" ? referral.creatorCode : "", creatorDisplayName: referral.creatorDisplayName, issuedAt: referral.issuedAt, expiresAt: referral.expiresAt };
}

export function normalizeCreatorCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);
}

export async function previewCreatorCode(code: string): Promise<PendingReferral> {
  const normalized = normalizeCreatorCode(code);
  if (!/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(normalized)) {
    throw new ReferralRequestError("Enter a valid creator code.", true);
  }
  const { data, error } = await supabase.functions.invoke("referral-context", { body: { action: "code_preview", code: normalized } });
  if (error) throw invocationError(error);
  const referral = functionPayload(functionPayload(data).referral);
  if (referral.eligible !== true || typeof referral.token !== "string" || typeof referral.visitId !== "string" || typeof referral.creatorCode !== "string" || typeof referral.creatorDisplayName !== "string" || typeof referral.issuedAt !== "string" || typeof referral.expiresAt !== "string") throw new ReferralRequestError("That creator code is not available.", true);
  return { token: referral.token, visitId: referral.visitId, creatorCode: referral.creatorCode, creatorDisplayName: referral.creatorDisplayName, issuedAt: referral.issuedAt, expiresAt: referral.expiresAt };
}

export async function claimReferral(token: string, method: ReferralMethod): Promise<{ creatorDisplayName: string; attributedAt: string }> {
  const { data, error } = await supabase.functions.invoke("referral-context", { body: { action: "claim", token, method } });
  if (error) throw invocationError(error);
  const referral = functionPayload(functionPayload(data).referral);
  if (typeof referral.creatorDisplayName !== "string" || typeof referral.attributedAt !== "string") throw new Error("REFERRAL_UNAVAILABLE");
  return { creatorDisplayName: referral.creatorDisplayName, attributedAt: referral.attributedAt };
}

export async function getReferralStatus(): Promise<ReferralStatus> {
  const { data, error } = await supabase.functions.invoke("referral-context", { body: { action: "status" } });
  if (error) throw error;
  const referral = functionPayload(functionPayload(data).referral);
  if (referral.attributed_at && typeof referral.attributed_at === "string") {
    const creator = functionPayload(referral.creators);
    return { state: "attributed", creatorDisplayName: typeof creator.display_name === "string" ? creator.display_name : null, attributedAt: referral.attributed_at };
  }
  return { state: "none", creatorDisplayName: null, attributedAt: null };
}
