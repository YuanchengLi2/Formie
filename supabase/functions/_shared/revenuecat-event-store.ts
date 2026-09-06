import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { WebhookEvent } from "../revenuecat-webhook/handler.ts";

export async function claimRevenueCatWebhookEvent(admin: SupabaseClient, event: WebhookEvent): Promise<"claimed" | "completed"> {
  const { data, error } = await admin.rpc("claim_revenuecat_webhook_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_app_user_id: event.app_user_id,
  });
  if (error) throw error;
  if (data === "completed") return "completed";
  const { error: persistError } = await admin.from("revenuecat_webhook_events").update({
    environment: event.environment ?? null,
    store: event.store?.toLowerCase() ?? null,
    product_identifier: event.product_identifier ?? null,
    transaction_id: event.transaction_id ?? null,
    original_transaction_id: event.original_transaction_id ?? null,
    user_id: null,
    purchased_at: event.purchased_at ?? null,
    expiration_at: event.expiration_at ?? null,
    price_in_purchased_currency: event.price_in_purchased_currency ?? null,
    currency: event.currency ?? null,
    tax_percentage: event.tax_percentage ?? null,
    commission_percentage: event.commission_percentage ?? null,
    country_code: event.country_code ?? null,
    event_timestamp: event.event_timestamp ?? null,
    cancel_reason: event.cancel_reason ?? null,
    raw_event: event.raw_event,
    financial_projection_status: "pending",
  }).eq("event_id", event.id);
  if (persistError) throw persistError;
  return "claimed";
}
