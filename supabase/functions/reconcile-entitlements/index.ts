import { createAdminClient } from "../_shared/auth.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { fetchRevenueCatSubscriber } from "../_shared/revenuecat.ts";
import { persistEntitlementLedger } from "../_shared/entitlement-ledger.ts";
import { reconcileEntitlementsHandler } from "./handler.ts";

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  const admin = createAdminClient();
  const response = await reconcileEntitlementsHandler(request, {
    authenticateCron: (incoming) => incoming.headers.get("x-cron-secret") === Deno.env.get("RECONCILE_ENTITLEMENTS_SECRET"),
    listUsers: async ({ offset, limit }) => {
      const { data, error } = await admin
        .from("user_access_entitlements")
        .select("user_id")
        .order("user_id", { ascending: true })
        .range(offset, offset + limit);
      if (error) throw error;
      const rows = data ?? [];
      const hasMore = rows.length > limit;
      const users = rows.slice(0, limit).map((row) => String(row.user_id));
      return { users, hasMore, nextOffset: hasMore ? offset + users.length : null };
    },
    loadSubscriber: (appUserId) => fetchRevenueCatSubscriber(appUserId),
    saveSubscriber: (userId, subscriber) => persistEntitlementLedger(admin, userId, subscriber, Deno.env.get("REVENUECAT_ENTITLEMENT_ID") ?? "formie_pro"),
    releaseStaleReservations: async () => {
      const { data, error } = await admin.rpc("release_stale_analysis_credit_reservations");
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
});
