import type { RevenueCatSubscriber, SubscriptionState } from "../_shared/revenuecat.ts";

export type AccountDashboardResponse = {
  account: { email: string | null; displayName: string; profileExists: boolean };
  usage: { status: "active" | "expired"; used: number | null; limit: number | null; remaining: number | null; periodStart: string | null; resetsAt: string | null };
  subscription: SubscriptionState;
};

type Dependencies = {
  authenticate: (request: Request) => Promise<{ id: string; email: string | null }>;
  loadSubscriber: (userId: string) => Promise<RevenueCatSubscriber>;
  persistLedger: (userId: string, subscriber: RevenueCatSubscriber) => Promise<{ status: string }>;
  loadDashboardData: (userId: string) => Promise<{ displayName: string; profileExists: boolean; access: {
    status: "active" | "expired"; lifecycle_state?: SubscriptionState["state"]; plan_code?: SubscriptionState["planCode"];
    product_identifier?: string | null; store?: string | null; sandbox?: boolean; will_renew?: boolean;
    billing_period_starts_at?: string | null; paid_through?: string | null;
    quota_used: number | null; quota_limit: number | null; remaining: number | null;
    quota_period_starts_at?: string | null; quota_resets_at?: string | null;
    period_starts_at?: string | null; period_ends_at?: string | null;
  } }>;
};

function json(payload: unknown, status: number) { return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }

function managementFallback(store: string | null): string | null {
  if (store === "app_store" || store === "mac_app_store") return "https://apps.apple.com/account/subscriptions";
  if (store === "play_store") return "https://play.google.com/store/account/subscriptions";
  return null;
}

export async function accountDashboardHandler(request: Request, dependencies: Dependencies, now = new Date()): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED", message: "Method not allowed" }, 405);
  try {
    const user = await dependencies.authenticate(request);
    const subscriber = await dependencies.loadSubscriber(user.id);
    await dependencies.persistLedger(user.id, subscriber);
    const data = await dependencies.loadDashboardData(user.id);
    const state = data.access.lifecycle_state ?? (data.access.status === "active" ? "active_renewing" : "not_subscribed");
    const store = data.access.store ?? null;
    const managementUrl = subscriber.managementUrl ?? managementFallback(store);
    const subscription: SubscriptionState = {
      state,
      planCode: data.access.plan_code ?? null,
      willRenew: data.access.will_renew ?? state === "active_renewing",
      billingPeriodStart: data.access.billing_period_starts_at ?? null,
      productIdentifier: data.access.product_identifier ?? null,
      store,
      paidThrough: data.access.paid_through ?? data.access.period_ends_at ?? null,
      cancelUrl: state === "active_renewing" ? managementUrl : null,
      renewalUrl: state === "active_cancelled" || state === "expired" ? managementUrl : null,
      sandbox: data.access.sandbox ?? false,
    };
    const response: AccountDashboardResponse = { account: { email: user.email, displayName: data.displayName, profileExists: data.profileExists }, usage: { status: data.access.status, used: data.access.quota_used, limit: data.access.quota_limit, remaining: data.access.remaining, periodStart: data.access.quota_period_starts_at ?? data.access.period_starts_at ?? null, resetsAt: data.access.quota_resets_at ?? data.access.period_ends_at ?? null }, subscription };
    return json(response, 200);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ code: "UNAUTHORIZED", message: "Sign in again" }, 401);
    return json({ code: "DASHBOARD_UNAVAILABLE", message: "Account details could not be loaded" }, 502);
  }
}
