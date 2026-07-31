import { create } from "zustand";

import type { CaptureEvent, CaptureState } from "./types";
import { getCaptureExerciseGuideKey } from "./exercise-guide-key";
import { captureVideoSettings } from "./video-settings";

export const initialCaptureState: CaptureState = {
  phase: "idle",
  exerciseChoice: { kind: "unselected" },
  exerciseGuide: null,
  exerciseGuideKey: null,
  countdown: null,
  startedAt: null,
  recording: null,
  recordingPreflight: null,
  declaration: null,
  uploadTarget: null,
  uploadSubstage: null,
  sessionId: null,
  previousSessionId: null,
  error: null,
};

function requirePhase(state: CaptureState, allowed: CaptureState["phase"][], action: string) {
  if (!allowed.includes(state.phase)) throw new Error(`Cannot ${action} from ${state.phase}`);
}

export function captureReducer(state: CaptureState, event: CaptureEvent): CaptureState {
  switch (event.type) {
    case "exercise_selected":
      requirePhase(state, ["idle", "recorded", "processing", "error"], "select exercise");
      const selectedChoice = { kind: "selected" as const, ...event.exercise };
      const selectedGuideKey = getCaptureExerciseGuideKey(selectedChoice);
      const selectedExerciseChanged = getCaptureExerciseGuideKey(state.exerciseChoice) !== selectedGuideKey;
      return {
        ...state,
        exerciseChoice: selectedChoice,
        exerciseGuide: state.exerciseGuideKey === selectedGuideKey ? state.exerciseGuide : null,
        exerciseGuideKey: state.exerciseGuideKey === selectedGuideKey ? state.exerciseGuideKey : null,
        recordingPreflight: selectedExerciseChanged ? null : state.recordingPreflight,
        declaration: null,
        error: null,
      };
    case "exercise_customized":
      requirePhase(state, ["idle", "recorded", "processing", "error"], "name custom exercise");
      const customChoice = { kind: "custom" as const, canonicalName: event.canonicalName.trim() };
      const customGuideKey = getCaptureExerciseGuideKey(customChoice);
      const customExerciseChanged = getCaptureExerciseGuideKey(state.exerciseChoice) !== customGuideKey;
      return {
        ...state,
        exerciseChoice: customChoice,
        exerciseGuide: state.exerciseGuideKey === customGuideKey ? state.exerciseGuide : null,
        exerciseGuideKey: state.exerciseGuideKey === customGuideKey ? state.exerciseGuideKey : null,
        recordingPreflight: customExerciseChanged ? null : state.recordingPreflight,
        declaration: null,
        error: null,
      };
    case "exercise_selection_cleared":
      requirePhase(state, ["idle", "recorded", "processing", "error"], "clear exercise selection");
      return {
        ...state,
        exerciseChoice: { kind: "unselected" },
        exerciseGuide: null,
        exerciseGuideKey: null,
        recordingPreflight: null,
        declaration: null,
        error: null,
      };
    case "exercise_guide_loaded":
      if (getCaptureExerciseGuideKey(state.exerciseChoice) !== event.key) return state;
      return { ...state, exerciseGuide: event.guide, exerciseGuideKey: event.key };
    case "begin_countdown":
      requirePhase(state, ["idle", "recorded", "processing", "error"], "begin countdown");
      if (state.exerciseChoice.kind === "unselected") {
        throw new Error("Cannot begin countdown without selecting an exercise");
      }
      return {
        ...initialCaptureState,
        exerciseChoice: state.exerciseChoice,
        exerciseGuide: state.exerciseGuide,
        exerciseGuideKey: state.exerciseGuideKey,
        phase: "countingDown",
        countdown: event.countdownSeconds ?? captureVideoSettings.countdownSeconds,
        previousSessionId: event.previousSessionId ?? null,
      };
    case "countdown_tick":
      requirePhase(state, ["countingDown"], "tick countdown");
      return { ...state, countdown: Math.max(0, (state.countdown ?? 0) - 1) };
    case "recording_started":
      requirePhase(state, ["countingDown"], "start recording");
      if (state.countdown !== 0) throw new Error("Cannot start recording before countdown finishes");
      return { ...state, phase: "recording", countdown: null, startedAt: event.startedAt, error: null };
    case "recording_finished":
      requirePhase(state, ["recording"], "finish recording");
      return {
        ...state,
        phase: "recorded",
        recording: event.recording,
        recordingPreflight: null,
        error: null,
      };
    case "recording_preflight_completed":
      requirePhase(state, ["recorded", "error"], "save recording preflight");
      return { ...state, recordingPreflight: event.result };
    case "recording_preflight_retry_requested":
      requirePhase(state, ["recorded", "error"], "retry recording preflight");
      return { ...state, recordingPreflight: null };
    case "declaration_submitted":
      requirePhase(state, ["recorded", "error"], "save declaration");
      return { ...state, phase: "recorded", declaration: event.declaration, error: null };
    case "local_reanalysis_prepared": {
      const reanalysisChoice = event.declaration.exercise.source === "catalog"
        ? {
            kind: "selected" as const,
            catalogExerciseId: event.declaration.exercise.catalogExerciseId,
            canonicalName: event.declaration.exercise.label,
            mechanics: {},
          }
        : {
            kind: "custom" as const,
            canonicalName: event.declaration.exercise.label,
          };
      const reanalysisGuideKey = getCaptureExerciseGuideKey(reanalysisChoice);
      const canReuseGuide = state.exerciseGuideKey === reanalysisGuideKey;
      return {
        ...initialCaptureState,
        phase: "recorded",
        exerciseChoice: reanalysisChoice,
        exerciseGuide: canReuseGuide ? state.exerciseGuide : null,
        exerciseGuideKey: canReuseGuide ? state.exerciseGuideKey : null,
        recording: event.recording,
        recordingPreflight: null,
        declaration: event.declaration,
        previousSessionId: event.previousSessionId,
      };
    }
    case "recording_failed":
      requirePhase(state, ["recording"], "fail recording");
      return { ...state, phase: "error", recording: null, error: event.message };
    case "upload_started":
      requirePhase(state, ["recorded"], "start upload");
      if (!state.declaration) throw new Error("Cannot start upload without a declaration");
      return { ...state, phase: "uploading", uploadSubstage: "creating_session", error: null };
    case "upload_target_created":
      requirePhase(state, ["uploading"], "save upload target");
      return { ...state, sessionId: event.target.sessionId, uploadTarget: event.target };
    case "upload_progress":
      requirePhase(state, ["uploading"], "update upload progress");
      return {
        ...state,
        uploadSubstage: event.substage,
        ...(event.target ? { sessionId: event.target.sessionId, uploadTarget: event.target } : {}),
      };
    case "upload_failed":
      requirePhase(state, ["uploading"], "fail upload");
      return { ...state, phase: "error", error: event.message };
    case "retry_upload":
      requirePhase(state, ["error"], "retry upload");
      if (!state.recording) throw new Error("Cannot retry upload without a local recording");
      return { ...state, phase: "uploading", error: null };
    case "processing":
      requirePhase(state, ["uploading"], "process analysis");
      return { ...state, phase: "processing", uploadSubstage: null, sessionId: event.sessionId, error: null };
    case "discard_recording":
      return {
        ...initialCaptureState,
        exerciseChoice: state.exerciseChoice,
        exerciseGuide: state.exerciseGuide,
        exerciseGuideKey: state.exerciseGuideKey,
        previousSessionId: state.previousSessionId,
      };
    case "reset":
      return initialCaptureState;
  }
}

type CaptureStore = CaptureState & {
  dispatch: (event: CaptureEvent) => void;
};

export const useCaptureStore = create<CaptureStore>((set) => ({
  ...initialCaptureState,
  dispatch: (event) => set((current) => ({ ...captureReducer(current, event), dispatch: current.dispatch })),
}));
