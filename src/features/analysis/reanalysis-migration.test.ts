import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("saved-video reanalysis migration", () => {
  it("does not reference worker tables removed by the Gemini-only migration", () => {
    const migrationsDirectory = resolve(__dirname, "../../../supabase/migrations");
    const resetMigration = readdirSync(migrationsDirectory)
      .sort()
      .reverse()
      .map((file) => readFileSync(resolve(migrationsDirectory, file), "utf8"))
      .find((sql) => sql.includes("create or replace function public.reset_analysis_for_reanalysis"));

    expect(resetMigration).toBeDefined();
    expect(resetMigration).not.toContain("public.pose_artifacts");
    expect(resetMigration).not.toContain("public.analysis_jobs");
    expect(resetMigration).toContain("delete from public.analysis_results");
    expect(resetMigration).not.toMatch(/pose_summary\s*=\s*null/i);
    expect(resetMigration).not.toMatch(/pose_artifact_path\s*=\s*null/i);
    expect(resetMigration).not.toMatch(/pose_manifest\s*=\s*null/i);
    expect(resetMigration).not.toMatch(/keyframe_manifest\s*=\s*'\[\]'/i);
    expect(resetMigration).toMatch(/exact_frame_requests\s*=\s*'\[\]'/i);
    expect(resetMigration).toMatch(/exact_frame_manifest\s*=\s*'\[\]'/i);
    expect(resetMigration).toMatch(/analysis_draft\s*=\s*null/i);
    expect(resetMigration).toMatch(/correction_audit_v1\s*=\s*null/i);
    expect(resetMigration).toMatch(/writer_result_v2\s*=\s*null/i);
    expect(resetMigration).toMatch(/pipeline_version\s*=\s*null/i);
    expect(resetMigration).toMatch(/stage_attempts_v3\s*=\s*'\{\}'/i);
    expect(resetMigration).not.toMatch(/analysis_input_variant\s*=\s*'primary'/i);
    expect(resetMigration).toMatch(/set_declaration\s*=\s*effective_declaration/i);
    expect(resetMigration).toMatch(/detected_label\s*=\s*effective_declaration\s*#>>\s*'\{exercise,label\}'/i);
    expect(resetMigration).toMatch(/recognition_confidence\s*=\s*1/i);
    expect(resetMigration).toMatch(/recognition_alternatives\s*=\s*'\[\]'/i);
    expect(resetMigration).toMatch(
      /target\.duration_ms\s+is\s+null\s+or\s+\(\s*target\.video_path\s+is\s+null\s+and\s+target\.gemini_file_name\s+is\s+null\s*\)/i,
    );
    expect(resetMigration).not.toMatch(/gemini_file_name\s*=\s*null/i);
    expect(resetMigration).not.toMatch(/gemini_file_uri\s*=\s*null/i);
    expect(resetMigration).not.toMatch(/gemini_file_state\s*=\s*null/i);
    expect(resetMigration).not.toMatch(/video_path\s*=\s*null/i);
    expect(resetMigration).not.toContain("delete from public.coach_threads");
  });
});
