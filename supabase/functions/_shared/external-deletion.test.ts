import { decryptSecretEnvelope } from "./secret-envelope";
import { attemptExternalDeletion, ExternalDeletionError, prepareExternalDeletionJob } from "./external-deletion";

const key = new Uint8Array(32).fill(7);
const request = { provider: "gemini" as const, operation: "delete_file" as const, payload: { fileName: "files/private-video" } };

it("creates an encrypted nonreversible retry job without exposing provider identifiers", async () => {
  const job = await prepareExternalDeletionJob(request, key);
  expect(job.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(job.encryptedPayload).not.toContain("private-video");
  await expect(decryptSecretEnvelope(job.encryptedPayload, key)).resolves.toBe(JSON.stringify(request.payload));
});

it("queues only transient provider failures and treats successful/idempotent cleanup as complete", async () => {
  const enqueue = jest.fn();
  await expect(attemptExternalDeletion(request, { execute: jest.fn(async () => undefined), enqueue, encryptionKey: key })).resolves.toBe("complete");
  expect(enqueue).not.toHaveBeenCalled();
  await expect(attemptExternalDeletion(request, { execute: jest.fn(async () => { throw new ExternalDeletionError("HTTP_503", true); }), enqueue, encryptionKey: key })).resolves.toBe("queued");
  expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ provider: "gemini", operation: "delete_file" }));
});

it("durably queues provider authentication failures so local account deletion can continue", async () => {
  const enqueue = jest.fn();
  await expect(attemptExternalDeletion(request, { execute: jest.fn(async () => { throw new ExternalDeletionError("HTTP_401", false); }), enqueue, encryptionKey: key })).resolves.toBe("queued");
  expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ provider: "gemini", operation: "delete_file" }));
});

it.each(["INVALID_DELETION_PAYLOAD", "UNSUPPORTED_DELETION_OPERATION"])("rejects local programming error %s instead of retrying it", async (code) => {
  const enqueue = jest.fn();
  await expect(attemptExternalDeletion(request, { execute: jest.fn(async () => { throw new ExternalDeletionError(code, false); }), enqueue, encryptionKey: key })).rejects.toMatchObject({ code });
  expect(enqueue).not.toHaveBeenCalled();
});
