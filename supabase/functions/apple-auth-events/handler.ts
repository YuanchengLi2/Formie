import type { AppleServerEvent } from "../_shared/apple-events.ts";

export type AppleAuthEventDependencies = {
  verify: (signedPayload: string) => Promise<AppleServerEvent>;
  markRevoked: (appleSubject: string, eventType: string) => Promise<void>;
};

function json(payload: unknown, status: number): Response { return Response.json(payload, { status }); }

export async function appleAuthEventsHandler(request: Request, dependencies: AppleAuthEventDependencies): Promise<Response> {
  if (request.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  let signedPayload = "";
  try { const body = await request.json() as Record<string, unknown>; signedPayload = typeof body.signedPayload === "string" ? body.signedPayload : ""; } catch { /* invalid below */ }
  if (!signedPayload || signedPayload.length > 16_384) return json({ code: "INVALID_BODY" }, 400);
  try {
    const event = await dependencies.verify(signedPayload);
    if (event.eventType === "consent-revoked" || event.eventType === "account-delete") await dependencies.markRevoked(event.subject, event.eventType);
    return json({ received: true }, 200);
  } catch { return json({ code: "INVALID_APPLE_EVENT" }, 400); }
}
