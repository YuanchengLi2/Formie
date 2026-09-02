import type { ExternalDeletionOperation, ExternalDeletionProvider } from "./external-deletion.ts";

export async function sendExternalDeletionTerminalAlert({
  jobId,
  provider,
  operation,
  attempts,
  errorCode,
  apiKey,
  from,
  to,
  fetcher = fetch,
}: {
  jobId: string;
  provider: ExternalDeletionProvider;
  operation: ExternalDeletionOperation;
  attempts: number;
  errorCode: string;
  apiKey: string;
  from: string;
  to: string;
  fetcher?: typeof fetch;
}): Promise<void> {
  const safeJobId = jobId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
  const safeErrorCode = errorCode.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const text = [
    "A Formie external deletion job requires operational review.",
    `Job: ${safeJobId}`,
    `Provider: ${provider}`,
    `Operation: ${operation}`,
    `Attempts: ${attempts}`,
    `Error code: ${safeErrorCode}`,
    "No provider token, customer identifier, video identifier, or deletion payload is included in this alert.",
  ].join("\n");
  const response = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `external-deletion-${safeJobId}-${attempts}`,
    },
    body: JSON.stringify({ from, to: [to], subject: "Formie external deletion requires attention", text }),
  });
  if (!response.ok) throw new Error("EXTERNAL_DELETION_ALERT_FAILED");
}
