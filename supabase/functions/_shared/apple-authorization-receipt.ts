import { decryptSecretEnvelope, encryptSecretEnvelope } from "./secret-envelope.ts";

const RECEIPT_LIFETIME_MS = 5 * 60 * 1000;

type AppleAuthorizationReceiptPayload = {
  version: 1;
  refreshToken: string;
  subject: string;
  expiresAt: string;
};

export async function createAppleAuthorizationReceipt(
  input: { refreshToken: string; subject: string },
  key: Uint8Array,
  now = new Date(),
): Promise<string> {
  const payload: AppleAuthorizationReceiptPayload = {
    version: 1,
    refreshToken: input.refreshToken,
    subject: input.subject,
    expiresAt: new Date(now.getTime() + RECEIPT_LIFETIME_MS).toISOString(),
  };
  return encryptSecretEnvelope(JSON.stringify(payload), key);
}

export async function openAppleAuthorizationReceipt(
  receipt: string,
  key: Uint8Array,
  now = new Date(),
): Promise<{ refreshToken: string; subject: string }> {
  let payload: Partial<AppleAuthorizationReceiptPayload>;
  try {
    payload = JSON.parse(await decryptSecretEnvelope(receipt, key)) as Partial<AppleAuthorizationReceiptPayload>;
  } catch {
    throw new Error("APPLE_AUTHORIZATION_RECEIPT_INVALID");
  }
  const expiresAt = typeof payload.expiresAt === "string" ? Date.parse(payload.expiresAt) : Number.NaN;
  if (payload.version !== 1 || typeof payload.refreshToken !== "string" || !payload.refreshToken || typeof payload.subject !== "string" || !payload.subject || !Number.isFinite(expiresAt)) {
    throw new Error("APPLE_AUTHORIZATION_RECEIPT_INVALID");
  }
  if (expiresAt <= now.getTime()) throw new Error("APPLE_AUTHORIZATION_RECEIPT_EXPIRED");
  return { refreshToken: payload.refreshToken, subject: payload.subject };
}
