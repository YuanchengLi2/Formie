import { supabase } from "@/lib/supabase";

export type SubscriptionTestAction = "cancel_at_period_end" | "uncancel" | "renew_now" | "expire_now" | "start_new_period" | "advance_annual_quota_month" | "clear";
export type SubscriptionTestCommand = { action: SubscriptionTestAction } | { action: "set_remaining"; remaining: number };

export type SubscriptionTestResult = {
  action: SubscriptionTestAction | "set_remaining";
  remaining?: number | null;
  quotaUsed?: number | null;
  quotaPeriodStart?: string | null;
  quotaPeriodEnd?: string | null;
  lifecycleState?: string;
  willRenew?: boolean;
};

export async function runSubscriptionTestControl(action: SubscriptionTestAction): Promise<SubscriptionTestResult> {
  return applySubscriptionTestCommand({ action });
}

export async function setSubscriptionTestRemaining(remaining: number): Promise<SubscriptionTestResult> {
  if (!Number.isInteger(remaining) || remaining < 0 || remaining > 10) throw new Error("Choose between 0 and 10 analyses.");
  return applySubscriptionTestCommand({ action: "set_remaining", remaining });
}

async function applySubscriptionTestCommand(command: SubscriptionTestCommand): Promise<SubscriptionTestResult> {
  const { data, error } = await supabase.functions.invoke("subscription-test-controls", { body: command });
  if (error || !data || typeof data !== "object") throw new Error("The subscription test action could not be applied.");
  const snapshot = data as Record<string, unknown>;
  return {
    action: command.action,
    remaining: typeof snapshot.remaining === "number" ? snapshot.remaining : null,
    quotaUsed: typeof snapshot.quota_used === "number" ? snapshot.quota_used : null,
    quotaPeriodStart: typeof snapshot.quota_period_start === "string" ? snapshot.quota_period_start : null,
    quotaPeriodEnd: typeof snapshot.quota_period_end === "string" ? snapshot.quota_period_end : null,
    lifecycleState: typeof snapshot.lifecycle_state === "string" ? snapshot.lifecycle_state : typeof snapshot.lifecycleState === "string" ? snapshot.lifecycleState : undefined,
    willRenew: typeof snapshot.will_renew === "boolean" ? snapshot.will_renew : typeof snapshot.willRenew === "boolean" ? snapshot.willRenew : undefined,
  };
}
