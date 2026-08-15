import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("admin reporting migration keeps privileged reads server-only and feedback user-owned", () => {
  const sql = readFileSync(resolve(__dirname, "../../../supabase/migrations/202608140001_founder_dashboard.sql"), "utf8");

  assert.match(sql, /create or replace function public\.get_founder_dashboard_snapshot/i);
  assert.match(sql, /current_user not in \('postgres', 'service_role'\)/i);
  assert.match(sql, /revoke all on function public\.get_founder_dashboard_snapshot/i);
  assert.match(sql, /grant execute on function public\.get_founder_dashboard_snapshot\(\) to service_role/i);
  assert.match(sql, /create table if not exists public\.analysis_feedback/i);
  assert.match(sql, /auth\.uid\(\) = user_id/i);
  assert.match(sql, /submit_analysis_feedback/i);
  assert.match(sql, /sandbox = false/i);
});

test("accuracy-first reporting prices known token usage and builds an ordered production funnel", () => {
  const sql = readFileSync(resolve(__dirname, "../../../supabase/migrations/202608140002_accuracy_first_founder_dashboard.sql"), "utf8");

  assert.match(sql, /create table if not exists public\.ai_model_pricing/i);
  assert.match(sql, /prompt_tokens.*input_usd_per_million/is);
  assert.match(sql, /output_tokens.*thinking_tokens.*output_usd_per_million/is);
  assert.match(sql, /upper\(event\.environment\)\s*=\s*'PRODUCTION'/i);
  assert.match(sql, /first_analysis_at\s*>=\s*cohort\.onboarding_completed_at/i);
  assert.match(sql, /paywall_at\s*>=\s*cohort\.first_analysis_at/i);
  assert.match(sql, /purchase_at\s*>=\s*cohort\.paywall_at/i);
  assert.match(sql, /delivered\.delivered_at\s*>\s*cohort\.purchase_at/i);
  assert.match(sql, /'accuracy'/i);
  assert.match(sql, /'unpricedCalls'/i);
  assert.match(sql, /sandbox\s*=\s*false/i);
});
