import type { RevenueCatSubscriber } from "../_shared/revenuecat.ts";
import { constantTimeEqual } from "../_shared/request-security.ts";

export type WebhookEvent = {
  id: string;
  type: string;
  app_user_id: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
  environment?: "PRODUCTION" | "SANDBOX";
  product_identifier?: string | null;
  purchased_at?: string | null;
  expiration_at?: string | null;
  event_timestamp?: string | null;
  entitlement_ids?: string[];
  cancel_reason?: string | null;
  store?: string | null;
  original_transaction_id?: string | null;
  transaction_id?: string | null;
};

const lifecycleEventTypes = new Set(["INITIAL_PURCHASE", "RENEWAL", "CANCELLATION", "UNCANCELLATION", "BILLING_ISSUE", "PRODUCT_CHANGE", "TRANSFER", "EXPIRATION", "TEST"]);

export type RevenueCatWebhookDependencies = {
  claimEvent: (event: WebhookEvent) => Promise<"claimed" | "completed">;
  resolveUserId: (appUserId: string, aliases: string[]) => Promise<string | null>;
  expireTransferredUser: (userId: string, event: WebhookEvent) => Promise<{ originalTransactionId: string | null; transactionId: string | null; store: string | null } | null>;
  applyEvent: (userId: string, event: WebhookEvent) => Promise<void>;
  loadSubscriber: (userId: string) => Promise<RevenueCatSubscriber>;
  saveSubscriber: (userId: string, subscriber: RevenueCatSubscriber, event: WebhookEvent) => Promise<void>;
  completeEvent: (eventId: string) => Promise<void>;
  failEvent: (eventId: string, reason: string) => Promise<void>;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export async function revenueCatWebhookHandler(request: Request, dependencies: RevenueCatWebhookDependencies, secret: string): Promise<Response> {
  if (request.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret || !constantTimeEqual(authorization, `Bearer ${secret}`)) return json({ code: "UNAUTHORIZED" }, 401);

  let event: WebhookEvent | null = null;
  try {
    const payload = await request.json() as { event?: Partial<WebhookEvent> };
    const candidate = payload.event;
    if (!candidate || typeof candidate.id !== "string" || !candidate.id.trim() || typeof candidate.type !== "string" || !lifecycleEventTypes.has(candidate.type) || (candidate.environment !== undefined && candidate.environment !== "PRODUCTION" && candidate.environment !== "SANDBOX")) return json({ code: "INVALID_EVENT" }, 400);
    const aliases = [...new Set(stringArray(candidate.aliases))];
    const transferredFrom = [...new Set(stringArray(candidate.transferred_from))];
    const transferredTo = [...new Set(stringArray(candidate.transferred_to))];
    const rawAppUserId = typeof candidate.app_user_id === "string" ? candidate.app_user_id.trim() : "";
    const destinationAppUserId = candidate.type === "TRANSFER" ? transferredTo[0] ?? rawAppUserId : rawAppUserId;
    if (!destinationAppUserId) return json({ code: "INVALID_EVENT" }, 400);
    const raw = candidate as Partial<WebhookEvent> & { product_id?: unknown; purchased_at_ms?: unknown; expiration_at_ms?: unknown; event_timestamp_ms?: unknown; entitlement_ids?: unknown; cancel_reason?: unknown; store?: unknown; original_transaction_id?: unknown; transaction_id?: unknown };
    event = {
      id: candidate.id,
      type: candidate.type,
      app_user_id: destinationAppUserId,
      aliases,
      transferred_from: transferredFrom,
      transferred_to: transferredTo,
      environment: candidate.environment,
      product_identifier: typeof raw.product_id === "string" ? raw.product_id : null,
      purchased_at: timestamp(raw.purchased_at_ms),
      expiration_at: timestamp(raw.expiration_at_ms),
      event_timestamp: timestamp(raw.event_timestamp_ms),
      entitlement_ids: stringArray(raw.entitlement_ids),
      cancel_reason: typeof raw.cancel_reason === "string" ? raw.cancel_reason : null,
      store: text(raw.store),
      original_transaction_id: text(raw.original_transaction_id),
      transaction_id: text(raw.transaction_id),
    };
    if (await dependencies.claimEvent(event) === "completed") return json({ received: true, duplicate: true }, 200);
    const userId = await dependencies.resolveUserId(event.app_user_id, event.aliases ?? []);
    if (!userId) {
      await dependencies.completeEvent(event.id);
      return json({ received: true, mapped: false }, 200);
    }
    if (event.type === "TRANSFER") {
      for (const sourceAppUserId of event.transferred_from ?? []) {
        const sourceUserId = await dependencies.resolveUserId(sourceAppUserId, []);
        if (sourceUserId && sourceUserId !== userId) {
          const transferredReceipt = await dependencies.expireTransferredUser(sourceUserId, event);
          if (transferredReceipt) {
            event.original_transaction_id ??= transferredReceipt.originalTransactionId;
            event.transaction_id ??= transferredReceipt.transactionId;
            event.store ??= transferredReceipt.store;
          }
        }
      }
    }
    await dependencies.applyEvent(userId, event);
    const subscriber = await dependencies.loadSubscriber(userId);
    await dependencies.saveSubscriber(userId, subscriber, event);
    await dependencies.completeEvent(event.id);
    return json({ received: true, mapped: true }, 200);
  } catch (error) {
    if (event) await dependencies.failEvent(event.id, error instanceof Error ? error.message.slice(0, 240) : "Webhook processing failed").catch(() => undefined);
    return json({ code: "WEBHOOK_PROCESSING_FAILED" }, 502);
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
