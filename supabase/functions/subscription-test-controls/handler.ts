export type SubscriptionTestAction = "cancel_at_period_end" | "uncancel" | "renew_now" | "expire_now" | "start_new_period" | "advance_annual_quota_month" | "clear";
export type SubscriptionTestCommand = { action: SubscriptionTestAction } | { action: "set_remaining"; remaining: number };

type Dependencies = {
  enabled: () => boolean;
  authenticate: (request: Request) => Promise<string>;
  loadCurrent: (userId: string) => Promise<{ sandbox: boolean; store: string | null }>;
  apply: (userId: string, command: SubscriptionTestCommand) => Promise<unknown>;
};

const actions = new Set<SubscriptionTestAction>(["cancel_at_period_end", "uncancel", "renew_now", "expire_now", "start_new_period", "advance_annual_quota_month", "clear"]);
const json = (payload: unknown, status: number) => new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function subscriptionTestControlsHandler(request: Request, dependencies: Dependencies): Promise<Response> {
  if (!dependencies.enabled()) return json({ code: "NOT_FOUND" }, 404);
  if (request.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ code: "INVALID_BODY" }, 400); }
  const record = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  const action = record?.action;
  if (typeof action !== "string") return json({ code: "INVALID_ACTION" }, 400);
  if (action === "set_remaining") {
    if (Object.keys(record ?? {}).some((key) => key !== "action" && key !== "remaining") || typeof record?.remaining !== "number" || !Number.isInteger(record.remaining) || record.remaining < 0 || record.remaining > 10) {
      return json({ code: "INVALID_COMMAND" }, 400);
    }
  } else if (!actions.has(action as SubscriptionTestAction) || Object.keys(record ?? {}).some((key) => key !== "action")) {
    return json({ code: "INVALID_ACTION" }, 400);
  }
  const command = action === "set_remaining"
    ? { action: "set_remaining" as const, remaining: record?.remaining as number }
    : { action: action as SubscriptionTestAction };
  try {
    const userId = await dependencies.authenticate(request);
    const current = await dependencies.loadCurrent(userId);
    const mayEditSandboxBalance = command.action === "set_remaining" && current.sandbox;
    const maySimulateLifecycle = current.sandbox && current.store === "test_store";
    if (!mayEditSandboxBalance && !maySimulateLifecycle) return json({ code: "TEST_STORE_REQUIRED" }, 403);
    return json(await dependencies.apply(userId, command), 200);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ code: "UNAUTHORIZED" }, 401);
    return json({ code: "TEST_CONTROL_FAILED" }, 500);
  }
}
