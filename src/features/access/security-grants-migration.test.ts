import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("security audit RPC grants", () => {
  const sql = () => readFileSync(
    resolve(process.cwd(), "supabase/migrations/202608130001_security_audit_rpc_grants.sql"),
    "utf8",
  ).toLowerCase();

  it("removes anonymous access from user-scoped security-definer functions", () => {
    expect(sql()).toContain("revoke all on function public.get_my_access_status() from public, anon");
    expect(sql()).toContain("revoke all on function public.cancel_analysis_reservation(uuid) from public, anon");
    expect(sql()).toContain("revoke all on function public.validate_active_analysis_credit_reservation() from public, anon, authenticated");
    expect(sql()).toContain("grant execute on function public.validate_active_analysis_credit_reservation() to service_role");
  });

  it("limits catalog cleanup to the service role", () => {
    expect(sql()).toContain("revoke all on function public.delete_stale_exercise_catalog_batch(text, text, integer) from public, anon, authenticated");
    expect(sql()).toContain("grant execute on function public.delete_stale_exercise_catalog_batch(text, text, integer) to service_role");
  });

  it("moves pg_trgm out of the exposed public schema", () => {
    const extensionSql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/202608130002_move_pg_trgm_extension.sql"),
      "utf8",
    ).toLowerCase();

    expect(extensionSql).toContain("create schema if not exists extensions");
    expect(extensionSql).toContain("alter extension pg_trgm set schema extensions");
  });
});
