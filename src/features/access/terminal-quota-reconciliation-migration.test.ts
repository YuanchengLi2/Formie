import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("terminal analysis quota reconciliation", () => {
  const migrationPath = resolve(
    __dirname,
    "../../../supabase/migrations/202608280001_reconcile_terminal_analysis_quota.sql",
  );

  it("commits only the newest reserved attempt when a reused session completes", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toMatch(/order by reservation\.created_at desc, reservation\.id desc[\s\S]*limit 1/i);
    expect(migration).toMatch(/set status = 'committed'[\s\S]*where id = winning_reservation_id/i);
    expect(migration).toMatch(/set status = 'cancelled'[\s\S]*id <> winning_reservation_id/i);
  });

  it("reinstalls terminal reconciliation and repairs already terminal sessions", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("create or replace function public.reconcile_analysis_credit_for_session");
    expect(migration).toContain("create trigger commit_analysis_credit_after_session");
    expect(migration).toMatch(/for terminal_session in[\s\S]*perform public\.reconcile_analysis_credit_for_session/i);
  });
});
