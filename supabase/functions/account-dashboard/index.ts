import { createAdminClient, requireUser } from "../_shared/auth.ts";
import { secureBrowserRequest, withCors } from "../_shared/cors.ts";
import { persistEntitlementLedger } from "../_shared/entitlement-ledger.ts";
import { fetchRevenueCatSubscriber } from "../_shared/revenuecat.ts";
import { accountDashboardHandler } from "./handler.ts";

Deno.serve(async (request) => {
  const security = await secureBrowserRequest(request, { methods: ["GET", "POST"], authentication: "user", maxBodyBytes: 4_096 }); if (security) return security;
  const admin = createAdminClient();
  let caller: any = null;
  const response = await accountDashboardHandler(request, {
    authenticate: async (incoming) => { const user = await requireUser(incoming, admin); caller = user.client; return { id: user.id, email: user.email }; },
    loadSubscriber: fetchRevenueCatSubscriber,
    persistLedger: (userId, subscriber) => persistEntitlementLedger(admin, userId, subscriber),
    loadDashboardData: async (userId) => {
      const [profileResult, accessResult] = await Promise.all([caller.from("user_profiles").select("display_name").eq("user_id", userId).maybeSingle(), caller.rpc("get_my_access_status")]);
      if (profileResult.error || accessResult.error) throw profileResult.error ?? accessResult.error;
      const access = Array.isArray(accessResult.data) ? accessResult.data[0] : accessResult.data;
      if (!access) throw new Error("Access status is unavailable");
      return { displayName: profileResult.data?.display_name ?? "Formie Athlete", profileExists: Boolean(profileResult.data), access };
    },
  });
  const secured = withCors(request, response);
  secured.headers.set("Cache-Control", "no-store");
  return secured;
});
