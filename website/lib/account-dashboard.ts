export type AccountDashboardResponse = {
  account: { email: string | null; displayName: string; profileExists: boolean };
  usage: { status: "active" | "expired"; used: number | null; limit: number | null; remaining: number | null; periodStart: string | null; resetsAt: string | null };
  subscription: { state: "active_renewing" | "active_cancelled" | "renewal_pending" | "expired" | "not_subscribed"; planCode?: "monthly" | "annual" | null; willRenew?: boolean; billingPeriodStart?: string | null; productIdentifier: string | null; store: string | null; paidThrough: string | null; cancelUrl: string | null; renewalUrl: string | null; sandbox: boolean };
};

export function parseAccountDashboard(value: unknown): AccountDashboardResponse {
  const candidate = value as AccountDashboardResponse | null;
  const validState = ["active_renewing", "active_cancelled", "renewal_pending", "expired", "not_subscribed"].includes(candidate?.subscription?.state ?? "");
  const validUsage = ["active", "expired"].includes(candidate?.usage?.status ?? "");
  const usage = candidate?.usage;
  const numbersValid = usage && [usage.used, usage.limit, usage.remaining].every((item) => item === null || (Number.isInteger(item) && item >= 0));
  const activePeriodValid = usage?.status !== "active" || (
    typeof usage.periodStart === "string"
    && typeof usage.resetsAt === "string"
    && typeof usage.used === "number"
    && typeof usage.limit === "number"
    && typeof usage.remaining === "number"
    && usage.used + usage.remaining === usage.limit
  );
  const statesAgree = !candidate || (
    usage?.status === "active"
      ? candidate.subscription.state === "active_renewing" || candidate.subscription.state === "active_cancelled" || candidate.subscription.state === "renewal_pending"
      : candidate.subscription.state === "expired" || candidate.subscription.state === "not_subscribed"
  );
  if (!candidate?.account || typeof candidate.account.displayName !== "string" || typeof candidate.account.profileExists !== "boolean" || !validState || !validUsage || !numbersValid || !activePeriodValid || !statesAgree) throw new Error("The account dashboard returned an invalid response.");
  return candidate;
}

export async function getAccountDashboard(client: Pick<SupabaseClient, "functions">): Promise<AccountDashboardResponse> {
  const { data, error } = await client.functions.invoke("account-dashboard", { method: "GET" });
  if (error) throw new Error("Your account details could not be loaded.");
  return parseAccountDashboard(data);
}
import type { SupabaseClient } from "@supabase/supabase-js";
