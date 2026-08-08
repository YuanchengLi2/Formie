import { createClient } from "@supabase/supabase-js";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const client = createClient(required("EXPO_PUBLIC_SUPABASE_URL"), required("EXPO_PUBLIC_SUPABASE_ANON_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Snapshot = {
  status: string;
  lifecycle_state: string;
  plan_code: string | null;
  will_renew: boolean;
  remaining: number;
  quota_period_start: string | null;
  quota_period_end: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function snapshot(): Promise<Snapshot> {
  const { data, error } = await client.rpc("get_my_access_status");
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Snapshot | null;
  if (!row) throw new Error("Access snapshot is missing");
  return row;
}

async function control(action: "cancel_at_period_end" | "uncancel" | "renew_now" | "expire_now" | "start_new_period" | "advance_annual_quota_month" | "clear" | "set_remaining", remaining?: number): Promise<Snapshot> {
  const { data, error } = await client.functions.invoke("subscription-test-controls", { body: action === "set_remaining" ? { action, remaining } : { action } });
  if (error) throw error;
  return data as Snapshot;
}

async function reserveOne(): Promise<Snapshot> {
  const { data, error } = await client.rpc("reserve_analysis_session_v2", { p_client_request_id: `live-${Date.now()}-${Math.random().toString(36).slice(2)}` });
  if (error) throw error;
  const reservation = Array.isArray(data) ? data[0] : data;
  assert(reservation?.status === "reserved", `Expected one analysis reservation, got ${reservation?.status ?? "no result"}`);
  return snapshot();
}

async function main() {
  const email = required("FORMIE_TEST_STORE_EMAIL");
  const password = required("FORMIE_TEST_STORE_PASSWORD");
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Could not sign in to the disposable Test Store account");

  const initial = await snapshot();
  assert(initial.status === "active", "Purchase a RevenueCat Test Store subscription on this disposable account before running the flow");
  const initialQuotaStart = initial.quota_period_start;
  const initialBillingEnd = initial.billing_period_end;

  const chosen = await control("set_remaining", 1);
  assert(chosen.remaining === 1, "Chosen remaining balance was not applied");
  const afterOne = await reserveOne();
  assert(afterOne.remaining === 0, "A real reservation did not decrement the chosen balance");
  const { error: blockedError } = await client.rpc("reserve_analysis_session_v2", { p_client_request_id: `live-blocked-${Date.now()}` });
  assert(Boolean(blockedError), "Zero quota allowed another analysis reservation");

  const cancelled = await control("cancel_at_period_end");
  assert(cancelled.lifecycle_state === "active_cancelled" && cancelled.will_renew === false, "Cancellation did not stop the next renewal");
  assert(cancelled.remaining === 0 && cancelled.billing_period_end === initialBillingEnd, "Cancellation changed the paid period or quota");

  const uncancelled = await control("uncancel");
  assert(uncancelled.lifecycle_state === "active_renewing" && uncancelled.will_renew === true, "Undo cancellation did not restore renewal");
  assert(uncancelled.remaining === 0 && uncancelled.quota_period_start === initialQuotaStart && uncancelled.billing_period_end === initialBillingEnd, "Undo cancellation reset the current period or balance");

  const renewed = await control("renew_now");
  assert(renewed.lifecycle_state === "active_renewing" && renewed.remaining === 10, "Renewal did not begin with 10 analyses");
  assert(Date.parse(renewed.billing_period_end ?? "") - Date.parse(renewed.billing_period_start ?? "") === 20 * 60 * 1000, "Test Store monthly period was not exactly 20 minutes");
  assert(renewed.billing_period_start !== initial.billing_period_start, "Renewal did not advance the billing period");

  const expired = await control("expire_now");
  assert(expired.lifecycle_state === "expired" && expired.status === "expired" && expired.remaining === 0, "Expiry did not close analysis access");

  const repurchased = await control("start_new_period");
  assert(repurchased.status === "active" && repurchased.remaining === 10, "A fresh paid period did not restore access and quota");
  assert(repurchased.quota_period_start !== renewed.quota_period_start, "A fresh period carried the previous quota period forward");

  let annual: Snapshot | null = null;
  if (repurchased.plan_code === "annual") {
    annual = await control("advance_annual_quota_month");
    assert(annual.remaining === 10 && annual.quota_period_start !== repurchased.quota_period_start, "Annual monthly quota did not advance without carryover");
  }

  await control("clear");
  process.stdout.write(`${JSON.stringify({ status: "passed", initial, cancelled, uncancelled, renewed, expired, repurchased, annual }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
