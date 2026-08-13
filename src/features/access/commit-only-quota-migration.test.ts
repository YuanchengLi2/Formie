import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("commit-only analysis quota", () => {
  const migration = readFileSync(
    resolve(__dirname, "../../../supabase/migrations/202608120002_commit_only_analysis_quota.sql"),
    "utf8",
  );

  it("blocks a pending session without counting its reservation as consumed usage", () => {
    expect(migration).toMatch(/session\.status in \('created', 'uploading', 'queued', 'processing'\)[\s\S]{0,160}reservation\.status = 'reserved'/i);
    expect(migration).toMatch(/select count\(\*\)::integer into actual_used[\s\S]{0,500}reservation\.status = 'committed'/i);
    expect(migration).not.toMatch(/select count\(\*\)::integer into actual_used[\s\S]{0,500}reservation\.status = 'reserved'/i);
  });
});
