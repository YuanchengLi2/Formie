import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { secureBrowserRequest, withCors } from "../_shared/cors.ts";
import { subscriptionTestControlsHandler, type SubscriptionTestCommand } from "./handler.ts";

const MONTHLY_TEST_PERIOD_MS = 20 * 60 * 1000;
const ANNUAL_TEST_PERIOD_MS = 60 * 60 * 1000;

Deno.serve(async (request) => {
  const security = await secureBrowserRequest(request, { methods: ["POST"], authentication: "user", maxBodyBytes: 4_096 }); if (security) return security;
  const admin = createAdminClient();
  const response = await subscriptionTestControlsHandler(request, {
    enabled: () => Deno.env.get("SUBSCRIPTION_TEST_CONTROLS_ENABLED") === "true",
    authenticate: (incoming) => requireUserId(incoming, admin),
    loadCurrent: async (userId) => {
      const { data, error } = await admin.from("user_access_entitlements").select("sandbox,store").eq("user_id", userId).single();
      if (error || !data) throw error ?? new Error("SUBSCRIPTION_NOT_FOUND");
      return { sandbox: data.sandbox === true, store: typeof data.store === "string" ? data.store : null };
    },
    apply: async (userId, command: SubscriptionTestCommand) => {
      const [{ data: entitlement, error: entitlementError }, { data: scenario, error: scenarioError }] = await Promise.all([
        admin.from("user_access_entitlements").select("lifecycle_state,plan_code,store_product_id,store,sandbox,will_renew,billing_period_start,billing_period_end,current_period_start,current_period_end").eq("user_id", userId).single(),
        admin.from("subscription_test_scenarios").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      if (entitlementError || scenarioError || !entitlement) throw entitlementError ?? scenarioError ?? new Error("SUBSCRIPTION_NOT_FOUND");

      if (command.action === "clear") {
        const { error } = await admin.from("subscription_test_scenarios").delete().eq("user_id", userId);
        if (error) throw error;
      } else {
        const now = new Date();
        const planCode = (scenario?.plan_code ?? entitlement.plan_code) === "annual" ? "annual" : "monthly";
        const durationMs = planCode === "annual" ? ANNUAL_TEST_PERIOD_MS : MONTHLY_TEST_PERIOD_MS;
        const currentStart = scenario?.billing_period_start ?? entitlement.billing_period_start ?? entitlement.current_period_start ?? now.toISOString();
        const currentEnd = scenario?.billing_period_end ?? entitlement.billing_period_end ?? entitlement.current_period_end ?? new Date(now.getTime() + durationMs).toISOString();
        let lifecycleState = scenario?.lifecycle_state ?? entitlement.lifecycle_state ?? "active_renewing";
        let willRenew = scenario?.will_renew ?? entitlement.will_renew ?? true;
        let billingStart = currentStart;
        let billingEnd = currentEnd;
        let quotaOffsetSteps = Number(scenario?.quota_offset_steps ?? 0);
        let remainingOverride = scenario?.quota_remaining_override ?? null;
        let actualUsedAtOverride = scenario?.quota_actual_used_at_override ?? null;
        let overridePeriodStart = scenario?.quota_override_period_start ?? null;
        let overridePeriodEnd = scenario?.quota_override_period_end ?? null;

        if (command.action === "cancel_at_period_end") { lifecycleState = "active_cancelled"; willRenew = false; }
        if (command.action === "uncancel") { lifecycleState = "active_renewing"; willRenew = true; }
        if (command.action === "renew_now" || command.action === "start_new_period") {
          lifecycleState = "active_renewing";
          willRenew = true;
          billingStart = now.toISOString();
          billingEnd = new Date(now.getTime() + durationMs).toISOString();
          quotaOffsetSteps = 0;
          remainingOverride = null;
          actualUsedAtOverride = null;
          overridePeriodStart = null;
          overridePeriodEnd = null;
        }
        if (command.action === "expire_now") {
          lifecycleState = "expired";
          willRenew = false;
          billingStart = new Date(now.getTime() - 120000).toISOString();
          billingEnd = new Date(now.getTime() - 1000).toISOString();
          remainingOverride = null;
          actualUsedAtOverride = null;
          overridePeriodStart = null;
          overridePeriodEnd = null;
        }
        if (command.action === "advance_annual_quota_month") {
          if (planCode !== "annual") throw new Error("ANNUAL_PLAN_REQUIRED");
          quotaOffsetSteps += 1;
          remainingOverride = null;
          actualUsedAtOverride = null;
          overridePeriodStart = null;
          overridePeriodEnd = null;
        }
        if (command.action === "set_remaining") {
          if (command.remaining < 0 || command.remaining > 10) throw new Error("REMAINING_INVALID");
          const { data: accessData, error: accessError } = await admin.rpc("get_access_status_for_user", { p_user_id: userId });
          if (accessError) throw accessError;
          const access = Array.isArray(accessData) ? accessData[0] : accessData;
          if (!access || typeof access.quota_period_start !== "string" || typeof access.quota_period_end !== "string") throw new Error("ACTIVE_QUOTA_REQUIRED");
          const { data: reservations, error: reservationError } = await admin.from("analysis_credit_reservations").select("status,expires_at").eq("user_id", userId).eq("period_start", access.quota_period_start).eq("period_end", access.quota_period_end);
          if (reservationError) throw reservationError;
          const nowMs = now.getTime();
          const actualUsed = (reservations ?? []).filter((reservation) => reservation.status === "committed" || (reservation.status === "reserved" && typeof reservation.expires_at === "string" && Date.parse(reservation.expires_at) > nowMs)).length;
          remainingOverride = command.remaining;
          actualUsedAtOverride = actualUsed;
          overridePeriodStart = access.quota_period_start;
          overridePeriodEnd = access.quota_period_end;
        }

        const { error } = await admin.from("subscription_test_scenarios").upsert({
          user_id: userId,
          lifecycle_state: lifecycleState,
          plan_code: planCode,
          product_identifier: entitlement.store_product_id,
          store: "test_store",
          sandbox: true,
          will_renew: willRenew,
          billing_period_start: billingStart,
          billing_period_end: billingEnd,
          quota_offset_steps: quotaOffsetSteps,
          quota_remaining_override: remainingOverride,
          quota_actual_used_at_override: actualUsedAtOverride,
          quota_override_period_start: overridePeriodStart,
          quota_override_period_end: overridePeriodEnd,
          updated_at: now.toISOString(),
          expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: "user_id" });
        if (error) throw error;
      }
      const { data, error } = await admin.rpc("get_access_status_for_user", { p_user_id: userId });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
  });
  return withCors(request, response);
});
