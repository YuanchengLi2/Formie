import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { fetchRevenueCatSubscriber } from "../_shared/revenuecat.ts";
import { persistEntitlementLedger } from "../_shared/entitlement-ledger.ts";
import { refreshEntitlementHandler } from "./handler.ts";

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  const admin = createAdminClient();
  const response = await refreshEntitlementHandler(request, {
    authenticate: (incoming) => requireUserId(incoming, admin),
    loadSubscriber: (appUserId) => fetchRevenueCatSubscriber(appUserId),
    saveAccess: ({ userId, subscriber, activeEntitlementId }) => persistEntitlementLedger(admin, userId, subscriber, activeEntitlementId),
    loadAccess: async (userId) => {
      const { data, error } = await admin.rpc("get_access_status_for_user", { p_user_id: userId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("Access status is unavailable");
      return row;
    },
  }, Deno.env.get("REVENUECAT_ENTITLEMENT_ID") ?? "formie_pro");
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
});
