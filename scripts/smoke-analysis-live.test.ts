import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("live analysis smoke contract", () => {
  const source = readFileSync(resolve(__dirname, "smoke-analysis-live.ts"), "utf8");

  it("verifies the deployed whole-set pipeline without removed post-analysis cards", () => {
    expect(source).toContain('storedSession.pipeline_version !== "gemini-analyst-coach-v33"');
    expect(source).toContain("wholeSetCoverage");
    expect(source).toContain('typeof movementAnalysis !== "string"');
    expect(source).toContain('["beginning", "middle", "end"]');
    expect(source).not.toContain("gemini-single-pass-coverage-v3");
    expect(source).toContain('call.stage === "repairing_analysis"');
    expect(source).not.toContain('call.stage === "understanding_movement"');
    expect(source).toContain("LIVE_SET_DECLARATION_JSON");
    expect(source).toContain("Declared exercise was renamed");
    expect(source).toContain("Correction has no valid primary evidence");
    expect(source).toContain("LIVE_EXPECT_VISIBLE_TERMS");
    expect(source).toContain("equipment_observations");
    expect(source).toContain("movementScores.length < 3");
    expect(source).toContain("new Set(movementScoreLabels).size");
    expect(source).toContain("analysis_fallback_video_path");
    expect(source).toContain("fallbackStoragePath");
    expect(source).toContain("successfulAnalystTelemetry");
    expect(source).toContain('call.stage === "checking_consistency"');
    expect(source).toContain('call.stage === "double_checking"');
    expect(source).toContain("LIVE_VERIFY_REANALYSIS");
    expect(source).toContain('runAnalysis("reanalysis")');
    expect(source).toContain("reanalyzedCorrections.length < 4");
    expect(source).toContain("coaching_cues");
    expect(source).toContain("actionTopics.length < 2");
    expect(source).toContain("Advice was presented as an observed fault");
    expect(source).toContain("This is general advice for your next set, not a mistake observed in this recording.");
    expect(source).toContain("GEMINI_PROHIBITED_CONTENT");
    expect(source).toContain("exercise_guide");
    expect(source).toContain("coaching_coverage");
    expect(source).toContain("Fresh analysis retained removed post-analysis cards");
    expect(source).toContain("exerciseGuide !== null || coachingCoverage.length > 0");
    expect(source).not.toContain('["surroundings", "equipment_setup", "grip_contact", "starting_position", "movement_execution", "support_balance"]');
  });

  it("checks a four-problem whole-lift floor without imposing a correction maximum", () => {
    expect(source).toContain("corrections.length < 4");
    expect(source).not.toContain("correctionCapacityForDuration");
    expect(source).not.toContain("corrections.length > correctionCapacity");
    expect(source).not.toContain("formCorrections");
    expect(source).not.toContain("corrections.length < 3");
    expect(source).not.toContain("fewer than three corrections");
  });
});
