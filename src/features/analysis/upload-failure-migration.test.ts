import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(__dirname, "../../../supabase/migrations/202608230001_atomic_preprocessing_failure.sql");

describe("atomic preprocessing failure migration", () => {
  const sql = () => readFileSync(migrationPath, "utf8");

  it("locks an owned session and terminalizes only pre-processing states", () => {
    const source = sql();
    expect(source).toMatch(/where id = p_session_id\s+and user_id = p_user_id\s+for update/i);
    expect(source).toMatch(/target\.status in \('created', 'uploading', 'queued'\)/i);
    expect(source).toMatch(/status = 'failed'/i);
    expect(source).toMatch(/stage = 'failed'/i);
    expect(source).toMatch(/analysis_next_retry_at = null/i);
  });

  it("cancels only the matching reserved credit and is service-role only", () => {
    const source = sql();
    expect(source).toMatch(/status = 'reserved'/i);
    expect(source).toMatch(/session_id = p_session_id/i);
    expect(source).toMatch(/revoke all on function public\.fail_preprocessing_analysis[\s\S]+from public, anon, authenticated/i);
    expect(source).toMatch(/grant execute on function public\.fail_preprocessing_analysis[\s\S]+to service_role/i);
  });

  it("maps only the two supported failure codes", () => {
    const source = sql();
    expect(source).toContain("UPLOAD_FAILED");
    expect(source).toContain("UPLOAD_CANCELLED");
    expect(source).toMatch(/p_failure_code not in \('UPLOAD_FAILED', 'UPLOAD_CANCELLED'\)/i);
  });
});
