export type CapturePhase =
  | "idle"
  | "countingDown"
  | "recording"
  | "recorded"
  | "uploading"
  | "processing"
  | "error";

export type CaptureOrientation = "portraitUp" | "portraitDown" | "landscapeLeft" | "landscapeRight" | "unknown";

export type RecordedSet = {
  localUri: string;
  durationMs: number;
  mimeType: string;
  captureOrientation: CaptureOrientation;
  cameraFacing: "front" | "back";
  cameraLens: string | null;
};

export type UploadTarget = {
  sessionId: string;
  signedUrl: string;
  uploadToken: string;
  path: string;
};

export type CaptureState = {
  phase: CapturePhase;
  countdown: number | null;
  startedAt: number | null;
  recording: RecordedSet | null;
  uploadTarget: UploadTarget | null;
  sessionId: string | null;
  previousSessionId: string | null;
  error: string | null;
};

export type CaptureEvent =
  | { type: "begin_countdown"; previousSessionId?: string | null }
  | { type: "countdown_tick" }
  | { type: "recording_started"; startedAt: number }
  | { type: "recording_finished"; recording: RecordedSet }
  | { type: "recording_failed"; message: string }
  | { type: "upload_started" }
  | { type: "upload_target_created"; target: UploadTarget }
  | { type: "upload_failed"; message: string }
  | { type: "retry_upload" }
  | { type: "processing"; sessionId: string }
  | { type: "reset" };
