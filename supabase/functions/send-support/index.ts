import { createAdminClient } from "../_shared/auth.ts";
import { createSendSupportHandler } from "./handler.ts";

function authenticateInternalRequest(request: Request): boolean {
  const expected = Deno.env.get("FORMIE_SUPPORT_INTERNAL_TOKEN");
  const received = request.headers.get("Authorization");
  return Boolean(expected && received === `Bearer ${expected}`);
}

async function hashIdentifier(kind: "ip" | "email", value: string): Promise<string> {
  const salt = Deno.env.get("FORMIE_SUPPORT_RATE_LIMIT_SALT");
  if (!salt) throw new Error("Support rate-limit salt is missing");
  const bytes = new TextEncoder().encode(`${salt}:${kind}:${value.trim().toLowerCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function reserveRequest(input: {
  requestId: string;
  ipHash: string;
  emailHash: string;
  category: "account" | "billing" | "bug" | "feature" | "other";
}) {
  const { data, error } = await createAdminClient().rpc("reserve_support_request", {
    p_request_id: input.requestId,
    p_ip_hash: input.ipHash,
    p_email_hash: input.emailHash,
    p_category: input.category,
  });
  if (error) throw error;
  if (data === "allowed") return { allowed: true as const };
  if (data === "ip" || data === "email") return { allowed: false as const, limit: data };
  throw new Error("Invalid support reservation response");
}

async function updateRequestStatus(input: {
  requestId: string;
  status: "sent" | "failed";
  providerMessageId?: string;
}) {
  const { error } = await createAdminClient()
    .from("support_request_rate_limits")
    .update({
      delivery_status: input.status,
      provider_message_id: input.providerMessageId ?? null,
    })
    .eq("request_id", input.requestId);
  if (error) throw error;
}

async function sendEmail(input: {
  idempotencyKey: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("FORMIE_SUPPORT_FROM");
  const to = Deno.env.get("FORMIE_SUPPORT_TO");
  if (!apiKey || !from || !to) throw new Error("Support email configuration is missing");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: input.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });
  if (!response.ok) throw new Error(`Resend rejected support (${response.status})`);
  const payload = await response.json() as { id?: unknown };
  if (typeof payload.id !== "string") throw new Error("Resend returned an invalid response");
  return { id: payload.id };
}

Deno.serve((request) => createSendSupportHandler(request, {
  authenticateInternalRequest,
  createRequestId: () => crypto.randomUUID(),
  hashIdentifier,
  reserveRequest,
  updateRequestStatus,
  sendEmail,
}));
