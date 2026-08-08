import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("subscription state machine migration", () => {
  const sql = () => readFileSync(resolve(process.cwd(), "supabase/migrations/202608070001_subscription_state_machine_and_plan_quota.sql"), "utf8");

  it("separates billing periods from monthly quota periods for monthly and annual plans", () => {
    expect(sql()).toContain("subscription_product_catalog");
    expect(sql()).toContain("resolve_subscription_quota_period");
    expect(sql()).toContain("formie_yearly");
    expect(sql()).toContain("interval '5 minutes'");
    expect(sql()).toContain("quota_period_start");
    expect(sql()).toContain("quota_period_end");
  });

  it("returns normalized lifecycle and pending-analysis state from the access RPC", () => {
    expect(sql()).toContain("lifecycle_state");
    expect(sql()).toContain("will_renew");
    expect(sql()).toContain("billing_period_end");
    expect(sql()).toContain("pending_analysis_session_id");
    expect(sql()).toContain("analysis_pending");
    expect(sql()).toContain("reservation.status = 'reserved'");
    expect(sql()).toContain("state_version");
  });

  it("keeps development lifecycle scenarios service-controlled", () => {
    expect(sql()).toContain("subscription_test_scenarios");
    expect(sql()).toContain("revoke all on public.subscription_test_scenarios from public, anon, authenticated");
  });
});
