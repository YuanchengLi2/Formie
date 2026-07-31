import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("single-pass analyze-video wiring", () => {
  const pipelineSource = [
    "index.ts",
    "single-pass-runner.ts",
  ].map((file) => readFileSync(resolve(__dirname, file), "utf8")).join("\n");
  const sharedSource = [
    "../_shared/single-pass-analysis.ts",
    "../_shared/gemini-generate.ts",
  ].map((file) => readFileSync(resolve(__dirname, file), "utf8")).join("\n");
  const source = [pipelineSource, sharedSource].join("\n");

  it("runs factual video analysis before a text-only writer and keeps review conditional", () => {
    expect(pipelineSource).toContain('const PIPELINE_VERSION = "gemini-analyst-coach-v36"');
    expect(pipelineSource).toContain('const ANALYST_MODEL = "gemini-3.6-flash"');
    expect(pipelineSource).toContain('const WRITER_MODEL = "gemini-3.1-flash-lite"');
    expect(pipelineSource).toContain('const REPAIR_MODEL = "gemini-3.6-flash"');
    expect(pipelineSource).toContain('REQUESTED_ANALYSIS_MEDIA_RESOLUTION');
    expect(pipelineSource).toContain('fps: REQUESTED_ANALYSIS_FPS');
    expect(pipelineSource).toContain('mediaResolution: REQUESTED_ANALYSIS_MEDIA_RESOLUTION');
    expect(pipelineSource).not.toMatch(/const ANALYSIS_FPS\s*=\s*\d+/);
    expect(pipelineSource).toContain("buildSinglePassAnalysisPrompt");
    expect(pipelineSource).toContain("buildWriterAuditPrompt");
    expect(pipelineSource).toContain("buildTargetedContradictionReviewPrompt");
    expect(pipelineSource.match(/modelName: ANALYST_MODEL/g)).toHaveLength(4);
    expect(pipelineSource.match(/modelName: WRITER_MODEL/g)).toHaveLength(2);
    expect(pipelineSource.match(/modelName: REPAIR_MODEL/g)).toHaveLength(1);
    expect(pipelineSource).toContain('stage: "repairing_analysis"');
    expect(pipelineSource).toContain('stage: "checking_consistency"');
    expect(pipelineSource).toContain("MAX_WRITER_REPAIR_ATTEMPTS = 2");
    expect(pipelineSource).toContain('stage: "double_checking"');
    expect(pipelineSource).toContain("buildTextGenerateContentRequest");
    expect(pipelineSource).toContain("analyze:");
    expect(pipelineSource).toContain("writeAndAudit:");
    expect(pipelineSource).toContain("reviewContradictions:");
    expect(pipelineSource).toContain("confirmUnable:");
    expect(pipelineSource).toContain('stage: "confirming_unable"');
    expect(pipelineSource).toContain("localizeMovement:");
    expect(pipelineSource).toContain('stage: "locating_movement"');
    expect(pipelineSource).toContain("DEDICATED TEMPORAL MOVEMENT PASS");
    expect(pipelineSource).toContain("targetedReviewWindows");
    expect(pipelineSource).toContain("COMBINED_ANALYSIS_SCHEMA");
    expect(pipelineSource).toContain("writerAuditSchema");
    expect(pipelineSource).toContain("windows,");
    expect(pipelineSource.match(/mediaResolution: REQUESTED_ANALYSIS_MEDIA_RESOLUTION/g)).toHaveLength(5);
  });

  it("rewatches the full video for validation repair and unable confirmation", () => {
    expect(pipelineSource).toContain("Rewatch the complete original video");
    expect(pipelineSource).not.toContain("without reanalyzing the video");
    expect(pipelineSource.match(/buildVideoGenerateContentRequest/g)).toHaveLength(6);
    expect(pipelineSource.match(/mediaResolution: REQUESTED_ANALYSIS_MEDIA_RESOLUTION/g)).toHaveLength(5);
  });

  it("preserves the concrete validation issue for repair and production diagnostics", () => {
    expect(pipelineSource).toContain("validationIssue");
    expect(pipelineSource).toContain("validationError.message");
    expect(pipelineSource).not.toContain('new Error("Analysis response validation failed")');
  });

  it("uploads exactly one selected video to Gemini", () => {
    expect(pipelineSource).toContain("const inputPath = selectGeminiVideoPath(session)");
    expect(pipelineSource.match(/files\.uploadVideo/g)).toHaveLength(1);
  });

  it("records storage deletion without leaving retryable ghost paths", () => {
    expect(pipelineSource).toContain("const releasedVideoState =");
    expect(pipelineSource).toMatch(/video_path:\s*null/);
    expect(pipelineSource).toMatch(/analysis_video_path:\s*null/);
    expect(pipelineSource).toMatch(/analysis_input_strategy:\s*\"video\"/);
    expect(pipelineSource).toMatch(/analysis_duration_ms:\s*null/);
    expect(pipelineSource).toMatch(/analysis_preprocessing_confidence:\s*null/);
    expect(pipelineSource).toMatch(/analysis_input_variant:\s*\"primary\"/);
    expect(pipelineSource).toContain("update(releasedVideoState)");
  });

  it("publishes through the atomic result transaction", () => {
    expect(pipelineSource).toContain('admin.rpc("commit_analysis_result_v2"');
    expect(pipelineSource).not.toContain('.from("analysis_results").upsert');
  });

  it("contains no catalog, rubric, verifier, pose, or exact-frame decision path", () => {
    expect(source).not.toMatch(/exercise_criteria_v2|exercise_variants_v2|criteria-pipeline|catalogCandidates|resolveRubric|verifyFinding|verifyCriteria|pose_summary|requestDisplayFrames/);
  });
});
