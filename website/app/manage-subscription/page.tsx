import type { Metadata } from "next";

import { getAccountDashboard } from "@/lib/account-dashboard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ManageSubscriptionClient } from "./manage-subscription-client";

export const metadata: Metadata = { title: "Formie Subscription", description: "Manage your Formie plan, billing period, and monthly analysis balance.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ManageSubscriptionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  let dashboard = null;
  let authenticated = false;
  let error = params.error ?? null;
  try {
    const client = await createServerSupabaseClient();
    const { data } = await client.auth.getUser();
    if (data.user) {
      authenticated = true;
      try { dashboard = await getAccountDashboard(client); }
      catch { error = "Your account details could not be loaded. Please sign in again."; }
    }
  } catch { error = "Formie account access is not configured yet."; }
  return <ManageSubscriptionClient initialDashboard={dashboard} initialAuthenticated={authenticated} initialError={error} />;
}
