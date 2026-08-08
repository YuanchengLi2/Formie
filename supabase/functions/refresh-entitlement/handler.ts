import { activeRevenueCatEntitlement, resolveSubscriptionState, type RevenueCatSubscriber } from "../_shared/revenuecat.ts";

type AccessRow = {
  status: "active" | "expired";
  entitlement_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  store_product_id: string | null;
};

export type RefreshEntitlementDependencies = {
  authenticate: (request: Request) => Promise<string>;
  loadSubscriber: (appUserId: string) => Promise<RevenueCatSubscriber>;
  saveAccess: (input: { userId: string; subscriber: RevenueCatSubscriber; activeEntitlementId: string }) => Promise<AccessRow>;
  loadAccess: (userId: string) => Promise<{ status: "active" | "expired" | "unknown"; lifecycle_state: "active_renewing" | "active_cancelled" | "renewal_pending" | "expired" | "not_subscribed"; can_analyze: boolean; quota_used: number; quota_limit: number; remaining: number; quota_period_start: string | null; quota_period_end: string | null; period_starts_at: string | null; period_ends_at: string | null; billing_period_start: string | null; billing_period_end: string | null; entitlement_id: string | null; product_identifier: string | null; plan_code: "monthly" | "annual" | null; store: string | null; sandbox: boolean; will_renew: boolean; pending_analysis_session_id: string | null; state_version?: number; source: "revenuecat" }>;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

export async function refreshEntitlementHandler(request: Request, dependencies: RefreshEntitlementDependencies, entitlementId = "formie_pro"): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const userId = await dependencies.authenticate(request);
    const subscriber = await dependencies.loadSubscriber(userId);
    if (subscriber.appUserId !== userId) return json({ message: "RevenueCat user mismatch", code: "REVENUECAT_USER_MISMATCH" }, 409);
    const active = activeRevenueCatEntitlement(subscriber, entitlementId);
    await dependencies.saveAccess({ userId, subscriber, activeEntitlementId: active?.identifier ?? entitlementId });
    const row = await dependencies.loadAccess(userId);
    const providerManagement = resolveSubscriptionState(subscriber, new Date(), entitlementId);
    const subscription = {
      state: row.lifecycle_state,
      planCode: row.plan_code,
      willRenew: row.will_renew,
      billingPeriodStart: row.billing_period_start,
      productIdentifier: row.product_identifier,
      store: row.store,
      paidThrough: row.billing_period_end,
      cancelUrl: row.lifecycle_state === "active_renewing" ? providerManagement.cancelUrl : null,
      renewalUrl: row.lifecycle_state === "active_cancelled" || row.lifecycle_state === "expired" ? providerManagement.renewalUrl : null,
      sandbox: row.sandbox,
    };
    return json({ access: {
      status: row.status,
      lifecycleState: row.lifecycle_state,
      canAnalyze: row.can_analyze,
      quotaUsed: row.quota_used,
      quotaLimit: row.quota_limit,
      remaining: row.remaining,
      periodStartsAt: row.period_starts_at,
      periodEndsAt: row.period_ends_at,
      quotaPeriodStartsAt: row.quota_period_start,
      quotaResetsAt: row.quota_period_end,
      billingPeriodStartsAt: row.billing_period_start,
      paidThrough: row.billing_period_end,
      productIdentifier: row.product_identifier,
      planCode: row.plan_code,
      store: row.store,
      sandbox: row.sandbox,
      willRenew: row.will_renew,
      pendingAnalysisSessionId: row.pending_analysis_session_id,
      stateVersion: row.state_version ?? 0,
      entitlementId: row.entitlement_id,
      source: "revenuecat",
      refreshedAt: new Date().toISOString(),
    }, subscription, source: "revenuecat" }, 200);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    return json({ message: "Subscription status could not be refreshed", code: "REFRESH_FAILED" }, 502);
  }
}
