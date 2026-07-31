import {
  REQUESTED_ANALYSIS_FPS,
  REQUESTED_ANALYSIS_MEDIA_RESOLUTION,
} from "../supabase/functions/_shared/analysis-settings.ts";
import type {
  MediaResolution,
  ThinkingLevel,
} from "../supabase/functions/_shared/gemini-generate.ts";

export type RegressionProfile = {
  analystModel: string;
  requestedFps: number;
  mediaResolution: MediaResolution;
  analystThinking: ThinkingLevel;
  writerModel: string;
  writerThinking: ThinkingLevel;
};

const mediaResolutions: readonly MediaResolution[] = [
  "MEDIA_RESOLUTION_LOW",
  "MEDIA_RESOLUTION_MEDIUM",
  "MEDIA_RESOLUTION_HIGH",
];
const thinkingLevels: readonly ThinkingLevel[] = ["minimal", "low", "medium", "high"];

function choice<T extends string>(value: string | undefined, fallback: T, allowed: readonly T[], label: string): T {
  const selected = value ?? fallback;
  if (!allowed.includes(selected as T)) throw new Error(`${label} is invalid: ${selected}`);
  return selected as T;
}

export function resolveRegressionProfile(environment: Record<string, string | undefined>): RegressionProfile {
  const requestedFps = Number(environment.REGRESSION_ANALYSIS_FPS ?? REQUESTED_ANALYSIS_FPS);
  if (!Number.isFinite(requestedFps) || requestedFps <= 0 || requestedFps > 24) {
    throw new Error(`REGRESSION_ANALYSIS_FPS must be between 0 and 24: ${requestedFps}`);
  }

  return {
    analystModel: environment.REGRESSION_ANALYST_MODEL?.trim() || "gemini-3.6-flash",
    requestedFps,
    mediaResolution: choice(
      environment.REGRESSION_MEDIA_RESOLUTION,
      REQUESTED_ANALYSIS_MEDIA_RESOLUTION,
      mediaResolutions,
      "REGRESSION_MEDIA_RESOLUTION",
    ),
    analystThinking: choice(
      environment.REGRESSION_ANALYST_THINKING,
      "high",
      thinkingLevels,
      "REGRESSION_ANALYST_THINKING",
    ),
    writerModel: environment.REGRESSION_WRITER_MODEL?.trim() || "gemini-3.1-flash-lite",
    writerThinking: choice(
      environment.REGRESSION_WRITER_THINKING,
      "medium",
      thinkingLevels,
      "REGRESSION_WRITER_THINKING",
    ),
  };
}
