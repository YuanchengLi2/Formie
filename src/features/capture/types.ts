import type { SetDeclaration } from "@/features/analysis/set-declaration";
import type { ExerciseGuide } from "@/features/analysis/api";

export type CapturePhase =
  | "idle"
  | "countingDown"
  | "recording"
  | "recorded"
  | "uploading"
  | "processing"
  | "error";

export type RecordedSet = {
  localUri: string;
  durationMs: number;
  mimeType: string;
};

export type UploadArtifactTarget = {
  signedUrl: string;
  uploadToken: string;
  path: string;
};

export type RecordingPreflightChecks = {
  activityType: "dynamic_reps" | "static_hold" | "unclear";
  visibility: "sufficient" | "limited" | "insufficient";
  cameraQuality: "sufficient" | "limited" | "insufficient";
  cameraLimitations: (
    | "perspective_distortion"
    | "distance"
    | "framing"
    | "lighting"
    | "blur"
    | "obstruction"
    | "instability"
    | "other"
  )[];
  movementEvidence: "usable_reps" | "usable_hold" | "insufficient";
  visibilityRequirements: {
    source: "catalog" | "inferred";
    exerciseName: string | null;
    bodyRegions: string[];
    equipment: string[];
    support: string[];
    movementPhases: string[];
  };
  missingRequirements: string[];
  perspectiveDistortedRequirements: string[];
  activeMovementFrameIndices: number[];
  requirementEvidence: {
    requirement: string;
    unusableFrameIndices: number[];
    perspectiveDistortedFrameIndices: number[];
  }[];
};

export type RecordingPreflightGuidance = {
  phoneSetup: string;
  positioning: string;
  visibilityTarget: string;
};

export type RecordingPreflightResult =
  | {
      outcome: "usable" | "rerecord";
      reason: string | null;
      checks: RecordingPreflightChecks;
      guidance: RecordingPreflightGuidance | null;
    }
  | {
      outcome: "unavailable";
      reason: null;
      checks: null;
      guidance: null;
    };

export type UploadTarget = {
  sessionId: string;
  original: UploadArtifactTarget;
  analysis: UploadArtifactTarget;
  privacySafe?: UploadArtifactTarget;
};

export type UploadSubstage =
  | "creating_session"
  | "uploading_original"
  | "normalizing"
  | "uploading_analysis"
  | "finalizing";

export type UploadProgress = {
  substage: UploadSubstage;
  target: UploadTarget | null;
};

export type SelectedCaptureExercise = {
  catalogExerciseId: number;
  canonicalName: string;
  mechanics: Record<string, unknown>;
};

export type CaptureExerciseChoice =
  | { kind: "unselected" }
  | { kind: "custom"; canonicalName: string }
  | ({ kind: "selected" } & SelectedCaptureExercise);

export type CaptureState = {
  phase: CapturePhase;
  exerciseChoice: CaptureExerciseChoice;
  exerciseGuide: ExerciseGuide | null;
  exerciseGuideKey: string | null;
  countdown: number | null;
  startedAt: number | null;
  recording: RecordedSet | null;
  recordingPreflight: RecordingPreflightResult | null;
  declaration: SetDeclaration | null;
  uploadTarget: UploadTarget | null;
  uploadSubstage: UploadSubstage | null;
  sessionId: string | null;
  previousSessionId: string | null;
  error: string | null;
};

export type CaptureCountdownSeconds = 5 | 10 | 15;

export type CaptureEvent =
  | { type: "exercise_selected"; exercise: SelectedCaptureExercise }
  | { type: "exercise_customized"; canonicalName: string }
  | { type: "exercise_selection_cleared" }
  | { type: "exercise_guide_loaded"; key: string; guide: ExerciseGuide }
  | { type: "begin_countdown"; previousSessionId?: string | null; countdownSeconds?: CaptureCountdownSeconds }
  | { type: "countdown_tick" }
  | { type: "recording_started"; startedAt: number }
  | { type: "recording_finished"; recording: RecordedSet }
  | { type: "recording_preflight_completed"; result: RecordingPreflightResult }
  | { type: "recording_preflight_retry_requested" }
  | { type: "declaration_submitted"; declaration: SetDeclaration }
  | { type: "local_reanalysis_prepared"; recording: RecordedSet; declaration: SetDeclaration; previousSessionId: string }
  | { type: "recording_failed"; message: string }
  | { type: "upload_started" }
  | { type: "upload_target_created"; target: UploadTarget }
  | { type: "upload_progress"; substage: UploadSubstage; target?: UploadTarget | null }
  | { type: "upload_failed"; message: string }
  | { type: "retry_upload" }
  | { type: "processing"; sessionId: string }
  | { type: "discard_recording" }
  | { type: "reset" };
