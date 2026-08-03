import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("saved-video reanalysis migration", () => {
  it("restores a clean v48 reanalysis state without starting v49", () => {
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
    expect(resetMigration).toContain("delete from public.model_call_telemetry");
    expect(resetMigration).not.toMatch(/pose_summary\s*=\s*null/i);
    expect(resetMigration).not.toMatch(/pose_artifact_path\s*=\s*null/i);
    expect(resetMigration).not.toMatch(/pose_manifest\s*=\s*null/i);
    expect(resetMigration).not.toMatch(/keyframe_manifest\s*=\s*'\[\]'/i);
    expect(resetMigration).not.toMatch(/exact_frame_requests\s*=\s*'\[\]'/i);
    expect(resetMigration).not.toMatch(/exact_frame_manifest\s*=\s*'\[\]'/i);
    expect(resetMigration).toMatch(/analysis_draft\s*=\s*null/i);
    expect(resetMigration).not.toMatch(/correction_audit_v1\s*=\s*null/i);
    expect(resetMigration).not.toMatch(/writer_result_v2\s*=\s*null/i);
    expect(resetMigration).toMatch(/pipeline_version\s*=\s*null/i);
    expect(resetMigration).toMatch(/gemini_file_name\s*=\s*null/i);
    expect(resetMigration).toMatch(/gemini_file_uri\s*=\s*null/i);
    expect(resetMigration).toMatch(/gemini_file_state\s*=\s*null/i);
    expect(resetMigration).toMatch(/stage\s*=\s*'input_ready'/i);
    expect(resetMigration).not.toMatch(/analysis_review_request_v1\s*=\s*null/i);
    expect(resetMigration).not.toMatch(/analysis_review_result_v1\s*=\s*null/i);
    expect(resetMigration).toMatch(/analysis_input_transport\s*=\s*null/i);
    expect(resetMigration).toMatch(/analysis_input_preparation_ms\s*=\s*null/i);
    expect(resetMigration).toMatch(/analysis_model_call_count\s*=\s*null/i);
    expect(resetMigration).toMatch(/analysis_started_at\s*=\s*null/i);
    expect(resetMigration).toMatch(/analysis_retry_count\s*=\s*0/i);
    expect(resetMigration).toMatch(/active_v49_run_id\s*=\s*null/i);
    expect(resetMigration).not.toMatch(/start_analysis_v49\(/i);
    expect(resetMigration).toMatch(/set_declaration\s*=\s*effective_declaration/i);
    expect(resetMigration).toMatch(/detected_label\s*=\s*effective_declaration\s*#>>\s*'\{exercise,label\}'/i);
    expect(resetMigration).toMatch(/recognition_confidence\s*=\s*1/i);
    expect(resetMigration).toMatch(/recognition_alternatives\s*=\s*'\[\]'/i);
    expect(resetMigration).toMatch(/target\.duration_ms\s+is\s+null/i);
    expect(resetMigration).toMatch(/target\.video_path\s+is\s+null\s+and\s+target\.analysis_video_path\s+is\s+null/i);
    expect(resetMigration).not.toMatch(/video_path\s*=\s*null/i);
    expect(resetMigration).not.toContain("delete from public.coach_threads");
  });

  it("defines the boundary-free v46 contract and durable retry diagnostics", () => {
    const migration = readFileSync(resolve(__dirname, "../../../supabase/migrations/202608020006_boundary_free_pipeline_v46.sql"), "utf8");
    expect(migration).toContain("analysis_basis");
    expect(migration).toContain("analysis_next_retry_at");
    expect(migration).toContain("analysis_last_error_code");
    expect(migration).toMatch(/stage in \('analyzing', 'finalizing'\)/);
    expect(migration).toMatch(/drop column if exists foundation_result/);
    expect(migration).toContain("configure_analysis_retry_worker");
    expect(migration).toContain("form-analysis-retry-fast");
    expect(migration).toContain("'5 seconds'");
    expect(migration).toContain("drop function if exists public.record_analysis_stage_failure");
    expect(migration).toMatch(/attempt\s*=\s*attempt\s*\+\s*1/i);
    expect(migration).not.toMatch(/least\(attempt\s*\+\s*1\s*,\s*2\)/i);
    expect(migration).toContain("Number of v46 full-video and declaration-only fallback model calls");
  });

  it("retains the historical v45 migration while restricting worker leases to its one-call stages", () => {
    const migration = readFileSync(resolve(__dirname, "../../../supabase/migrations/202608020003_single_call_pipeline_v45.sql"), "utf8");
    expect(migration).toContain("LEGACY_PIPELINE_RETIRED");
    expect(migration).toMatch(/stage in \('analyzing', 'finalizing'\)/);
    expect(migration).toMatch(/drop column if exists writer_result_v2/);
    expect(migration).toMatch(/drop column if exists analysis_contradictions/);
    expect(migration).toMatch(/drop column if exists analysis_optimization_count/);
    expect(migration).toContain("Exactly one full-video Gemini 3.6 Flash call");
  });

  it("removes the historical two-attempt lease cap for v46 retries", () => {
    const migration = readFileSync(
      resolve(__dirname, "../../../supabase/migrations/202608020007_unbounded_stage_attempts.sql"),
      "utf8",
    );
    expect(migration).toContain("drop constraint if exists analysis_stage_runs_attempt_check");
    expect(migration).toMatch(/attempt\s*>=\s*0/i);
    expect(migration).not.toMatch(/attempt\s*<=\s*2/i);
  });

  it("allows the one-upload capture-ready strategy to satisfy the session input contract", () => {
    const migrationsDirectory = resolve(__dirname, "../../../supabase/migrations");
    const migration = readFileSync(
      resolve(migrationsDirectory, "202608010001_whole_video_pipeline_v37.sql"),
      "utf8",
    );

    expect(migration).toContain("'capture_ready_video'");
    expect(migration).toMatch(/analysis_input_strategy\s+in\s*\('upright_video',\s*'capture_ready_video'\)/i);
    expect(migration).toMatch(/analysis_video_path\s+is\s+not\s+null[\s\S]*analysis_source_end_ms\s*=\s*duration_ms[\s\S]*analysis_preprocessing_confidence\s*=\s*1/i);
    expect(migration).toContain("analysis_total_duration_ms");
    expect(migration).toContain("analysis_correction_count");
    expect(migration).toContain("analysis_optimization_count");
    expect(migration).toMatch(/on\s+conflict\s*\(session_id,\s*pipeline_version,\s*stage,\s*input_checksum\)\s+do\s+nothing/i);
    expect(migration).toMatch(/lease_token\s+uuid/i);
    expect(migration).toMatch(/lease_expires_at\s+timestamptz/i);
  });
});
