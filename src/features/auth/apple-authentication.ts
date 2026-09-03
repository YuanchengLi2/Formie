import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";

export type AppleSignInErrorCode =
  | "CANCELLED"
  | "MISSING_IDENTITY_TOKEN"
  | "MISSING_AUTHORIZATION_CODE"
  | "NONCE_MISMATCH"
  | "IDENTITY_TOKEN_FAILED"
  | "TOKEN_EXCHANGE_FAILED"
  | "TOKEN_CUSTODY_FAILED";

export class AppleSignInError extends Error {
  constructor(public readonly code: AppleSignInErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AppleSignInError";
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let encoded = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const block = (first << 16) | (second << 8) | third;
    encoded += alphabet[(block >> 18) & 63];
    encoded += alphabet[(block >> 12) & 63];
    encoded += index + 1 < bytes.length ? alphabet[(block >> 6) & 63] : "=";
    encoded += index + 2 < bytes.length ? alphabet[block & 63] : "=";
  }
  return encoded.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fullName(credential: AppleAuthentication.AppleAuthenticationCredential): string | null {
  const parts = [credential.fullName?.givenName, credential.fullName?.middleName, credential.fullName?.familyName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" ") : null;
}

export async function signInWithApple({
  signInWithIdToken,
  exchangeAuthorizationCode,
  storeAuthorization,
  saveFullName,
  signOut = async () => undefined,
  requestCredential = AppleAuthentication.signInAsync,
  getRandomBytes = Crypto.getRandomBytes,
  digestString = Crypto.digestStringAsync,
}: {
  signInWithIdToken: (identityToken: string, rawNonce: string) => Promise<unknown>;
  exchangeAuthorizationCode: (authorizationCode: string, nonce: string) => Promise<{
    identityToken: string;
    authorizationReceipt: string;
  }>;
  storeAuthorization: (authorization: { authorizationCode: string } | { authorizationReceipt: string }) => Promise<{ stored: true }>;
  saveFullName: (name: string) => Promise<void>;
  signOut?: () => Promise<void>;
  requestCredential?: typeof AppleAuthentication.signInAsync;
  getRandomBytes?: typeof Crypto.getRandomBytes;
  digestString?: typeof Crypto.digestStringAsync;
}): Promise<unknown> {
  const rawNonce = bytesToBase64Url(getRandomBytes(32));
  const nonce = await digestString(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await requestCredential({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (/cancel/i.test(code)) throw new AppleSignInError("CANCELLED", "Apple sign-in was cancelled.", { cause: error });
    throw error;
  }

  if (!credential.authorizationCode) {
    throw new AppleSignInError("MISSING_AUTHORIZATION_CODE", "Apple did not return an authorization code.");
  }

  let identityToken = credential.identityToken;
  let authorization: { authorizationCode: string } | { authorizationReceipt: string } = {
    authorizationCode: credential.authorizationCode,
  };
  if (!identityToken) {
    try {
      const exchanged = await exchangeAuthorizationCode(credential.authorizationCode, nonce);
      if (!exchanged.identityToken || !exchanged.authorizationReceipt) throw new Error("APPLE_TOKEN_EXCHANGE_INVALID");
      identityToken = exchanged.identityToken;
      authorization = { authorizationReceipt: exchanged.authorizationReceipt };
    } catch (error) {
      throw new AppleSignInError("TOKEN_EXCHANGE_FAILED", "Apple's authorization code could not be exchanged. Please try again.", { cause: error });
    }
  }

  let session: unknown;
  try {
    session = await signInWithIdToken(identityToken, rawNonce);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/nonce/i.test(message)) {
      throw new AppleSignInError("NONCE_MISMATCH", "Apple sign-in could not verify its security nonce. Please try again.", { cause: error });
    }
    throw new AppleSignInError("IDENTITY_TOKEN_FAILED", "Apple's identity token could not be verified. Please try again.", { cause: error });
  }
  try {
    await storeAuthorization(authorization);
  } catch (error) {
    await signOut().catch(() => undefined);
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "APPLE_TOKEN_EXCHANGE_FAILED") {
      throw new AppleSignInError("TOKEN_EXCHANGE_FAILED", "Apple's authorization code could not be exchanged. Please try again.", { cause: error });
    }
    throw new AppleSignInError("TOKEN_CUSTODY_FAILED", "Formie could not securely retain Apple revocation access. Please try again.", { cause: error });
  }

  const name = fullName(credential);
  if (name) await saveFullName(name);
  return session;
}
