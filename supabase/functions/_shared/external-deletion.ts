import { encryptSecretEnvelope } from "./secret-envelope.ts";

export type ExternalDeletionProvider = "apple" | "gemini" | "revenuecat";
export type ExternalDeletionOperation = "revoke_authorization" | "delete_file" | "delete_customer";
export type ExternalDeletionRequest = { provider: ExternalDeletionProvider; operation: ExternalDeletionOperation; payload: Record<string, string> };
export type ExternalDeletionJob = Omit<ExternalDeletionRequest, "payload"> & { encryptedPayload: string; fingerprint: string };

export class ExternalDeletionError extends Error {
  constructor(readonly code: string, readonly transient: boolean) {
    super(code);
    this.name = "ExternalDeletionError";
  }
}

function encodeHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function prepareExternalDeletionJob(request: ExternalDeletionRequest, encryptionKey: Uint8Array): Promise<ExternalDeletionJob> {
  const serialized = JSON.stringify(request.payload);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${request.provider}\0${request.operation}\0${serialized}`)));
  return { provider: request.provider, operation: request.operation, encryptedPayload: await encryptSecretEnvelope(serialized, encryptionKey), fingerprint: encodeHex(digest) };
}

export async function attemptExternalDeletion(request: ExternalDeletionRequest, dependencies: { execute: (request: ExternalDeletionRequest) => Promise<void>; enqueue: (job: ExternalDeletionJob) => Promise<void>; encryptionKey: Uint8Array }): Promise<"complete" | "queued"> {
  try {
    await dependencies.execute(request);
    return "complete";
  } catch (error) {
    if (!(error instanceof ExternalDeletionError)) throw error;
    if (error.code === "INVALID_DELETION_PAYLOAD" || error.code === "UNSUPPORTED_DELETION_OPERATION") throw error;
    await dependencies.enqueue(await prepareExternalDeletionJob(request, dependencies.encryptionKey));
    return "queued";
  }
}
