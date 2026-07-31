import { createAdminClient } from "../_shared/auth.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { createSendFeedbackHandler } from "./handler.ts";

async function authenticate(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
  const token = authorization.slice("Bearer ".length);
  const { data, error } = await createAdminClient().auth.getUser(token);
  if (error || !data.user?.email) throw new Error("UNAUTHORIZED");
  return { id: data.user.id, email: data.user.email };
}

async function sendEmail(input: {
  idempotencyKey: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("FORMIE_FEEDBACK_FROM");
  const to = Deno.env.get("FORMIE_FEEDBACK_TO");
  if (!apiKey || !from || !to) throw new Error("Feedback email configuration is missing");
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
  if (!response.ok) throw new Error(`Resend rejected feedback (${response.status})`);
  const payload = await response.json() as { id?: unknown };
  if (typeof payload.id !== "string") throw new Error("Resend returned an invalid response");
  return { id: payload.id };
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  const response = await createSendFeedbackHandler(request, { authenticate, sendEmail });
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
});
