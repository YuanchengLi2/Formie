import { createAdminClient } from "../_shared/auth.ts";
import { fetchRevenueCatSubscriber } from "../_shared/revenuecat.ts";
import { applyRevenueCatLifecycleEvent, persistEntitlementLedger } from "../_shared/entitlement-ledger.ts";
import { revenueCatWebhookHandler } from "./handler.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  const admin = createAdminClient();
  return revenueCatWebhookHandler(request, {
    claimEvent: async (event) => {
      const { data, error } = await admin.rpc("claim_revenuecat_webhook_event", {
        p_event_id: event.id,
        p_event_type: event.type,
        p_app_user_id: event.app_user_id,
      });
      if (error) throw error;
      return data === "completed" ? "completed" : "claimed";
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
    applyEvent: (userId, event) => applyRevenueCatLifecycleEvent(admin, userId, event),
    loadSubscriber: (userId) => fetchRevenueCatSubscriber(userId),
    saveSubscriber: async (userId, subscriber) => {
      await persistEntitlementLedger(admin, userId, subscriber, Deno.env.get("REVENUECAT_ENTITLEMENT_ID") ?? "formie_pro");
    },
    completeEvent: async (eventId) => {
      const { error } = await admin.from("revenuecat_webhook_events").update({ status: "completed", completed_at: new Date().toISOString(), last_error: null }).eq("event_id", eventId);
      if (error) throw error;
    },
    failEvent: async (eventId, reason) => {
      const { error } = await admin.from("revenuecat_webhook_events").update({ status: "failed", last_error: reason }).eq("event_id", eventId);
      if (error) throw error;
    },
  }, Deno.env.get("REVENUECAT_WEBHOOK_AUTH_TOKEN") ?? "");
});
