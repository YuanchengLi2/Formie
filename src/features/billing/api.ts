import { supabase } from "@/lib/supabase";

import type { AccessStatus } from "@/features/access/types";

export type EntitlementRefreshResponse = {
  access: AccessStatus;
  subscription: { state: "active_renewing" | "active_cancelled" | "expired" | "not_subscribed"; productIdentifier: string | null; store: string | null; paidThrough: string | null; cancelUrl: string | null; renewalUrl: string | null; sandbox: boolean };
  source: "revenuecat" | "unknown";
};

export async function refreshEntitlement(accessToken: string, customerInfo: { activeEntitlementIds: string[]; originalAppUserId: string | null }): Promise<EntitlementRefreshResponse> {
  const { data, error } = await supabase.functions.invoke("refresh-entitlement", {
    body: {
      customerInfo: {
        activeEntitlementIds: customerInfo.activeEntitlementIds,
        originalAppUserId: customerInfo.originalAppUserId,
      },
    },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) throw error;
  return data as EntitlementRefreshResponse;
}
