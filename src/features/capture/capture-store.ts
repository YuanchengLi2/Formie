import { create } from "zustand";

import type { CaptureEvent, CaptureState } from "./types";

export const initialCaptureState: CaptureState = {
  phase: "idle",
  countdown: null,
  startedAt: null,
  recording: null,
  uploadTarget: null,
  sessionId: null,
  previousSessionId: null,
  error: null,
};

function requirePhase(state: CaptureState, allowed: CaptureState["phase"][], action: string) {
  if (!allowed.includes(state.phase)) throw new Error(`Cannot ${action} from ${state.phase}`);
}

export function captureReducer(state: CaptureState, event: CaptureEvent): CaptureState {
  switch (event.type) {
    case "begin_countdown":
      requirePhase(state, ["idle", "recorded", "queued", "error"], "begin countdown");
      return {
        ...initialCaptureState,
        phase: "countingDown",
        countdown: 10,
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
      return { ...state, phase: "recorded", recording: event.recording, error: null };
    case "recording_failed":
      requirePhase(state, ["recording"], "fail recording");
      return { ...state, phase: "error", recording: null, error: event.message };
    case "upload_started":
      requirePhase(state, ["recorded"], "start upload");
      return { ...state, phase: "uploading", error: null };
    case "upload_target_created":
      requirePhase(state, ["uploading"], "save upload target");
      return { ...state, sessionId: event.target.sessionId, uploadTarget: event.target };
    case "upload_failed":
      requirePhase(state, ["uploading"], "fail upload");
      return { ...state, phase: "error", error: event.message };
    case "retry_upload":
      requirePhase(state, ["error"], "retry upload");
      if (!state.recording) throw new Error("Cannot retry upload without a local recording");
      return { ...state, phase: "uploading", error: null };
    case "queued":
      requirePhase(state, ["uploading"], "queue analysis");
      return { ...state, phase: "queued", sessionId: event.sessionId, error: null };
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
