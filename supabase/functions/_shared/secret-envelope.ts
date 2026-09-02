const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importKey(key: Uint8Array): Promise<CryptoKey> {
  if (key.byteLength !== 32) throw new Error("SECRET_ENVELOPE_KEY_INVALID");
  return crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export function secretEnvelopeKeyFromBase64Url(value: string): Uint8Array {
  return decodeBase64Url(value);
}

export async function encryptSecretEnvelope(plaintext: string, key: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await importKey(key), encoder.encode(plaintext)));
  return `v1.${encodeBase64Url(iv)}.${encodeBase64Url(ciphertext)}`;
}

export async function decryptSecretEnvelope(envelope: string, key: Uint8Array): Promise<string> {
  const [version, encodedIv, encodedCiphertext, extra] = envelope.split(".");
  if (version !== "v1" || !encodedIv || !encodedCiphertext || extra) throw new Error("SECRET_ENVELOPE_INVALID");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64Url(encodedIv) },
    await importKey(key),
    decodeBase64Url(encodedCiphertext),
  );
  return decoder.decode(plaintext);
}
