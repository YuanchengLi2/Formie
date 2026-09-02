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

it("does not hide permanent configuration or authentication failures in the retry queue", async () => {
  const enqueue = jest.fn();
  await expect(attemptExternalDeletion(request, { execute: jest.fn(async () => { throw new ExternalDeletionError("HTTP_401", false); }), enqueue, encryptionKey: key })).rejects.toMatchObject({ code: "HTTP_401" });
  expect(enqueue).not.toHaveBeenCalled();
});
