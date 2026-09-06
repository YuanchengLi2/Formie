import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("founder reporting keeps native currencies out of USD headline metrics", () => {
  const sql = readFileSync(resolve(__dirname, "../../../supabase/migrations/202609050018_currency_safe_founder_reporting.sql"), "utf8");
  const loader = readFileSync(resolve(__dirname, "./load-business-dashboard.ts"), "utf8");

  assert.match(sql, /currency='USD'/i);
  assert.match(sql, /v_usd_tx<v_all_tx/i);
  assert.match(sql, /latest\.currency='USD'/i);
  assert.match(sql, /no recorded FX conversion exists/i);
  assert.match(sql, /revoke all on function public\.get_founder_business_dashboard_v2[\s\S]*authenticated/i);
  assert.match(sql, /grant execute on function public\.get_founder_business_dashboard_v2[\s\S]*service_role/i);
  assert.match(loader, /rpc\("get_founder_business_dashboard_v10"/i);
  assert.match(loader, /rpc\("get_founder_creator_detail_v2"/i);
});
