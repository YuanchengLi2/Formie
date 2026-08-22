import { createAdminClient } from "../_shared/auth.ts";
import { constantTimeEqual, validateRequestSecurity, withRequestIdentifier } from "../_shared/request-security.ts";
import { fetchRevenueCatSubscriber } from "../_shared/revenuecat.ts";
import { persistEntitlementLedger } from "../_shared/entitlement-ledger.ts";
import { reconcileEntitlementsHandler } from "./handler.ts";

Deno.serve(async (request) => {
  const security = await validateRequestSecurity(request, { methods: ["POST"], authentication: "webhook", maxBodyBytes: 4_096, allowBrowserOrigin: false });
  if (security) return security;
  const admin = createAdminClient();
  const response = await reconcileEntitlementsHandler(request, {
    authenticateCron: (incoming) => {
      const supplied = incoming.headers.get("x-cron-secret");
      const configured = Deno.env.get("RECONCILE_ENTITLEMENTS_SECRET");
      return Boolean(supplied && configured && constantTimeEqual(supplied, configured));
    },
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
  return withRequestIdentifier(request, response);
});
