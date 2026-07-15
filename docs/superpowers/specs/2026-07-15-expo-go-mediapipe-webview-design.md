# Expo Go MediaPipe WebView Design

> **Superseded:** The approved implementation removes MediaPipe and uses the Gemini-only design in `2026-07-15-gemini-only-video-analysis-design.md`.

## Goal

FORM must analyze recorded exercise videos in Expo Go without a separately deployed Python worker. MediaPipe and Gemini remain part of the analysis. Supabase remains the authentication, private video storage, Edge Function, and result-persistence backend.

## Constraints

- The app must continue to run in standard Expo Go on Android and iOS.
- No custom native module, development client, continuously running process, job lease, Docker worker, or separately hosted service may be required.
- Gemini and Supabase service credentials must remain server-only.
- Gemini must inspect the original video. MediaPipe evidence supplements the video; it does not replace it or override visible evidence.
- Recordings may remain up to 60 seconds. Pose sampling must use a bounded number of frames so runtime and memory do not grow without limit.
- Analysis may require the app to stay foregrounded. If it is interrupted, reopening the session must resume from the last persisted stage.

## Architecture

The app becomes the orchestration layer. A hidden `react-native-webview` runs MediaPipe Tasks Vision's web/WASM Pose Landmarker after the recording has been uploaded. Supabase Edge Functions perform short, explicit Gemini operations and persist each stage. There is no queue consumer.

The pipeline is:

1. The app records a video and creates an authenticated analysis session.
2. The app uploads the original video to the existing private Supabase Storage bucket.
3. `complete-upload` verifies the object, marks the session `processing`, and returns a short-lived signed read URL.
4. A hidden WebView loads pinned MediaPipe Tasks Vision assets and the Pose Landmarker model over HTTPS.
5. The WebView loads the signed video URL, samples at most 240 frames across the complete recording, and posts landmark batches to React Native.
6. React Native summarizes the landmarks into bounded pose evidence: visibility, repetition candidates, evidence timestamps, joint-angle ranges, tempo, and left/right comparisons. Raw landmark frames are not persisted.
7. The app sends the session ID and summarized pose evidence to `start-analysis`.
8. `start-analysis` verifies ownership, streams the private video into the Gemini Files API using a resumable upload, stores the Gemini file reference, and persists the current stage.
9. The app calls `advance-analysis`. The function checks Gemini file readiness, runs recognition and structured coaching when ready, verifies and stores the result, and deletes the temporary Gemini file.
10. The existing status screen polls persisted session state. It also calls `advance-analysis` while the session is nonterminal, allowing analysis to resume after an interruption without a worker.

## Components

### MediaPipe WebView bridge

Add a focused `MediaPipePoseBridge` component owned by the analysis feature, not by the camera UI. It accepts a signed video URL and emits typed lifecycle events:

- `runtime_ready`
- `video_loaded`
- `progress`
- `landmark_batch`
- `complete`
- `error`

The embedded HTML pins an exact `@mediapipe/tasks-vision` version and model URL. Messages are schema-validated before the app accepts them. The bridge samples uniformly across the full duration with `sampleRate = min(5 fps, 240 / durationSeconds)`. It processes one frame at a time and yields between frames so the WebView remains responsive.

The WebView is visually hidden but remains mounted in the foreground analysis screen. It must not use `display: none`, because mobile WebViews may stop media playback and timers when fully hidden.

### Pose evidence builder

Port only the deterministic measurement logic needed by the Gemini prompt from the Python worker into TypeScript. It receives timestamped landmarks and returns a compact, versioned object. Measurements with insufficient landmark visibility are omitted. MediaPipe output never becomes a user-facing diagnosis by itself.

### Supabase functions

- `complete-upload`: stop creating `analysis_jobs`; return a short-lived signed video URL and persist `stage = pose_tracking`.
- `start-analysis`: accept validated pose evidence, upload the original video to Gemini, store the Gemini file identity, and persist `stage = video_processing`.
- `advance-analysis`: check file state, run recognition and coaching with structured JSON output, verify the result, save it, clean up the Gemini file, and return the persisted state.
- `analysis-status`: remain read-only and return the current persisted stage/result plus a refreshed signed video URL when the app must rerun interrupted MediaPipe processing.

Shared prompt, response-schema, and verification code move from the Python worker into TypeScript modules under `supabase/functions/_shared` so Edge Functions and tests use one authoritative contract.

### App orchestration

The analysis progress route owns a small state machine:

- If pose evidence is missing, run the WebView bridge.
- If pose evidence exists but Gemini upload has not started, call `start-analysis`.
- If Gemini work is pending, call `advance-analysis` with bounded backoff.
- If the session is terminal, display the persisted result.

Each network operation is idempotent. Reopening a session reads server state before doing work, so retries do not create duplicate Gemini uploads or duplicate results.

## Reliability and error handling

- MediaPipe asset/model load failure: show a retry action and keep the uploaded video.
- Signed URL expiration: request a refreshed URL from `analysis-status` and restart only the MediaPipe stage.
- Low landmark visibility: continue to Gemini with partial or empty pose evidence rather than failing the analysis.
- App backgrounded or killed: persist completed pose evidence before Gemini processing; resume from the server stage on reopen.
- Gemini file still processing: return a nonterminal response and retry with backoff rather than holding an Edge Function open.
- Invalid Gemini JSON: retry structured generation once, then mark the session failed with a recoverable error.
- Gemini/MediaPipe disagreement: retain only claims supported by the original video; pose measurements are advisory evidence.
- Cleanup failure: do not discard a completed result. Record cleanup state for a later best-effort retry.

## Security and privacy

- The WebView receives only a short-lived signed URL for a video already owned by the authenticated user.
- Navigation is restricted to the pinned MediaPipe asset origins and the signed Supabase object URL.
- The WebView cannot access Supabase tokens, Gemini credentials, or arbitrary app state.
- The Gemini API key remains only in Supabase secrets.
- Existing private-bucket ownership checks and deletion behavior remain in force.

## Testing

- Unit-test WebView message validation, bounded frame scheduling, pose summarization, visibility filtering, rep evidence, and interruption recovery.
- Test `complete-upload` no longer queues a worker job and returns an authorized signed read URL.
- Test `start-analysis` ownership, idempotency, pose-evidence validation, Gemini upload metadata, and persisted stages.
- Test `advance-analysis` for pending, active, valid result, invalid result retry, cleanup failure, and terminal idempotency.
- Test the progress-screen state machine for fresh, interrupted, resumed, failed, and complete sessions.
- Preserve existing result-schema, presentation, history, deletion, and RLS tests.
- Manually verify one Android and one iOS Expo Go recording, including foreground analysis, background/resume, low visibility, and a complete result whose coaching references both the original video and MediaPipe evidence.

## Migration and removal

- Stop writing and reading `analysis_jobs` from the active application flow.
- Remove worker-specific UI copy and tests that imply a background worker.
- Delete the Python `worker` directory only after the Edge Function path passes contract and end-to-end verification.
- Keep existing analysis tables and stored results. Add only the session fields required for pose evidence, Gemini file state, orchestration version, and retry metadata.

## Acceptance criteria

- A user can record a set in Expo Go and receive a persisted Gemini coaching result without running or deploying the Python worker.
- Gemini receives the original video and the available MediaPipe evidence.
- MediaPipe executes inside the app's WebView and processes a bounded sample spanning the complete recording.
- Closing and reopening the analysis screen resumes safely from persisted state.
- No Gemini or service-role secret is present in the Expo bundle or WebView.
- Results, progress history, label correction, evidence playback, and deletion continue to work.
