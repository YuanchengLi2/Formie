import { createAdminClient } from "../_shared/auth.ts";
import { fetchRevenueCatSubscriber } from "../_shared/revenuecat.ts";
import { applyRevenueCatLifecycleEvent, expireTransferredEntitlement, persistEntitlementLedger } from "../_shared/entitlement-ledger.ts";
import { revenueCatWebhookHandler } from "./handler.ts";
import { validateRequestSecurity, withRequestIdentifier } from "../_shared/request-security.ts";
import { isRevenueCatFinancialEvent, projectRevenueCatWebhook, reconcileRevenueCatTransactionHistory } from "../_shared/revenue-ledger.ts";
import { claimRevenueCatWebhookEvent } from "../_shared/revenuecat-event-store.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  const security = await validateRequestSecurity(request, { methods: ["POST"], authentication: "webhook", maxBodyBytes: 262_144, allowBrowserOrigin: false });
  if (security) return security;
  const admin = createAdminClient();
  const response = await revenueCatWebhookHandler(request, {
    claimEvent: async (event) => {
      return claimRevenueCatWebhookEvent(admin, event);
    },
    resolveUserId: async (appUserId, aliases) => {
      const candidates = [appUserId, ...aliases];
      for (const candidate of candidates) {
        if (!uuidPattern.test(candidate)) continue;
        const { data } = await admin.auth.admin.getUserById(candidate);
        if (data.user) return data.user.id;
      }
      const { data, error } = await admin.from("user_access_entitlements")
        .select("user_id")
        .in("revenuecat_app_user_id", candidates)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.user_id ? String(data.user_id) : null;
    },
    expireTransferredUser: (userId, event) => expireTransferredEntitlement(admin, userId, event),
    applyEvent: (userId, event) => applyRevenueCatLifecycleEvent(admin, userId, event),
    loadSubscriber: (userId) => fetchRevenueCatSubscriber(userId),
    saveSubscriber: async (userId, subscriber, event) => {
      await persistEntitlementLedger(admin, userId, subscriber, Deno.env.get("REVENUECAT_ENTITLEMENT_ID") ?? "formie_pro", new Date(), {
        authoritativeEvent: {
          id: event.id,
          eventAt: event.event_timestamp ?? null,
          originalTransactionId: event.original_transaction_id ?? null,
          transactionId: event.transaction_id ?? null,
          store: event.store?.toLowerCase() ?? null,
          purchasedAt: event.purchased_at ?? null,
          expiresAt: event.expiration_at ?? null,
        },
      });
    },
    projectEvent: async (userId, event) => {
      const fingerprintSalt = Deno.env.get("RECEIPT_FINGERPRINT_SALT") ?? "";
      if (userId && isRevenueCatFinancialEvent(event)) {
        await reconcileRevenueCatTransactionHistory(admin, userId, event.app_user_id, fingerprintSalt);
      }
      const projected = await projectRevenueCatWebhook(admin, userId, event, fingerprintSalt);
      const { error } = await admin.from("revenuecat_webhook_events").update({
        user_id: userId,
        financial_projection_status: projected ? "completed" : "not_applicable",
        financial_projected_at: projected ? new Date().toISOString() : null,
      }).eq("event_id", event.id);
      if (error) throw error;
    },
    completeEvent: async (eventId) => {
      const { error } = await admin.from("revenuecat_webhook_events").update({ status: "completed", completed_at: new Date().toISOString(), last_error: null }).eq("event_id", eventId);
      if (error) throw error;
    },
    deferEvent: async (eventId, reason) => {
      const { error } = await admin.from("revenuecat_webhook_events").update({ status: "failed", completed_at: null, last_error: reason }).eq("event_id", eventId);
      if (error) throw error;
    },
    failEvent: async (eventId, reason) => {
      const { error } = await admin.from("revenuecat_webhook_events").update({ status: "failed", last_error: reason }).eq("event_id", eventId);
      if (error) throw error;
    },
  }, Deno.env.get("REVENUECAT_WEBHOOK_AUTH_TOKEN") ?? "");
  return withRequestIdentifier(request, response);
});
