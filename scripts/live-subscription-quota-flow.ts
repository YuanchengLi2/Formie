import { createClient } from "@supabase/supabase-js";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const supabaseUrl = required("EXPO_PUBLIC_SUPABASE_URL");
const anonKey = required("EXPO_PUBLIC_SUPABASE_ANON_KEY");
const admin = createClient(supabaseUrl, required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const userClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const declaration = {
  exercise: { source: "custom", catalogExerciseId: null, label: "Quota flow squat" },
  amount: { kind: "reps", value: 5, countScope: "total" },
  load: { kind: "bodyweight" },
  side: "bilateral",
  styles: [],
  focusNote: null,
};

type AccessSnapshot = {
  status: string;
  can_analyze: boolean;
  quota_used: number;
  quota_limit: number;
  remaining: number;
  period_starts_at: string | null;
  period_ends_at: string | null;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function invokeCreate(accessToken: string, clientRequestId: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/create-analysis`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clientRequestId, declaration, uploadProfile: "single_analysis_v1" }),
  });
  const body = await response.json() as Record<string, unknown>;
  return { status: response.status, body };
}

async function getAccess(userId: string): Promise<AccessSnapshot> {
  const result = await admin.rpc("get_access_status_for_user", { p_user_id: userId });
  if (result.error) throw result.error;
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as AccessSnapshot | null;
  if (!row) throw new Error("Access snapshot is missing");
  return row;
}

async function setEntitlement(userId: string, input: { status: "active" | "expired"; start: string; end: string; cancelled?: boolean }) {
  const result = await admin.from("user_access_entitlements").upsert({
    user_id: userId,
    status: input.status,
    entitlement_id: "formie_pro",
    revenuecat_app_user_id: userId,
    store_product_id: "formie_monthly",
    current_period_start: input.start,
    current_period_end: input.end,
    last_reconciled_at: new Date().toISOString(),
    last_customer_info: {
      appUserId: userId,
      entitlements: [{ identifier: "formie_pro", productIdentifier: "formie_monthly", purchaseDate: input.start, expirationDate: input.end }],
      subscriptions: [{ productIdentifier: "formie_monthly", store: "test_store", expirationDate: input.end, unsubscribeDetectedAt: input.cancelled ? new Date().toISOString() : null, sandbox: true }],
    },
  });
  if (result.error) throw result.error;
}

async function consumePeriod(accessToken: string, prefix: string, count = 10, startingRemaining = 10) {
  for (let index = 0; index < count; index += 1) {
    const created = await invokeCreate(accessToken, `${prefix}-${String(index + 1).padStart(2, "0")}`);
    assert(created.status === 201, `Create ${index + 1} failed (${created.status}): ${JSON.stringify(created.body)}`);
    assert(created.body.remaining === startingRemaining - index - 1, `Create ${index + 1} returned remaining=${String(created.body.remaining)}`);
    assert(typeof created.body.reservationId === "string", `Create ${index + 1} did not return a reservation ID`);
  }
}

async function main() {
  const nonce = crypto.randomUUID();
  const email = `quota-flow-${nonce}@example.invalid`;
  const password = `Quota-${nonce}!`;
  let userId: string | null = null;
  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error("Could not create disposable quota user");
    userId = created.data.user.id;
    const signedIn = await userClient.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Could not sign in disposable quota user");
    const accessToken = signedIn.data.session.access_token;

    const now = Date.now();
    const firstStart = new Date(now - 24 * 60 * 60 * 1_000).toISOString();
    const firstEnd = new Date(now + 29 * 24 * 60 * 60 * 1_000).toISOString();
    await setEntitlement(userId, { status: "active", start: firstStart, end: firstEnd });
    assert((await getAccess(userId)).remaining === 10, "A new active billing period did not start at 10");

    const failedCreate = await invokeCreate(accessToken, `failed-${nonce}`);
    assert(failedCreate.status === 201 && typeof failedCreate.body.sessionId === "string", `Failed-flow reservation could not be created: ${JSON.stringify(failedCreate)}`);
    const failedTerminal = await admin.from("analysis_sessions").update({ status: "failed" }).eq("id", failedCreate.body.sessionId);
    if (failedTerminal.error) throw failedTerminal.error;
    assert((await getAccess(userId)).remaining === 10, "A failed analysis did not refund its reserved credit");

    const completedCreate = await invokeCreate(accessToken, `completed-${nonce}`);
    assert(completedCreate.status === 201 && typeof completedCreate.body.sessionId === "string", `Completed-flow reservation could not be created: ${JSON.stringify(completedCreate)}`);
    const completedTerminal = await admin.from("analysis_sessions").update({ status: "complete", completed_at: new Date().toISOString() }).eq("id", completedCreate.body.sessionId);
    if (completedTerminal.error) throw completedTerminal.error;
    assert((await getAccess(userId)).remaining === 9, "A completed analysis did not remain committed");

    await consumePeriod(accessToken, `period-one-${nonce}`, 9, 9);
    const exhausted = await getAccess(userId);
    assert(exhausted.status === "active" && exhausted.remaining === 0 && exhausted.can_analyze === false, `Active zero-quota state is wrong: ${JSON.stringify(exhausted)}`);
    const denied = await invokeCreate(accessToken, `period-one-over-${nonce}`);
    assert(denied.status === 402 && denied.body.code === "ANALYSIS_QUOTA_EXCEEDED", `Eleventh analysis was not quota-blocked: ${JSON.stringify(denied)}`);

    const renewedStart = new Date(now - 60_000).toISOString();
    const renewedEnd = new Date(now + 30 * 24 * 60 * 60 * 1_000).toISOString();
    await setEntitlement(userId, { status: "active", start: renewedStart, end: renewedEnd, cancelled: true });
    const renewed = await getAccess(userId);
    assert(renewed.remaining === 10 && renewed.can_analyze === true, `Renewal did not replenish to 10: ${JSON.stringify(renewed)}`);

    await consumePeriod(accessToken, `period-two-${nonce}`);
    const cancelledExhausted = await getAccess(userId);
    assert(cancelledExhausted.status === "active" && cancelledExhausted.remaining === 0 && cancelledExhausted.can_analyze === false, `Cancelled paid-through zero quota is wrong: ${JSON.stringify(cancelledExhausted)}`);

    const expiredStart = new Date(now - 31 * 24 * 60 * 60 * 1_000).toISOString();
    const expiredEnd = new Date(now - 60_000).toISOString();
    await setEntitlement(userId, { status: "expired", start: expiredStart, end: expiredEnd, cancelled: true });
    const expired = await getAccess(userId);
    assert(expired.status === "expired" && expired.remaining === 0 && expired.can_analyze === false, `Expired access state is wrong: ${JSON.stringify(expired)}`);
    const purchaseRequired = await invokeCreate(accessToken, `expired-${nonce}`);
    assert(purchaseRequired.status === 402 && purchaseRequired.body.code === "ANALYSIS_SUBSCRIPTION_REQUIRED", `Expired user was not purchase-blocked: ${JSON.stringify(purchaseRequired)}`);

    process.stdout.write(`${JSON.stringify({ status: "passed", firstPeriod: exhausted, renewedPeriod: renewed, cancelledExhausted, expired }, null, 2)}\n`);
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
