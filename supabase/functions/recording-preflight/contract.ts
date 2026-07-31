import {
  type VisibilityRequirements,
} from "./visibility-requirements.ts";

export const PREFLIGHT_FRAME_COUNT = 24;
export const PREFLIGHT_MAX_OUTPUT_TOKENS = 1_024;
export const PREFLIGHT_PERSPECTIVE_MAX_OUTPUT_TOKENS = 256;
export const PREFLIGHT_MEDIA_RESOLUTION = "MEDIA_RESOLUTION_LOW" as const;

const SMALL_IMAGE_TOKENS = 258;
const PROMPT_TOKEN_BUDGET = 2_200;
const PERSPECTIVE_PROMPT_TOKEN_BUDGET = 800;
const INPUT_USD_PER_MILLION_TOKENS = 0.25;
const OUTPUT_USD_PER_MILLION_TOKENS = 1.5;

export function buildRecordingPreflightAssessmentSchema(
  allowedRequirements: string[],
) {
  return {
  type: "object",
  required: [
    "activityType",
    "cameraQuality",
    "cameraLimitations",
    "movementEvidence",
    "activeMovementFrameIndices",
    "requirementEvidence",
    "guidance",
  ],
  properties: {
    activityType: { type: "string", enum: ["dynamic_reps", "static_hold", "unclear"] },
    cameraQuality: {
      type: "string",
      enum: ["sufficient", "limited", "insufficient"],
      description: "Descriptive only. The server never uses this label as an independent rejection reason.",
    },
    cameraLimitations: {
      type: "array",
      uniqueItems: true,
      maxItems: 8,
      items: {
        type: "string",
        enum: [
          "perspective_distortion",
          "distance",
          "framing",
          "lighting",
          "blur",
          "obstruction",
          "instability",
          "other",
        ],
      },
      description: "Empty when cameraQuality is sufficient. Otherwise list each limited or blocking camera-quality problem.",
    },
    movementEvidence: {
      type: "string",
      enum: ["usable_reps", "usable_hold", "insufficient"],
      description: "Usable only when the ordered frames demonstrate at least one complete repetition or sustained hold.",
    },
    activeMovementFrameIndices: {
      type: "array",
      uniqueItems: true,
      maxItems: PREFLIGHT_FRAME_COUNT,
      items: {
        type: "integer",
        minimum: 0,
        maximum: PREFLIGHT_FRAME_COUNT - 1,
      },
      description: "Zero-based indices of every supplied frame containing active exercise movement or a sustained exercise hold.",
    },
    requirementEvidence: {
      type: "array",
      minItems: allowedRequirements.length,
      maxItems: allowedRequirements.length,
      items: {
        type: "object",
        required: [
          "requirement",
          "unusableFrameIndices",
        ],
        properties: {
          requirement: { type: "string", enum: allowedRequirements },
          unusableFrameIndices: {
            type: "array",
            uniqueItems: true,
            maxItems: PREFLIGHT_FRAME_COUNT,
            items: {
              type: "integer",
              minimum: 0,
              maximum: PREFLIGHT_FRAME_COUNT - 1,
            },
            description: "Zero-based active-movement frame indices where this exact requirement cannot be judged.",
          },
        },
      },
    },
    guidance: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          required: ["phoneHeight", "phoneTilt", "distanceAction"],
          properties: {
            phoneHeight: {
              type: "string",
              enum: ["ground", "knee", "hip", "chest", "shoulder", "eye"],
            },
            phoneTilt: {
              type: "string",
              enum: ["level", "slightly_upward", "slightly_downward"],
            },
            distanceAction: {
              type: "string",
              enum: ["move_closer", "move_farther", "keep_distance"],
            },
          },
        },
      ],
    },
  },
  };
}

export const recordingPreflightAssessmentSchema = buildRecordingPreflightAssessmentSchema([
  "primary moving joints and adjoining body segments",
]);

export const PREFLIGHT_PERSPECTIVE_EVIDENCE = [
  "extreme_required_segment_scale",
  "required_range_foreshortened",
  "required_body_relationship_warped",
] as const;

export function buildRecordingPreflightPerspectiveSchema(
  allowedRequirements: string[],
) {
  return {
    type: "object",
    required: [
      "perceptionChangingRequirements",
      "visibleEvidence",
    ],
    properties: {
      perceptionChangingRequirements: {
        type: "array",
        uniqueItems: true,
        maxItems: allowedRequirements.length,
        items: {
          type: "string",
          enum: allowedRequirements,
        },
        description: "Exact required relationships materially changed by camera perspective. Empty for reliable or merely limited views.",
      },
      visibleEvidence: {
        type: "array",
        uniqueItems: true,
        maxItems: PREFLIGHT_PERSPECTIVE_EVIDENCE.length,
        items: {
          type: "string",
          enum: [...PREFLIGHT_PERSPECTIVE_EVIDENCE],
        },
        description: "Observable geometry effects supporting perceptionChangingRequirements. Empty when no required relationship is materially changed.",
      },
    },
  };
}

export function estimateRecordingPreflightCostUpperBoundUsd(): number {
  const imageTokens = PREFLIGHT_FRAME_COUNT * SMALL_IMAGE_TOKENS;
  const inputTokens = (
    imageTokens * 2
    + PROMPT_TOKEN_BUDGET
    + PERSPECTIVE_PROMPT_TOKEN_BUDGET
  );
  const outputTokens = (
    PREFLIGHT_MAX_OUTPUT_TOKENS
    + PREFLIGHT_PERSPECTIVE_MAX_OUTPUT_TOKENS
  );
  return (
    inputTokens * INPUT_USD_PER_MILLION_TOKENS
    + outputTokens * OUTPUT_USD_PER_MILLION_TOKENS
  ) / 1_000_000;
}

export function buildRecordingPreflightPerspectivePrompt(input: {
  exerciseName: string | null;
  frameTimesMs: number[];
  allowedRequirements: string[];
}): string {
  const exerciseContext = input.exerciseName
    ? `The intended exercise is ${input.exerciseName}.`
    : "The exercise was not supplied.";
  return `You are Formie's camera-geometry inspector. These ${input.frameTimesMs.length} low-resolution images are ordered samples from one exercise recording:
${input.frameTimesMs.map((timeMs, index) => `[${index}]=${timeMs}`).join(", ")}

${exerciseContext}
Required coaching relationships:
${input.allowedRequirements.map((requirement) => `- ${requirement}`).join("\n")}

Ignore technique quality. Do not evaluate whether body parts are merely visible; another check handles visibility.

Determine only whether camera perspective preserves the apparent geometry of each required relationship:
- Reliable: the relationship can be judged without a meaningful perspective-induced change.
- Limited: the angle is imperfect, but the apparent joint, segment, direction, and range relationships remain trustworthy.
- Perception-changing: the view materially changes a required relationship, so posture, direction, or range could be judged differently from a neutral view.

An upward, downward, close, far, front, rear, side, or diagonal view is not automatically bad. Inspect what it actually does to the exercise. Use perception-changing only when the ordered images unambiguously show one or more of:
- extreme_required_segment_scale: required near body segments are dramatically enlarged relative to required far body segments, changing their apparent relationship;
- required_range_foreshortened: distinct start, deepest/end, and return positions collapse along the camera viewing axis enough that the required range or direction cannot be trusted;
- required_body_relationship_warped: a required body relationship itself is visibly stretched, bent, or warped by perspective or lens distortion.

Do not assume a ground-level upward view passes. If it causes one of those effects enough to change how a required relationship appears, include that exact relationship in perceptionChangingRequirements. If it merely looks unusual while the required relationships remain trustworthy, do not include it.

Ordinary anatomical overlap, a normal side or diagonal projection, converging background lines, low image quality, and a visible up/down movement axis are not perception-changing evidence by themselves. required_range_foreshortened requires the movement endpoints themselves to be visually collapsed, not merely a camera that points upward or downward. When hips, knees, torso, and movement endpoints stay distinct enough to judge, the view is limited or reliable and must return [].

perceptionChangingRequirements must contain only exact required relationships unambiguously and materially changed by perspective. When uncertain, or when the view is merely imperfect, use []. visibleEvidence must contain only the listed effects actually visible in the required body or movement relationship and must be [] when perceptionChangingRequirements is [].`;
}

export function buildRecordingPreflightPrompt(input: {
  durationMs: number;
  exerciseName: string | null;
  frameTimesMs: number[];
  visibilityRequirements?: VisibilityRequirements;
}): string {
  const exerciseContext = input.exerciseName
    ? `The user intends to analyze: ${input.exerciseName}.`
    : "The exercise was not supplied. Infer only whether the visible activity is dynamic repetition work, a static hold, or unclear.";
  const requirements = input.visibilityRequirements;
  const allowedRequirements = requirements
    ? [
        ...requirements.bodyRegions,
        ...requirements.movementPhases,
      ]
    : ["primary moving joints and adjoining body segments"];
  const requirementList = requirements
    ? `Pass requirements (${requirements.source === "catalog" ? "server-resolved catalog metadata" : "conservatively inferred"}):
- Body relationships: ${requirements.bodyRegions.join("; ") || "none"}
- Movement evidence: ${requirements.movementPhases.join("; ")}

Optional coaching context that never blocks this recording:
- Equipment relationships: ${requirements.equipment.join("; ") || "none"}
- Support relationships: ${requirements.support.join("; ") || "none"}

The pass requirements are authoritative. Do not add new mandatory requirements. Return exactly one requirementEvidence entry for every exact pass requirement. Do not return requirementEvidence for optional coaching context.`
    : "Use only the minimum exercise-critical evidence described below.";

  return `You are Formie's recording-evidence inspector. These ${input.frameTimesMs.length} low-resolution images are ordered samples spanning one ${Math.round(input.durationMs / 100) / 10}-second exercise recording. Each image has a zero-based index and millisecond timestamp:
${input.frameTimesMs.map((timeMs, index) => `[${index}]=${timeMs}`).join(", ")}

${exerciseContext}
${requirementList}

Report observable frame evidence for the server to decide whether the recording supports accurate, exercise-specific coaching. Do not decide the outcome yourself, do not judge whether technique is good or bad, and do not invent a rejection reason.

Evaluate the exercise-critical readiness factors across the whole ordered sequence:
- the mandatory body regions, joints, equipment, bench, machine, cable, or other support needed for reliable exercise-specific advice are visible when needed;
- the complete exercise-critical movement path remains visible through most of the active set, including at least one complete repetition or sustained hold;
- camera perspective and image detail preserve the mandatory body-to-body, body-to-equipment, and support relationships;
- lighting, focus, blur, lens obstruction, and camera stability preserve enough usable detail;
- setup-only footage, an incomplete movement, or ambiguous motion is insufficient.

Return activeMovementFrameIndices containing every frame with active exercise movement or a sustained exercise hold. Return one requirementEvidence entry for every exact checklist item.
- unusableFrameIndices must contain only active frames where that exact requirement cannot be seen or judged; use [] when it is usable in every active frame.
Checklist entries are conjunctive: every named part must actually be inside the image and distinguishable. For "torso and pelvis relationship", an upper torso without the pelvis is unusable. For "hips and knees", both the hips and knees must be visible. Do not infer an off-screen joint from the visible body.
The server applies this governing visibility rule:
1. Visibility passes when each requirement's unusableFrameIndices cover fewer than half the active movement frames, meaning the affected area and movement are visible in strictly more than half.
A separate focused camera-geometry inspection decides whether perspective changes a required relationship. Do not infer failure merely from camera direction in this readiness inspection.
A recording passes only when the visibility rule passes, the separate geometry inspection passes, and movementEvidence confirms a complete repetition or sustained hold.
Do not mark a frame unusable merely because the view is imperfect. Include it only when the exact requirement is actually hidden, cropped, too small, blurred, obstructed, or distorted enough that it cannot be judged.

Mere presence of a person is not usable evidence. At the supplied 384-pixel-wide sampling resolution, mark a requirement unusable when its needed joints and adjoining segments are only a tiny silhouette and their locations or directions cannot actually be separated.
As a practical visual calibration, a required moving region spanning roughly one quarter or more of image height with distinct joint centers is large enough and must pass. A required moving region spanning less than roughly one sixth of image height, or with adjacent required joint centers only a few pixels apart, is too small to judge and must be marked unusable. Between those anchors, pass whenever the named relationships remain visibly distinct.
Apply this to unusableFrameIndices for each exact requirement. Do not convert ordinary distance, black borders, or an imperfect image into rejection when the required joints, segment directions, and movement endpoints remain distinguishable.

Classify cameraQuality as sufficient, limited, or insufficient for descriptive diagnostics. This label never rejects independently. Limited recordings pass.
Do not require perfect framing, full-body visibility, readable weight markings, or every possible support reference. A cropped non-critical region is limited or sufficient, not insufficient. For example, a squat can pass without the head or feet when the torso, hips, knees, and full descent-to-return path remain clear; omit claims about the cropped region.
When only an optional coaching dimension is unavailable, keep the recording usable and omit claims about that dimension.

Horizontal direction is never a rejection reason: front, back, side, and diagonal views are all allowed. Distance is acceptable whenever the complete movement and mandatory regions stay inside the frame and remain large and clear enough to distinguish. Do not reject merely because the whole body is not visible or the person could fill more of the frame.
Camera direction alone is not a rejection reason. A separate focused inspection evaluates whether perspective actually changes the apparent exercise geometry.
Set cameraLimitations to [] when cameraQuality is sufficient. Use one or more limitations when cameraQuality is limited or insufficient.

Set cameraQuality to insufficient only when distortion, lighting, blur, obstruction, or instability prevents a mandatory relationship from being judged reliably.
Set movementEvidence to usable_reps only for a complete observable repetition, usable_hold only for a sustained static hold, otherwise insufficient.

The server, not you, calculates visibility, missingRequirements, blocking perspective distortion, the outcome, and the user-facing reason from frame evidence. Camera side, height, distance, and cameraQuality labels alone never veto a recording.
When movementEvidence is usable and every requirement has fewer than half the active frames in unusableFrameIndices, guidance must be null.
Otherwise return structured guidance with:
- phoneHeight: the lowest practical height that preserves the checklist relationships;
- phoneTilt: level unless a slight upward or downward tilt is necessary;
- distanceAction: whether to move closer, move farther away, or keep the current distance.
The server constructs the user-facing wording from the authoritative checklist. Never request the full body, head, or feet unless those exact items appear in this checklist: ${allowedRequirements.join("; ")}.`;
}
