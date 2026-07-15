# Gemini-Only Video Analysis Design

## Goal

FORM analyzes an exercise recording in Expo Go using Gemini's native video understanding, without MediaPipe, joint tracking, a WebView, a Python worker, or another hosted processing service. Supabase remains responsible for authentication, private storage, Edge Functions, and persisted results.

## Product decisions

- Gemini receives the original recording and is the only semantic video analyzer.
- The source recording may be captured at 45 or 60 FPS, but Gemini `videoMetadata.fps` is set to the API maximum of `24`.
- One Gemini generation identifies the exercise, identifies the actual camera view, applies a view-appropriate coaching rubric, compares prior context when available, and returns the final structured result.
- There is no separate recognition pass, pose pass, evidence-frame pass, semantic verifier model, or mandatory second-angle recording.
- JSON Schema output and application validation remain required data-safety boundaries, not additional analysis layers.
- FORM never claims to synthesize or inspect a camera viewpoint that was not recorded.

## Data flow

1. The app records up to 60 seconds with Expo Camera and records duration, facing, lens, and screen orientation metadata.
2. The app uploads the unchanged source video to the user's private Supabase Storage path.
3. `complete-upload` verifies the object, persists capture metadata, sets `status = processing`, and stops. It does not create a job.
4. The analysis screen calls one idempotent `analyze-video` Edge Function until the session reaches a terminal state.
5. The function streams the private storage object to the Gemini Files API and persists the temporary Gemini file identity.
6. If Gemini is still processing the file, the function returns `202` with the persisted stage. A later call resumes without re-uploading.
7. Once the file is active, the function sends one structured generation request containing:
   - the original video with `videoMetadata.fps = 24`;
   - physical capture orientation, facing, and lens metadata;
   - compact active exercise-profile guidance;
   - the previous result when the session is a comparison;
   - one prompt requiring view-aware, timestamped, evidence-grounded coaching.
8. The function validates the JSON shape and value invariants, persists the recognition and result rows, and best-effort deletes the temporary Gemini file.
9. The app receives the terminal result and opens the existing results experience.

The Edge Function advances only the user's requested session. It does not poll a global queue, lease work, run continuously, or require another deployment target.

## Camera view and orientation

Expo records the current device orientation and standard video rotation metadata. FORM records the screen orientation at capture and passes it to Gemini as corroborating metadata. Playback and Gemini's video decoder use the container orientation; FORM does not transcode video in Expo Go.

Within the single analysis request Gemini must classify the visible view as front, side, diagonal, elevated, low, or uncertain before evaluating technique. It then applies only observations supported by that view. A poor view may limit a specific claim, but it does not invalidate other visible coaching.

Automatic viewpoint synthesis is excluded. Rotating pixels can correct sideways orientation; it cannot reveal a hidden knee, hip, bar path, or opposite side. The model must report those limits instead of inventing a new view.

## Accuracy measures

- Request the maximum supported sampling rate of 24 FPS.
- Use the original video rather than text descriptions or selected screenshots.
- Place the video before the text prompt.
- Include compact phases, attention areas, and common faults from the curated profiles while preserving open-ended recognition.
- Require a timestamp interval and visible evidence description for every finding.
- Require confidence of at least `0.75`; omit lower-confidence claims.
- Prohibit claims about pain, internal forces, muscle activation, hidden body parts, or exact laboratory-grade angles.
- Allow qualitative and estimated rep count, tempo, range of motion, and asymmetry when visibly supported.
- Include prior-session context only for an explicitly linked comparison.
- Retry malformed structured output once within the same function invocation; do not run a second reviewer.

## Persistence

`analysis_sessions` stores the capture metadata, Gemini file state, model name, requested FPS, current stage, and failure code. `analysis_results` remains the canonical user-facing result.

`analysis_jobs`, `pose_artifacts`, the active worker queue, and worker-only artifact writes are removed. Historical result rows remain valid.

The active stages become:

1. `video_check` - storage and capture metadata verification.
2. `video_processing` - upload to or processing by the Gemini Files API.
3. `technique_review` - the single 24 FPS Gemini generation request.
4. `coaching` - result validation and persistence.

## Failure and retry behavior

- Missing video: return a recoverable upload error while preserving the local recording.
- Gemini file still processing: return `202` and resume on the next app request.
- App closed: resume from the persisted Gemini file and stage when the session is reopened.
- Gemini file failed: set a clear failure code and permit retry from the stored Supabase video.
- Malformed model JSON: retry generation once; then persist a recoverable failure.
- Unsupported or poorly visible movement: return `partial` or `unable` with one specific limitation and recording instruction.
- Cleanup failure: retain the completed result and record the cleanup failure for best-effort deletion later.

## Security and privacy

- Gemini and Supabase service-role credentials remain Supabase secrets.
- Only the authenticated owner may start, resume, read, correct, or delete an analysis.
- Videos remain in the existing private Supabase bucket.
- Temporary Gemini files are deleted after completion when possible.
- No API secret or service credential is embedded in Expo Go.

## Acceptance criteria

- Recording a set in Expo Go produces a persisted Gemini result without running the Python worker.
- The Gemini request uses `videoMetadata.fps = 24`; no code claims the API accepts 45 FPS.
- One generation performs recognition, view classification, technique analysis, and coaching.
- Sideways capture metadata is preserved and supplied to the model; the result describes the actual visible camera view.
- Every presented finding has timestamped visual evidence and confidence at least `0.75`.
- Closing and reopening a nonterminal analysis resumes without creating a second active upload.
- Results, progress, comparison, correction, playback, history, and deletion continue to work.
- Worker code, Python worker dependencies, job leasing, pose artifacts, and worker-specific UI copy are absent from the active repository.
