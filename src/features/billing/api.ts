import { supabase } from "@/lib/supabase";

import type { AccessStatus } from "@/features/access/types";

export type EntitlementRefreshResponse = {
  access: AccessStatus;
  subscription: { state: "active_renewing" | "active_cancelled" | "renewal_pending" | "expired" | "not_subscribed"; planCode: "monthly" | "annual" | null; willRenew: boolean; billingPeriodStart: string | null; productIdentifier: string | null; store: string | null; paidThrough: string | null; cancelUrl: string | null; renewalUrl: string | null; sandbox: boolean };
  source: "revenuecat" | "unknown";
};

export async function refreshEntitlement(accessToken: string): Promise<EntitlementRefreshResponse> {
  const { data, error } = await supabase.functions.invoke("refresh-entitlement", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) throw error;
  return data as EntitlementRefreshResponse;
}
