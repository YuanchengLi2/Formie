import { ExternalDeletionError } from "../_shared/external-deletion";
import { processExternalDeletionsHandler, type ProcessExternalDeletionDependencies } from "./handler";

const job = { id: "job-1", provider: "gemini" as const, operation: "delete_file" as const, encryptedPayload: "v1.iv.ciphertext", attempts: 0, expiresAt: "2026-09-30T00:00:00.000Z" };
const dependencies = (overrides: Partial<ProcessExternalDeletionDependencies> = {}): ProcessExternalDeletionDependencies => ({ authenticate: jest.fn(async () => undefined), claimDue: jest.fn(async () => [job]), execute: jest.fn(async () => undefined), complete: jest.fn(async () => undefined), retry: jest.fn(async () => undefined), terminal: jest.fn(async () => undefined), now: () => new Date("2026-09-01T00:00:00.000Z"), ...overrides });

it("removes completed cleanup jobs immediately", async () => {
  const deps = dependencies();
  const response = await processExternalDeletionsHandler(new Request("https://example.test", { method: "POST" }), deps);
  await expect(response.json()).resolves.toEqual({ processed: 1, completed: 1, retried: 0, terminal: 0 });
  expect(deps.complete).toHaveBeenCalledWith("job-1");
});

it("reschedules transient failures exponentially without returning provider payloads", async () => {
  const deps = dependencies({ execute: jest.fn(async () => { throw new ExternalDeletionError("HTTP_503", true); }) });
  const response = await processExternalDeletionsHandler(new Request("https://example.test", { method: "POST" }), deps);
  expect(await response.json()).toEqual({ processed: 1, completed: 0, retried: 1, terminal: 0 });
  expect(deps.retry).toHaveBeenCalledWith("job-1", { attempts: 1, errorCode: "HTTP_503", nextRetryAt: "2026-09-01T00:01:00.000Z" });
});

it("marks exhausted cleanup for operational alerting", async () => {
  const deps = dependencies({ claimDue: jest.fn(async () => [{ ...job, attempts: 11 }]), execute: jest.fn(async () => { throw new Error("failed"); }) });
  await processExternalDeletionsHandler(new Request("https://example.test", { method: "POST" }), deps);
  expect(deps.terminal).toHaveBeenCalledWith({ ...job, attempts: 11 }, { attempts: 12, errorCode: "PROVIDER_DELETE_FAILED" });
});
