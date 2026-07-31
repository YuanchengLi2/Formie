import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { resolveRegressionProfile } from "./regression-profile";

describe("resolveRegressionProfile", () => {
  it("keeps the production-quality defaults when no experiment overrides are supplied", () => {
    expect(resolveRegressionProfile({})).toEqual({
      analystModel: "gemini-3.6-flash",
      requestedFps: 12,
      mediaResolution: "MEDIA_RESOLUTION_HIGH",
      analystThinking: "high",
      writerModel: "gemini-3.1-flash-lite",
      writerThinking: "medium",
    });
  });

  it("applies a complete regression-only cost profile", () => {
    expect(resolveRegressionProfile({
      REGRESSION_ANALYST_MODEL: "gemini-3.5-flash-lite",
      REGRESSION_ANALYSIS_FPS: "6",
      REGRESSION_MEDIA_RESOLUTION: "MEDIA_RESOLUTION_MEDIUM",
      REGRESSION_ANALYST_THINKING: "medium",
    })).toEqual({
      analystModel: "gemini-3.5-flash-lite",
      requestedFps: 6,
      mediaResolution: "MEDIA_RESOLUTION_MEDIUM",
      analystThinking: "medium",
      writerModel: "gemini-3.1-flash-lite",
      writerThinking: "medium",
    });
  });

  it("runs the same analyst-then-coach flow as production", () => {
    const source = readFileSync(resolve(__dirname, "run-single-pass-regression.ts"), "utf8");
    expect(source).not.toContain("MOVEMENT_RECOGNITION_SCHEMA");
    expect(source).not.toContain("buildMovementRecognitionPrompt");
    expect(source).not.toContain("parseMovementRecognition");
    expect(source).toContain("writerAuditSchema");
    expect(source).toContain("buildWriterAuditPrompt");
    expect(source).toContain("buildTargetedContradictionReviewPrompt");
    expect(source).toContain("targetedReviewWindows");
    expect(source).toContain("buildTextGenerateContentRequest");
    expect(source).toContain("writerModel");
    expect(source).toContain("writerUsage");
    expect(source).toContain("writerRepairUsage");
    expect(source).toContain("The previous writer-audit JSON was rejected");
    expect(source).toContain("MAX_WRITER_REPAIR_ATTEMPTS = 2");
  });
});
