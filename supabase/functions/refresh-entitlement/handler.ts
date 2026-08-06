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
  loadAccess: (userId: string) => Promise<{ status: "active" | "expired"; can_analyze: boolean; quota_used: number; quota_limit: number; remaining: number; period_starts_at: string | null; period_ends_at: string | null; entitlement_id: string | null; source: "revenuecat" }>;
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
    return json({ access: {
      status: row.status,
      canAnalyze: row.can_analyze,
      quotaUsed: row.quota_used,
      quotaLimit: row.quota_limit,
      remaining: row.remaining,
      periodStartsAt: row.period_starts_at,
      periodEndsAt: row.period_ends_at,
      entitlementId: row.entitlement_id,
      source: "revenuecat",
      refreshedAt: new Date().toISOString(),
    }, subscription: resolveSubscriptionState(subscriber, new Date(), entitlementId), source: "revenuecat" }, 200);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    return json({ message: "Subscription status could not be refreshed", code: "REFRESH_FAILED" }, 502);
  }
}
