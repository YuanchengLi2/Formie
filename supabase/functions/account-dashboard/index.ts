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
      const [profileResult, accessResult] = await Promise.all([caller.from("user_profiles").select("display_name").eq("user_id", userId).maybeSingle(), caller.rpc("get_my_access_status_v2")]);
      if (profileResult.error || accessResult.error) throw profileResult.error ?? accessResult.error;
      const envelope = accessResult.data && typeof accessResult.data === "object" ? accessResult.data as Record<string, any> : null;
      const access = envelope?.access;
      if (!access) throw new Error("Access status is unavailable");
      const bonus = envelope?.referralBonus ?? { state: "none", baseLimit: 10, baseUsed: 0, bonusGranted: 0, bonusUsed: 0, bonusReserved: 0, bonusRemaining: 0, bonusExpiresAt: null };
      return { displayName: profileResult.data?.display_name ?? "Formie Athlete", profileExists: Boolean(profileResult.data), access, referralBonus: bonus };
    },
  });
  const secured = withCors(request, response);
  secured.headers.set("Cache-Control", "no-store");
  return secured;
});
