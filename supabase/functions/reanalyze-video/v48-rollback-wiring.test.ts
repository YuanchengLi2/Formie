import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("v48 rollback wiring", () => {
  it("keeps upload and reanalysis entry points independent of v49", () => {
    const completeUpload = readFileSync(resolve(__dirname, "../complete-upload/index.ts"), "utf8");
    const reanalysis = readFileSync(resolve(__dirname, "index.ts"), "utf8");
    const analyzer = readFileSync(resolve(__dirname, "../analyze-video/index.ts"), "utf8");
    const rerunScript = readFileSync(resolve(__dirname, "../../../scripts/rerun-failed-analyses.ts"), "utf8");

    expect(completeUpload).not.toContain("start_analysis_v49");
    expect(completeUpload).not.toContain("v49-primary-rollout");
    expect(reanalysis).not.toContain("V49_PRIMARY");
    expect(reanalysis).not.toContain("v49-primary-rollout");
    expect(analyzer).toContain('const PIPELINE_VERSION = "gemini-whole-video-v63-three-sentence-what-happened"');
    expect(analyzer).not.toContain('from "./short-clip-recheck.ts"');
    expect(analyzer).not.toContain("runShortClipRechecks");
    expect(analyzer).not.toContain("buildBoundaryFreeRecheckPrompt");
    expect(analyzer).not.toContain("analysis_recheck_${recheckNumber}");
    expect(rerunScript).toContain('postFunction("analyze-video", accessToken');
    expect(rerunScript).not.toContain('postFunction("analyze-video-v49"');
  });

  it("has an append-only rollback migration that restores the legacy reset RPC", () => {
    const migrationPath = resolve(__dirname, "../../migrations/202608030003_restore_v48_primary_pipeline.sql");
    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("create or replace function public.reset_analysis_for_reanalysis");
    expect(migration).toContain("pipeline_version = null");
    expect(migration).toContain("active_v49_run_id = null");
    expect(migration).not.toContain("start_analysis_v49(");
  });
});
