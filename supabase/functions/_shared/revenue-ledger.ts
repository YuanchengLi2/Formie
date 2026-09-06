import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { WebhookEvent } from "../revenuecat-webhook/handler.ts";
import { fetchRevenueCatCustomerEvents, type RevenueCatCustomerEvent } from "./revenuecat.ts";

const purchaseTypes = new Set(["INITIAL_PURCHASE", "RENEWAL", "CANCELLATION", "REFUND_REVERSED", "SUBSCRIPTION_EXTENDED"]);

export function isRevenueCatFinancialEvent(event: Pick<WebhookEvent, "type" | "transaction_id" | "store" | "environment">): boolean {
  return purchaseTypes.has(event.type) && Boolean(event.transaction_id && event.store && event.environment);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function projectRevenueCatWebhook(
  admin: SupabaseClient,
  userId: string | null,
  event: WebhookEvent,
  fingerprintSalt: string,
): Promise<boolean> {
  const transactionId = event.transaction_id ?? null;
  const store = event.store?.toLowerCase() ?? null;
  const environment = event.environment ?? null;
  if (!purchaseTypes.has(event.type) || !transactionId || !store || !environment) return false;
  if (!fingerprintSalt) throw new Error("RECEIPT_FINGERPRINT_SALT is not configured");

  const stableReceiptReference = event.original_transaction_id ?? transactionId ?? event.app_user_id;
  const accountFingerprint = await sha256Hex(`${fingerprintSalt}:${store}:${stableReceiptReference}`);
  const eventAt = event.event_timestamp ?? new Date().toISOString();
  const refund = event.type === "CANCELLATION" && ["CUSTOMER_SUPPORT", "REFUND", "CHARGEBACK"].includes(event.cancel_reason ?? "");
  const refundReversed = event.type === "REFUND_REVERSED";
  const preservesOriginalAmounts = event.type === "CANCELLATION" || refundReversed;
  const { error } = await admin.rpc("project_revenuecat_transaction", {
    p_provider_event_id: event.id,
    p_user_id: userId,
    p_account_fingerprint: accountFingerprint,
    p_event_type: event.type,
    p_store: store,
    p_environment: environment,
    p_transaction_id: transactionId,
    p_original_transaction_id: event.original_transaction_id ?? transactionId,
    p_product_identifier: event.product_identifier ?? null,
    p_purchased_at: event.purchased_at ?? null,
    p_period_start: event.purchased_at ?? null,
    p_period_end: event.expiration_at ?? null,
    p_gross: preservesOriginalAmounts ? null : event.price_in_purchased_currency ?? null,
    p_currency: event.currency ?? null,
    p_country: event.country_code ?? null,
    p_tax_percentage: event.tax_percentage ?? null,
    p_commission_percentage: event.commission_percentage ?? null,
    p_refunded_at: refund ? eventAt : null,
    p_refund_reversed_at: refundReversed ? eventAt : null,
  });
  if (error) throw error;
  return true;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isoFromMillis(value: unknown): string | null {
  const milliseconds = numberValue(value);
  if (milliseconds === null) return null;
  const date = new Date(milliseconds);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function percentageValue(value: unknown): number | null {
  const number = numberValue(value);
  return number !== null && number >= 0 && number <= 1 ? number : null;
}

function normalizeHistoryType(event: RevenueCatCustomerEvent): string {
  const bodyType = stringValue(event.body.type);
  const raw = bodyType ?? event.type;
  return raw.replace(/^PURCHASES_/, "");
}

export function revenueCatHistoryEventToWebhook(event: RevenueCatCustomerEvent, appUserId: string): WebhookEvent {
  const raw = event.body;
  const environment = stringValue(raw.environment)?.toUpperCase();
  const aliases = Array.isArray(raw.aliases) ? raw.aliases.filter((item): item is string => typeof item === "string") : [];
  return {
    id: `history:${event.id}`,
    type: normalizeHistoryType(event),
    app_user_id: stringValue(raw.app_user_id) ?? appUserId,
    aliases,
    environment: environment === "PRODUCTION" || environment === "SANDBOX" ? environment : undefined,
    product_identifier: stringValue(raw.product_id),
    purchased_at: isoFromMillis(raw.purchased_at_ms),
    expiration_at: isoFromMillis(raw.expiration_at_ms),
    event_timestamp: isoFromMillis(raw.event_timestamp_ms) ?? event.occurredAt,
    entitlement_ids: Array.isArray(raw.entitlement_ids) ? raw.entitlement_ids.filter((item): item is string => typeof item === "string") : [],
    cancel_reason: stringValue(raw.cancel_reason),
    store: stringValue(raw.store),
    original_transaction_id: stringValue(raw.original_transaction_id),
    transaction_id: stringValue(raw.transaction_id) ?? stringValue(raw.store_transaction_id),
    price_in_purchased_currency: numberValue(raw.price_in_purchased_currency) ?? numberValue(raw.price),
    currency: stringValue(raw.currency),
    tax_percentage: percentageValue(raw.tax_percentage),
    commission_percentage: percentageValue(raw.commission_percentage),
    country_code: stringValue(raw.country_code),
    period_type: stringValue(raw.period_type),
    raw_event: raw,
    recognized: true,
  };
}

export async function reconcileRevenueCatTransactionHistory(
  admin: SupabaseClient,
  userId: string,
  appUserId: string,
  fingerprintSalt: string,
  options: { projectId?: string; secretApiKey?: string; fetcher?: typeof fetch } = {},
): Promise<number> {
  const history = await fetchRevenueCatCustomerEvents(
    appUserId,
    options.projectId,
    options.secretApiKey,
    options.fetcher,
  );
  const events = history
    .map((event) => revenueCatHistoryEventToWebhook(event, appUserId))
    .filter(isRevenueCatFinancialEvent)
    .sort((left, right) => {
      const leftAt = Date.parse(left.purchased_at ?? left.event_timestamp ?? "") || Number.MAX_SAFE_INTEGER;
      const rightAt = Date.parse(right.purchased_at ?? right.event_timestamp ?? "") || Number.MAX_SAFE_INTEGER;
      return leftAt - rightAt || left.id.localeCompare(right.id);
    });
  let projected = 0;
  for (const event of events) {
    if (await projectRevenueCatWebhook(admin, userId, event, fingerprintSalt)) projected += 1;
  }
  return projected;
}
