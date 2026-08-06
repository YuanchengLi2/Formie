import type { RevenueCatSubscriber } from "../_shared/revenuecat.ts";

type WebhookEvent = {
  id: string;
  type: string;
  app_user_id: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
  environment?: "PRODUCTION" | "SANDBOX";
};

const lifecycleEventTypes = new Set(["INITIAL_PURCHASE", "RENEWAL", "CANCELLATION", "UNCANCELLATION", "BILLING_ISSUE", "PRODUCT_CHANGE", "TRANSFER", "EXPIRATION", "TEST"]);

export type RevenueCatWebhookDependencies = {
  claimEvent: (event: WebhookEvent) => Promise<"claimed" | "completed">;
  resolveUserId: (appUserId: string, aliases: string[]) => Promise<string | null>;
  loadSubscriber: (userId: string) => Promise<RevenueCatSubscriber>;
  saveSubscriber: (userId: string, subscriber: RevenueCatSubscriber) => Promise<void>;
  completeEvent: (eventId: string) => Promise<void>;
  failEvent: (eventId: string, reason: string) => Promise<void>;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

export async function revenueCatWebhookHandler(request: Request, dependencies: RevenueCatWebhookDependencies, secret: string): Promise<Response> {
  if (request.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(authorization, `Bearer ${secret}`)) return json({ code: "UNAUTHORIZED" }, 401);

  let event: WebhookEvent | null = null;
  try {
    const payload = await request.json() as { event?: Partial<WebhookEvent> };
    const candidate = payload.event;
    if (!candidate || typeof candidate.id !== "string" || !candidate.id.trim() || typeof candidate.type !== "string" || !lifecycleEventTypes.has(candidate.type) || typeof candidate.app_user_id !== "string" || !candidate.app_user_id.trim() || (candidate.environment !== undefined && candidate.environment !== "PRODUCTION" && candidate.environment !== "SANDBOX")) return json({ code: "INVALID_EVENT" }, 400);
    const aliases = [...new Set([
      ...stringArray(candidate.aliases),
      ...stringArray(candidate.transferred_from),
      ...stringArray(candidate.transferred_to),
    ])];
    event = { id: candidate.id, type: candidate.type, app_user_id: candidate.app_user_id, aliases, environment: candidate.environment };
    if (await dependencies.claimEvent(event) === "completed") return json({ received: true, duplicate: true }, 200);
    const userId = await dependencies.resolveUserId(event.app_user_id, event.aliases ?? []);
    if (!userId) {
      await dependencies.completeEvent(event.id);
      return json({ received: true, mapped: false }, 200);
    }
    const subscriber = await dependencies.loadSubscriber(userId);
    await dependencies.saveSubscriber(userId, subscriber);
    await dependencies.completeEvent(event.id);
    return json({ received: true, mapped: true }, 200);
  } catch (error) {
    if (event) await dependencies.failEvent(event.id, error instanceof Error ? error.message.slice(0, 240) : "Webhook processing failed").catch(() => undefined);
    return json({ code: "WEBHOOK_PROCESSING_FAILED" }, 502);
  }
}
