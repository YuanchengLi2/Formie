import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(__dirname, "../../migrations/202608030001_problem_finder_v49_isolation.sql");
const rawOutputMigrationPath = resolve(__dirname, "../../migrations/202608030002_v49_raw_output_any_json.sql");

describe("v49 isolated persistence", () => {
  it("creates versioned runs and one uniquely claimed row per stage", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/create table public\.analysis_v49_runs/i);
    expect(sql).toMatch(/mode text not null check \(mode in \('primary', 'shadow'\)\)/i);
    expect(sql).toMatch(/create table public\.analysis_v49_stage_runs/i);
    expect(sql).toMatch(/unique \(run_id, stage\)/i);
    expect(sql).toMatch(/active_v49_run_id uuid/i);
    expect(sql).toMatch(/v49_run_id uuid/i);
    expect(sql).toMatch(/raw_problem_output jsonb/i);
    expect(sql).toMatch(/raw_writer_output jsonb/i);
    expect(sql).toMatch(/revoke all on table public\.analysis_v49_runs from anon, authenticated/i);
    expect(sql).toMatch(/grant all on table public\.analysis_v49_runs to service_role/i);
  });

  it("preserves old results and fences commits to the active run", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const reset = sql.slice(sql.indexOf("create or replace function public.reset_analysis_for_reanalysis"));
    expect(reset).not.toMatch(/delete from public\.analysis_results/i);
    expect(reset).not.toMatch(/delete from public\.model_call_telemetry/i);
    expect(sql).toMatch(/active_v49_run_id\s*=\s*p_run_id/i);
    expect(sql).toMatch(/where id = target_run\.session_id[\s\S]*active_v49_run_id = p_run_id/i);
  });

  it("keeps shadow completion from changing the visible session", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/if target_run\.mode = 'primary' then[\s\S]*update public\.analysis_sessions/i);
  });

  it("does not reclaim an unchanged deterministic schema failure", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/existing\.status = 'failed'[\s\S]*existing\.error_code = 'ANALYSIS_CONTRACT_INVALID'[\s\S]*select 'failed'/i);
    expect(sql).toMatch(/create or replace function public\.fail_analysis_v49_run/i);
    expect(sql).toMatch(/active_v49_run_id = p_run_id/i);
  });

  it("stores malformed provider JSON before strict parsing", () => {
    const sql = readFileSync(rawOutputMigrationPath, "utf8");
    expect(sql).toContain("drop constraint if exists analysis_v49_runs_raw_problem_output_check");
    expect(sql).toContain("drop constraint if exists analysis_v49_runs_raw_writer_output_check");
  });
});
