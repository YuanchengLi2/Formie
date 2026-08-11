import { existsSync, readFileSync, readdirSync } from "node:fs";
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

  it("lets a newer provider period supersede every Test Store scenario except an explicit cancellation", () => {
    const migrationDirectory = resolve(process.cwd(), "supabase/migrations");
    const allMigrations = readdirSync(migrationDirectory)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => readFileSync(resolve(migrationDirectory, name), "utf8"))
      .join("\n");

    expect(allMigrations).toContain("clear_superseded_subscription_test_scenario");
    expect(allMigrations).toContain("scenario.lifecycle_state <> 'active_cancelled'");
    expect(allMigrations).toContain("scenario.billing_period_end < coalesce(new.billing_period_end, new.current_period_end)");
  });

  it("keeps confirmed access usable while a renewing provider period is propagating", () => {
    const renewalSql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/202608080003_preserve_access_during_renewal_pending.sql"),
      "utf8",
    );

    expect(renewalSql).toContain("effective_state in ('active_renewing', 'active_cancelled', 'renewal_pending')");
    expect(renewalSql).toContain("billing_end > now() or effective_state = 'renewal_pending'");
    expect(renewalSql).toMatch(/return query select\s+'active',\s+effective_state/);
  });

  it("keeps quota overrides and real reservation deltas in the latest access function", () => {
    const migrationDirectory = resolve(process.cwd(), "supabase/migrations");
    const allMigrations = readdirSync(migrationDirectory)
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .map((name) => readFileSync(resolve(migrationDirectory, name), "utf8"))
      .join("\n");
    const accessDefinitions = allMigrations.match(
      /create or replace function public\.get_access_status_for_user[\s\S]*?\n\$\$;/g,
    );
    const latestAccessDefinition = accessDefinitions?.at(-1) ?? "";

    expect(latestAccessDefinition).toContain("scenario.quota_remaining_override");
    expect(latestAccessDefinition).toContain("scenario.quota_actual_used_at_override");
    expect(latestAccessDefinition).toContain("greatest(actual_used - scenario.quota_actual_used_at_override, 0)");
    expect(latestAccessDefinition).toContain("effective_state in ('active_renewing', 'active_cancelled', 'renewal_pending')");
  });

  it("uses provider billing boundaries instead of five-minute sandbox quota windows", () => {
    const migrationPath = resolve(
      process.cwd(),
      "supabase/migrations/202608100002_provider_billing_periods_for_sandbox.sql",
    );

    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("return query select p_billing_start, p_billing_end");
    expect(migration).not.toContain("interval '5 minutes'");
    expect(migration).not.toContain("p_store = 'test_store'");
  });
});
