import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("live v49 isolated-pipeline smoke contract", () => {
  const source = readFileSync(resolve(__dirname, "smoke-analysis-live.ts"), "utf8");

  it("invokes only the v49 producer and reads only v49 run storage", () => {
    expect(source).toContain('/functions/v1/analyze-video-v49');
    expect(source).toContain('PIPELINE_VERSION = "gemini-problem-finder-v49"');
    expect(source).toContain('from("analysis_v49_runs")');
    expect(source).toContain('from("analysis_v49_stage_runs")');
    expect(source).not.toMatch(/functions\/v1\/analyze-video["`]/);
    expect(source).not.toContain('from("analysis_stage_runs")');
  });

  it("checks immutable evidence, strict client parsing, and exact model-call counts", () => {
    expect(source).toContain("Problem evidence was separated or lost");
    expect(source).toContain("analysisResultSchema.parse");
    expect(source).toContain("problemCalls.length !== 1");
    expect(source).toContain("writerCalls.length !== 1");
    expect(source).toContain("Unable run fabricated writer output");
  });

  it("checks concurrent entry and saved-video reanalysis through a new run ID", () => {
    expect(source).toContain("LIVE_CONCURRENT_START");
    expect(source).toContain('/functions/v1/reanalyze-video');
    expect(source).toContain("active_v49_run_id === firstRunId");
  });

  it("invokes the active primary run without exposing a caller-selected run ID", () => {
    expect(source).toContain("body: JSON.stringify({ sessionId })");
    expect(source).not.toContain("body: JSON.stringify({ sessionId, runId })");
  });

  it("creates a capture-ready fixture that satisfies the production preprocessing constraint", () => {
    expect(source).toContain('analysis_input_strategy: "capture_ready_video"');
    expect(source).toContain("analysis_preprocessing_confidence: 1");
    expect(source).toContain('p_user_id: userId');
  });
});
