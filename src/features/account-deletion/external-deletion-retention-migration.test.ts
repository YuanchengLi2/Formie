import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("external deletion queue retention migration", () => {
  it("deletes every expired encrypted payload independently of worker claims", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/202609040001_external_deletion_job_retention.sql"), "utf8");

    expect(sql).toMatch(/delete\s+from\s+public\.external_deletion_jobs\s+where\s+expires_at\s*<=\s*now\(\)/i);
    expect(sql).toMatch(/cron\.schedule\([\s\S]*form-external-deletion-job-expiry/i);
    expect(sql).not.toMatch(/status\s*=/i);
  });
});
