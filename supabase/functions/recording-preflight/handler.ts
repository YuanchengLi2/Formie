import {
  PREFLIGHT_FRAME_COUNT,
  PREFLIGHT_PERSPECTIVE_EVIDENCE,
} from "./contract.ts";
import {
  flattenBlockingVisibilityRequirements,
  type VisibilityRequirements,
} from "./visibility-requirements.ts";
import {
  MAX_ANALYSIS_VIDEO_DURATION_MS,
  MIN_ANALYSIS_VIDEO_DURATION_MS,
} from "../_shared/analysis-settings.ts";

export type RecordingPreflightFrame = {
  timeMs: number;
  mimeType: "image/jpeg";
  data: string;
};

export type RecordingPreflightChecks = {
  activityType: "dynamic_reps" | "static_hold" | "unclear";
  visibility: "sufficient" | "limited" | "insufficient";
  cameraQuality: "sufficient" | "limited" | "insufficient";
  cameraLimitations: CameraLimitation[];
  movementEvidence: "usable_reps" | "usable_hold" | "insufficient";
  visibilityRequirements: VisibilityRequirements;
  missingRequirements: string[];
  perspectiveDistortedRequirements: string[];
  activeMovementFrameIndices: number[];
  requirementEvidence: RecordingPreflightRequirementEvidence[];
};

export const CAMERA_LIMITATIONS = [
  "perspective_distortion",
  "distance",
  "framing",
  "lighting",
  "blur",
  "obstruction",
  "instability",
  "other",
] as const;

export type CameraLimitation = typeof CAMERA_LIMITATIONS[number];

export type RecordingPreflightRequirementEvidence = {
  requirement: string;
  unusableFrameIndices: number[];
  perspectiveDistortedFrameIndices: number[];
};

type PerspectiveEvidence = typeof PREFLIGHT_PERSPECTIVE_EVIDENCE[number];

type RecordingPreflightPerspectiveAssessment = {
  perceptionChangingRequirements: string[];
  visibleEvidence: PerspectiveEvidence[];
};

export type RecordingPreflightGuidance = {
  phoneSetup: string;
  positioning: string;
  visibilityTarget: string;
};

type ModelRecordingPreflightGuidance = {
  phoneHeight: "ground" | "knee" | "hip" | "chest" | "shoulder" | "eye";
  phoneTilt: "level" | "slightly_upward" | "slightly_downward";
  distanceAction: "move_closer" | "move_farther" | "keep_distance";
};

export type RecordingPreflightAssessment = RecordingPreflightChecks & {
  reason: string | null;
  guidance: RecordingPreflightGuidance | null;
};

export type RecordingPreflightDecision = {
  outcome: "usable";
  reason: string | null;
  checks: RecordingPreflightChecks;
  guidance: RecordingPreflightGuidance | null;
};

export type RecordingPreflightInput = {
  frames: RecordingPreflightFrame[];
  durationMs: number;
  exerciseName: string | null;
  catalogExerciseId: number | null;
  visibilityRequirements: VisibilityRequirements;
};

export type RecordingPreflightDependencies = {
  authenticate: (request: Request) => Promise<string>;
  resolveVisibilityRequirements: (input: {
    exerciseName: string | null;
    catalogExerciseId: number | null;
  }) => Promise<VisibilityRequirements>;
  inspectFrames: (input: RecordingPreflightInput) => Promise<unknown>;
  recordDecision?: (input: {
    userId: string;
    durationMs: number;
    exerciseName: string | null;
    catalogExerciseId: number | null;
    decision: RecordingPreflightDecision;
  }) => Promise<void>;
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function validFrame(value: unknown): value is RecordingPreflightFrame {
  if (!value || typeof value !== "object") return false;
  const frame = value as Record<string, unknown>;
  return Number.isInteger(frame.timeMs)
    && Number(frame.timeMs) >= 0
    && frame.mimeType === "image/jpeg"
    && typeof frame.data === "string"
    && frame.data.length >= 100
    && frame.data.length <= 350_000
    && /^[A-Za-z0-9+/=]+$/.test(frame.data);
}

function formatRequirementList(requirements: string[]): string {
  if (requirements.length === 1) return requirements[0];
  if (requirements.length === 2) return `${requirements[0]} and ${requirements[1]}`;
  return `${requirements.slice(0, -1).join(", ")}, and ${requirements.at(-1)}`;
}

function renderGuidance(
  guidance: ModelRecordingPreflightGuidance,
  visibilityRequirements: VisibilityRequirements,
  missingRequirements: string[],
): RecordingPreflightGuidance {
  const target = formatRequirementList(
    missingRequirements.length > 0
      ? missingRequirements
      : flattenBlockingVisibilityRequirements(visibilityRequirements),
  );
  const phoneHeight = guidance.phoneHeight === "ground"
    ? "on the ground"
    : `around ${guidance.phoneHeight} height`;
  const phoneTilt = guidance.phoneTilt === "level"
    ? "level"
    : guidance.phoneTilt === "slightly_upward"
      ? "slightly upward"
      : "slightly downward";
  const positioning = guidance.distanceAction === "move_closer"
    ? "Move closer until the required movement is large enough to judge clearly without cropping it."
    : guidance.distanceAction === "move_farther"
      ? "Move farther away until the required movement stays inside the frame."
      : "Keep your current distance.";
  return {
    phoneSetup: `Place the phone ${phoneHeight} and point it ${phoneTilt} at the center of the movement.`,
    positioning,
    visibilityTarget: `Keep ${target} visible and clear.`,
  };
}

function parseFrameIndices(value: unknown): number[] {
  if (
    !Array.isArray(value)
    || value.some((item) =>
      !Number.isInteger(item)
      || Number(item) < 0
      || Number(item) >= PREFLIGHT_FRAME_COUNT
    )
    || new Set(value).size !== value.length
  ) throw new Error("INVALID_PREFLIGHT");
  return [...value as number[]].sort((left, right) => left - right);
}

function requirementEvidenceFromModel(
  value: unknown,
  allowedRequirements: string[],
): RecordingPreflightRequirementEvidence[] {
  if (!Array.isArray(value) || value.length !== allowedRequirements.length) {
    throw new Error("INVALID_PREFLIGHT");
  }
  const byRequirement = new Map<string, number[]>();
  for (const item of value) {
    if (!item || typeof item !== "object") throw new Error("INVALID_PREFLIGHT");
    const evidence = item as Record<string, unknown>;
    if (
      typeof evidence.requirement !== "string"
      || !allowedRequirements.includes(evidence.requirement)
      || byRequirement.has(evidence.requirement)
    ) throw new Error("INVALID_PREFLIGHT");
    byRequirement.set(evidence.requirement, parseFrameIndices(evidence.unusableFrameIndices));
    const perspectiveDistortedFrameIndices = parseFrameIndices(
      evidence.perspectiveDistortedFrameIndices ?? [],
    );
    byRequirement.set(`${evidence.requirement}\u0000perspective`, perspectiveDistortedFrameIndices);
  }
  return allowedRequirements.map((requirement) => ({
    requirement,
    unusableFrameIndices: byRequirement.get(requirement) ?? [],
    perspectiveDistortedFrameIndices:
      byRequirement.get(`${requirement}\u0000perspective`) ?? [],
  }));
}

function perspectiveAssessmentFromModel(
  value: unknown,
  allowedRequirements: string[],
): RecordingPreflightPerspectiveAssessment {
  if (!value || typeof value !== "object") throw new Error("INVALID_PREFLIGHT");
  const assessment = value as Record<string, unknown>;
  if (
    !Array.isArray(assessment.perceptionChangingRequirements)
    || assessment.perceptionChangingRequirements.some((requirement) =>
      typeof requirement !== "string" || !allowedRequirements.includes(requirement)
    )
    || new Set(assessment.perceptionChangingRequirements).size
      !== assessment.perceptionChangingRequirements.length
    || !Array.isArray(assessment.visibleEvidence)
    || assessment.visibleEvidence.some((evidence) =>
      !PREFLIGHT_PERSPECTIVE_EVIDENCE.includes(evidence as PerspectiveEvidence)
    )
    || new Set(assessment.visibleEvidence).size !== assessment.visibleEvidence.length
    || (
      assessment.perceptionChangingRequirements.length === 0
      && assessment.visibleEvidence.length > 0
    )
    || (
      assessment.perceptionChangingRequirements.length > 0
      && assessment.visibleEvidence.length === 0
    )
  ) throw new Error("INVALID_PREFLIGHT");
  return {
    perceptionChangingRequirements:
      assessment.perceptionChangingRequirements as string[],
    visibleEvidence: assessment.visibleEvidence as PerspectiveEvidence[],
  };
}

function visibleThroughMostActiveMovement(
  unusableFrameIndices: number[],
  activeMovementFrameIndices: number[],
): boolean {
  if (activeMovementFrameIndices.length === 0) return false;
  const unusable = new Set(unusableFrameIndices);
  const unusableActiveFrameCount = activeMovementFrameIndices.reduce(
    (count, frameIndex) => count + (unusable.has(frameIndex) ? 1 : 0),
    0,
  );
  return unusableActiveFrameCount < activeMovementFrameIndices.length / 2;
}

export function parseRecordingPreflightAssessment(
  value: unknown,
  visibilityRequirements: VisibilityRequirements,
): RecordingPreflightAssessment {
  if (!value || typeof value !== "object") throw new Error("INVALID_PREFLIGHT");
  const assessment = value as Record<string, unknown>;
  if (
    assessment.activityType !== "dynamic_reps"
    && assessment.activityType !== "static_hold"
    && assessment.activityType !== "unclear"
  ) throw new Error("INVALID_PREFLIGHT");
  const allowedRequirements = flattenBlockingVisibilityRequirements(visibilityRequirements);
  const activeMovementFrameIndices = parseFrameIndices(assessment.activeMovementFrameIndices);
  const perspectiveAssessment = perspectiveAssessmentFromModel(
    assessment.perspectiveAssessment,
    allowedRequirements,
  );
  const perspectiveDistortedRequirements =
    perspectiveAssessment.perceptionChangingRequirements;
  const perspectiveDistortedRequirementSet = new Set(
    perspectiveDistortedRequirements,
  );
  const modelRequirementEvidence = requirementEvidenceFromModel(
    assessment.requirementEvidence,
    allowedRequirements,
  );
  const activeFrameSet = new Set(activeMovementFrameIndices);
  const requirementEvidence = modelRequirementEvidence.map((evidence) => ({
    ...evidence,
    unusableFrameIndices: evidence.unusableFrameIndices.filter((frameIndex) =>
      activeFrameSet.has(frameIndex)
    ),
    perspectiveDistortedFrameIndices:
      perspectiveDistortedRequirementSet.has(evidence.requirement)
        ? [...activeMovementFrameIndices]
        : [],
  }));
  const missingRequirements = activeMovementFrameIndices.length === 0
    ? []
    : requirementEvidence
      .filter((evidence) =>
        !visibleThroughMostActiveMovement(
          evidence.unusableFrameIndices,
          activeMovementFrameIndices,
        )
      )
      .map((evidence) => evidence.requirement);
  const allRequirementsVisibleThroughout = activeMovementFrameIndices.length > 0
    && requirementEvidence.every((evidence) => evidence.unusableFrameIndices.length === 0);
  const visibility = missingRequirements.length > 0
    ? "insufficient"
    : allRequirementsVisibleThroughout
      ? "sufficient"
      : "limited";
  if (
    assessment.cameraQuality !== "sufficient"
    && assessment.cameraQuality !== "limited"
    && assessment.cameraQuality !== "insufficient"
  ) {
    throw new Error("INVALID_PREFLIGHT");
  }
  if (
    !Array.isArray(assessment.cameraLimitations)
    || assessment.cameraLimitations.some((item) => !CAMERA_LIMITATIONS.includes(item as CameraLimitation))
    || new Set(assessment.cameraLimitations).size !== assessment.cameraLimitations.length
  ) throw new Error("INVALID_PREFLIGHT");
  if (
    assessment.movementEvidence !== "usable_reps"
    && assessment.movementEvidence !== "usable_hold"
    && assessment.movementEvidence !== "insufficient"
  ) throw new Error("INVALID_PREFLIGHT");
  if (
    (assessment.movementEvidence === "usable_reps" && assessment.activityType !== "dynamic_reps")
    || (assessment.movementEvidence === "usable_hold" && assessment.activityType !== "static_hold")
    || (
      (assessment.movementEvidence === "usable_reps" || assessment.movementEvidence === "usable_hold")
      && activeMovementFrameIndices.length < 3
    )
  ) throw new Error("INVALID_PREFLIGHT");

  const guidanceValue = assessment.guidance && typeof assessment.guidance === "object"
    ? assessment.guidance as Record<string, unknown>
    : null;
  const guidance = guidanceValue
    ? {
        phoneHeight: guidanceValue.phoneHeight,
        phoneTilt: guidanceValue.phoneTilt,
        distanceAction: guidanceValue.distanceAction,
      }
    : null;
  const usableMovement = (
    assessment.activityType === "dynamic_reps"
    && assessment.movementEvidence === "usable_reps"
  ) || (
    assessment.activityType === "static_hold"
    && assessment.movementEvidence === "usable_hold"
  );
  const usable = missingRequirements.length === 0
    && perspectiveDistortedRequirements.length === 0
    && usableMovement;
  const guidanceIsValid = guidance
    && ["ground", "knee", "hip", "chest", "shoulder", "eye"].includes(String(guidance.phoneHeight))
    && ["level", "slightly_upward", "slightly_downward"].includes(String(guidance.phoneTilt))
    && ["move_closer", "move_farther", "keep_distance"].includes(String(guidance.distanceAction));
  const normalizedGuidance = guidanceIsValid
    ? guidance as ModelRecordingPreflightGuidance
    : {
        phoneHeight: "hip" as const,
        phoneTilt: "level" as const,
        distanceAction: missingRequirements.length > 0 ? "move_farther" as const : "keep_distance" as const,
      };
  const cameraLimitations = [
    ...(assessment.cameraLimitations as CameraLimitation[]),
    ...(perspectiveDistortedRequirements.length > 0
      && !assessment.cameraLimitations.includes("perspective_distortion")
      ? ["perspective_distortion" as const]
      : []),
  ];
  const cameraQuality = perspectiveDistortedRequirements.length > 0
    ? "insufficient" as const
    : cameraLimitations.length === 0
      ? "sufficient" as const
      : "limited" as const;
  const reason = missingRequirements.length > 0
    ? `The quick check saw limited visibility for ${formatRequirementList(missingRequirements)}; full-video coaching will use every supported detail.`
    : perspectiveDistortedRequirements.length > 0
      ? `The camera angle may limit some perspective-sensitive claims about ${formatRequirementList(perspectiveDistortedRequirements)}; full-video coaching will continue with supported observations.`
      : usableMovement
        ? null
        : assessment.activityType === "static_hold"
        ? "The quick check saw limited hold evidence; full-video coaching will still review the recording."
        : "The quick check saw limited repetition evidence; full-video coaching will still review the recording.";

  return {
    activityType: assessment.activityType,
    visibility,
    cameraQuality,
    cameraLimitations,
    movementEvidence: assessment.movementEvidence,
    visibilityRequirements,
    missingRequirements,
    perspectiveDistortedRequirements,
    activeMovementFrameIndices,
    requirementEvidence,
    reason,
    guidance: usable
      ? null
      : renderGuidance(
          normalizedGuidance,
          visibilityRequirements,
          missingRequirements,
        ),
  };
}

export function deriveRecordingPreflightDecision(
  assessment: RecordingPreflightAssessment,
): RecordingPreflightDecision {
  const usable = assessment.visibility !== "insufficient"
    && assessment.cameraQuality !== "insufficient"
    && (
      (assessment.activityType === "dynamic_reps" && assessment.movementEvidence === "usable_reps")
      || (assessment.activityType === "static_hold" && assessment.movementEvidence === "usable_hold")
    );
  return {
    // Preflight is advisory only. The uploaded video must still reach the
    // complete-video analyst so imperfect framing can produce useful coaching.
    outcome: "usable",
    reason: assessment.reason,
    checks: {
      activityType: assessment.activityType,
      visibility: assessment.visibility,
      cameraQuality: assessment.cameraQuality,
      cameraLimitations: assessment.cameraLimitations,
      movementEvidence: assessment.movementEvidence,
      visibilityRequirements: assessment.visibilityRequirements,
      missingRequirements: assessment.missingRequirements,
      perspectiveDistortedRequirements: assessment.perspectiveDistortedRequirements,
      activeMovementFrameIndices: assessment.activeMovementFrameIndices,
      requirementEvidence: assessment.requirementEvidence,
    },
    guidance: usable ? null : assessment.guidance,
  };
}

export async function recordingPreflightHandler(
  request: Request,
  dependencies: RecordingPreflightDependencies,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ message: "Recording check input is required", code: "INVALID_BODY" }, 400);
  }
  const frames = body.frames;
  if (!Array.isArray(frames) || frames.length !== PREFLIGHT_FRAME_COUNT || !frames.every(validFrame)) {
    return json({ message: `${PREFLIGHT_FRAME_COUNT} valid recording frames are required`, code: "INVALID_BODY" }, 400);
  }
  if (!Number.isInteger(body.durationMs) || Number(body.durationMs) < MIN_ANALYSIS_VIDEO_DURATION_MS || Number(body.durationMs) > MAX_ANALYSIS_VIDEO_DURATION_MS) {
    return json({ message: "Recording duration must be between 3 and 15 seconds", code: "INVALID_BODY" }, 400);
  }
  const rawExerciseName = body.exerciseName;
  if (
    rawExerciseName !== undefined
    && rawExerciseName !== null
    && (
      typeof rawExerciseName !== "string"
      || rawExerciseName.trim().length < 2
      || rawExerciseName.trim().length > 120
    )
  ) {
    return json({ message: "Exercise name is invalid", code: "INVALID_BODY" }, 400);
  }
  const rawCatalogExerciseId = body.catalogExerciseId;
  if (
    rawCatalogExerciseId !== undefined
    && rawCatalogExerciseId !== null
    && (!Number.isSafeInteger(rawCatalogExerciseId) || Number(rawCatalogExerciseId) <= 0)
  ) {
    return json({ message: "Catalog exercise ID is invalid", code: "INVALID_BODY" }, 400);
  }
  for (let index = 1; index < frames.length; index += 1) {
    if (frames[index].timeMs <= frames[index - 1].timeMs) {
      return json({ message: "Recording frames must be ordered", code: "INVALID_BODY" }, 400);
    }
  }

  try {
    const userId = await dependencies.authenticate(request);
    const exerciseName = typeof rawExerciseName === "string" ? rawExerciseName.trim() : null;
    const catalogExerciseId = typeof rawCatalogExerciseId === "number" ? rawCatalogExerciseId : null;
    const visibilityRequirements = await dependencies.resolveVisibilityRequirements({
      exerciseName,
      catalogExerciseId,
    });
    const input: RecordingPreflightInput = {
      frames,
      durationMs: Number(body.durationMs),
      exerciseName,
      catalogExerciseId,
      visibilityRequirements,
    };
    const assessment = parseRecordingPreflightAssessment(
      await dependencies.inspectFrames(input),
      visibilityRequirements,
    );
    const decision = deriveRecordingPreflightDecision(assessment);
    await dependencies.recordDecision?.({
      userId,
      durationMs: input.durationMs,
      exerciseName: input.exerciseName,
      catalogExerciseId: input.catalogExerciseId,
      decision,
    }).catch(() => undefined);
    return json(decision);
  } catch (error) {
    const eligibility = aiEligibilityErrorResponse(error);
    if (eligibility) return eligibility;
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    }
    return json({ message: "The quick recording check is temporarily unavailable", code: "PREFLIGHT_FAILED" }, 502);
  }
}
import { aiEligibilityErrorResponse } from "../_shared/ai-eligibility.ts";
