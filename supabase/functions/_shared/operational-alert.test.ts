import { sendExternalDeletionTerminalAlert } from "./operational-alert";

it("sends an idempotent privacy-safe terminal deletion alert", async () => {
  const fetcher = jest.fn(async () => new Response(null, { status: 202 })) as typeof fetch;
  await sendExternalDeletionTerminalAlert({
    jobId: "job-123",
    provider: "gemini",
    operation: "delete_file",
    attempts: 12,
    errorCode: "HTTP_503 details/that must be sanitized",
    apiKey: "resend-secret",
    from: "Formie Operations <support@useformie.com>",
    to: "support@useformie.com",
    fetcher,
  });
  const init = fetcher.mock.calls[0][1] as RequestInit;
  expect(init.headers).toEqual(expect.objectContaining({ "Idempotency-Key": "external-deletion-job-123-12" }));
  expect(String(init.body)).toContain("HTTP_503_details_that_must_be_sanitized");
  expect(String(init.body)).not.toContain("resend-secret");
  expect(String(init.body)).not.toContain("v1.iv.ciphertext");
});

it("fails closed when the alert provider rejects delivery", async () => {
  await expect(sendExternalDeletionTerminalAlert({
    jobId: "job-123",
    provider: "apple",
    operation: "revoke_authorization",
    attempts: 12,
    errorCode: "HTTP_500",
    apiKey: "secret",
    from: "support@useformie.com",
    to: "support@useformie.com",
    fetcher: jest.fn(async () => new Response(null, { status: 500 })) as typeof fetch,
  })).rejects.toThrow("EXTERNAL_DELETION_ALERT_FAILED");
});
