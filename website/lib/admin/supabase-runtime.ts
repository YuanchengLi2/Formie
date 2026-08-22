import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { enrichDashboardSnapshot, type AccuracyInput } from "./dashboard-accuracy";
import { loadAdminDashboard } from "./load-dashboard";

function required(name: string, fallbacks: string[] = []): string {
  for (const key of [name, ...fallbacks]) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing ${name}`);
}

export function supabaseUrl() {
  return required("NEXT_PUBLIC_SUPABASE_URL", ["SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL"]);
}

export function supabaseAnonKey() {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", ["SUPABASE_ANON_KEY", "EXPO_PUBLIC_SUPABASE_ANON_KEY"]);
}

export async function createCookieClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values) {
          try {
            cookieStore.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              path: "/",
              maxAge: Math.min(typeof options.maxAge === "number" ? options.maxAge : 8 * 60 * 60, 8 * 60 * 60),
            });
          } catch { /* Server Components cannot mutate cookies. */ }
        }
      },
    },
  });
}

type RowPage<T> = { data: T[] | null; error: { message: string } | null };

async function fetchAllRows<T>(label: string, fetchPage: (from: number, to: number) => PromiseLike<RowPage<T>>): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(`${label} query failed: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function nullableNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function loadRuntimeAdminDashboard() {
  const authClient = await createCookieClient();
  const adminClient = createClient(supabaseUrl(), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return loadAdminDashboard({
    getAuthenticatedEmail: async () => {
      const { data, error } = await authClient.auth.getUser();
      if (error || !data.user) return null;
      return data.user.email ?? null;
    },
    getSnapshot: async () => {
      const usersPromise = (async () => {
        const users: AccuracyInput["users"] = [];
        for (let page = 1; ; page += 1) {
          const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
          if (error) throw new Error(`Dashboard users query failed: ${error.message}`);
          users.push(...data.users.map((user) => ({ id: user.id, createdAt: user.created_at })));
          if (data.users.length < 1000) return users;
        }
      })();

      const [snapshotResult, users, profileRows, analysisRows, eventRows, entitlementRows, purchaseRows, telemetryRows] = await Promise.all([
        adminClient.rpc("get_founder_dashboard_snapshot"),
        usersPromise,
        fetchAllRows("Dashboard profiles", (from, to) => adminClient.from("user_profiles").select("user_id,onboarding_completed_at").range(from, to)),
        fetchAllRows("Dashboard analyses", (from, to) => adminClient.from("analysis_sessions").select("id,user_id,status,created_at,completed_at").range(from, to)),
        fetchAllRows("Dashboard events", (from, to) => adminClient.from("product_analytics_events").select("user_id,event_name,created_at").range(from, to)),
        fetchAllRows("Dashboard entitlements", (from, to) => adminClient.from("user_access_entitlements").select("user_id,status,sandbox,entitlement_id,store_product_id,revenuecat_app_user_id,lifecycle_state,billing_period_end,current_period_end").range(from, to)),
        fetchAllRows("Dashboard purchases", (from, to) => adminClient.from("revenuecat_webhook_events").select("app_user_id,event_type,status,environment,purchased_at,event_timestamp,completed_at,received_at").range(from, to)),
        fetchAllRows("Dashboard telemetry", (from, to) => adminClient.from("model_call_telemetry").select("session_id,model,created_at,prompt_tokens,output_tokens,thinking_tokens,estimated_cost_usd").range(from, to)),
      ]);
      if (snapshotResult.error) throw new Error(`Dashboard query failed: ${snapshotResult.error.message}`);

      return enrichDashboardSnapshot(snapshotResult.data as never, {
        now: new Date().toISOString(),
        users,
        profiles: profileRows.map((row) => ({ userId: row.user_id, onboardingCompletedAt: row.onboarding_completed_at })),
        analyses: analysisRows.map((row) => ({ id: row.id, userId: row.user_id, status: row.status, createdAt: row.created_at, completedAt: row.completed_at })),
        events: eventRows.map((row) => ({ userId: row.user_id, eventName: row.event_name, createdAt: row.created_at })),
        entitlements: entitlementRows.map((row) => ({
          userId: row.user_id, status: row.status, sandbox: row.sandbox, entitlementId: row.entitlement_id,
          storeProductId: row.store_product_id, revenuecatAppUserId: row.revenuecat_app_user_id,
          lifecycleState: row.lifecycle_state, billingPeriodEnd: row.billing_period_end, currentPeriodEnd: row.current_period_end,
        })),
        purchases: purchaseRows.map((row) => ({
          appUserId: row.app_user_id, eventType: row.event_type, status: row.status, environment: row.environment,
          purchasedAt: row.purchased_at, eventTimestamp: row.event_timestamp, completedAt: row.completed_at, receivedAt: row.received_at,
        })),
        telemetry: telemetryRows.map((row) => ({
          sessionId: row.session_id, model: row.model, createdAt: row.created_at,
          promptTokens: row.prompt_tokens, outputTokens: row.output_tokens, thinkingTokens: row.thinking_tokens,
          estimatedCostUsd: nullableNumber(row.estimated_cost_usd),
        })),
      });
    },
  }, process.env.FORMIE_ADMIN_EMAIL);
}
