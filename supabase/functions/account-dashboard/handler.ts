import { resolveSubscriptionState, type RevenueCatSubscriber, type SubscriptionState } from "../_shared/revenuecat.ts";

export type AccountDashboardResponse = {
  account: { email: string | null; displayName: string; profileExists: boolean };
  usage: { status: "active" | "expired"; used: number | null; limit: number | null; remaining: number | null; periodStart: string | null; resetsAt: string | null };
  subscription: SubscriptionState;
};

type Dependencies = {
  authenticate: (request: Request) => Promise<{ id: string; email: string | null }>;
  loadSubscriber: (userId: string) => Promise<RevenueCatSubscriber>;
  persistLedger: (userId: string, subscriber: RevenueCatSubscriber) => Promise<{ status: string }>;
  loadDashboardData: (userId: string) => Promise<{ displayName: string; profileExists: boolean; access: { status: "active" | "expired"; quota_used: number | null; quota_limit: number | null; remaining: number | null; period_starts_at: string | null; period_ends_at: string | null } }>;
};

function json(payload: unknown, status: number) { return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }

export async function accountDashboardHandler(request: Request, dependencies: Dependencies, now = new Date()): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED", message: "Method not allowed" }, 405);
  try {
    const user = await dependencies.authenticate(request);
    const subscriber = await dependencies.loadSubscriber(user.id);
    await dependencies.persistLedger(user.id, subscriber);
    const data = await dependencies.loadDashboardData(user.id);
    const subscription = resolveSubscriptionState(subscriber, now);
    const response: AccountDashboardResponse = { account: { email: user.email, displayName: data.displayName, profileExists: data.profileExists }, usage: { status: data.access.status, used: data.access.quota_used, limit: data.access.quota_limit, remaining: data.access.remaining, periodStart: data.access.period_starts_at, resetsAt: data.access.period_ends_at }, subscription };
    return json(response, 200);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ code: "UNAUTHORIZED", message: "Sign in again" }, 401);
    return json({ code: "DASHBOARD_UNAVAILABLE", message: "Account details could not be loaded" }, 502);
  }
}
