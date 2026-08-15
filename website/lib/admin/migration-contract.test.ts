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
