# FORM Record-First AI Coach Design

## Product Promise

Open FORM, record any exercise, and learn what to improve.

FORM does not require exercise search, category selection, variation confirmation, camera calibration, or setup approval before recording. The app watches the original recording, recognizes the movement in the background, measures visible motion, gives evidence-backed coaching, and helps the user immediately record another set.

The existing 50 exercise profiles remain useful reference knowledge, but they are not a whitelist. Recognition and analysis are fully open-ended.

## Core Principles

1. Gemini must receive and inspect the original video. FORM never claims that the AI watched a recording if it only received text, metadata, pose coordinates, or isolated frames.
2. Gemini 3.5 Flash is the semantic video reasoner. The exact stable model identifier is `gemini-3.5-flash`.
3. MediaPipe is the measurement layer. It tracks landmarks and derives time-series evidence; it does not write coaching or decide what an exercise means.
4. The camera angle only needs to be useful, not perfect. FORM analyzes what the chosen view reveals and explains what it cannot evaluate.
5. Feedback has no fixed item limit. Gemini may return as many positive observations, corrections, cues, and detailed findings as the recording genuinely supports.
6. Every technique claim must be tied to visible evidence, a video interval or repetition when possible, and an explicit confidence value.
7. A score is optional. FORM displays one only when the exercise identity and enough relevant criteria are supported.
8. Uncertainty must be explained instead of hidden. FORM never invents an exercise label, invisible joint position, or precise biomechanical conclusion.
9. The core loop is Record -> Understand -> Correct -> Record again.
10. Gemini and Supabase service credentials remain server-only.

## User Flow

### 1. Home

The Home screen has one dominant action: **Record an Exercise**.

Below the primary action, show recent analyses and a compact progress summary when data exists. Do not show search, categories, exercise rows that begin a selection flow, or variation controls.

Bottom navigation contains Home, Progress, and Profile.

### 2. Recording Tips

Title: **Place your phone anywhere stable**

Show a short, premium phone-placement animation with three realistic examples:

- On a bench.
- Leaned horizontally against a stable water bottle or gym bag owned by the user.
- On a small phone tripod.

Guidance:

- Use the rear camera for better quality.
- Select 0.5x when space is limited and the device supports it.
- Place the phone roughly hip-to-chest height when possible.
- Use a side or diagonal view when practical.
- Prioritize keeping the person and full movement visible over finding a perfect angle.

Reassurance copy:

> The angle does not need to be perfect. Just keep yourself and the movement visible.

Primary action: **Continue to Camera**.

The tips screen may become skippable after the user has completed it, but the first implementation always shows it when starting a new recording.

#### No Recording Space Help

A secondary action reads **No good place for your phone?** and opens a native sheet containing:

- Switch to 0.5x and place the phone closer.
- Lean the phone horizontally against a stable personal item.
- Place it on a bench and tilt it with a soft personal item.
- Ask a training partner to hold it steadily.
- Use a compact folding phone stand.

Do not recommend placing a phone on gym equipment that can move or roll, equipment another person may need, or any location in a walking or lifting path.

The closing rule is:

> Good enough to see is good enough to try.

A future FORM stand may be an optional companion product, never a prerequisite.

### 3. Full-Screen Camera

- Request camera permission clearly and link to system settings when denied.
- Default to the rear camera.
- Provide a lens control that uses 0.5x only when the device exposes an ultra-wide zoom range.
- Provide camera flip and flash controls where supported.
- Start a ten-second countdown after the user taps record.
- Give sound and haptic feedback when recording actually starts.
- Show elapsed time and a large stop control while recording.
- The user stops after completing the set.
- Keep the camera screen free of technique prompts and fake framing gates.
- Preserve the local recording when upload or connectivity fails so the set can be retried.

### 4. Video Check

Before detailed coaching, the backend evaluates:

- A person and a physical movement are visible.
- Enough motion or repetitions exist to analyze.
- Relevant body regions are visible often enough for at least some observations.
- Lighting, stability, resolution, orientation, and duration are usable.
- Equipment and environmental context are visible when relevant.

Outcomes:

- `usable`: continue with full analysis.
- `partial`: analyze only supported aspects and explain visibility limitations.
- `unable`: stop only when the movement genuinely cannot be evaluated, then show one clear reason and **Record Again**.

Front, side, diagonal, elevated, and low recordings are accepted. The analysis adapts to the view:

- Side views may support depth, torso angle, and forward-backward motion.
- Front views may support left-right symmetry, stance, and frontal knee motion.
- Diagonal views may support a mixture of both.
- Low or partially obstructed views may remain useful with reduced confidence.

If a criterion is not visible, omit that criterion rather than rejecting the entire set. Results may say:

> This angle was useful for evaluating depth and control. A side view would make torso position easier to assess next time.

### 5. Automatic Open-Ended Recognition

Exercise recognition runs in the background and never interrupts the analysis flow.

Gemini determines:

- Exercise name and likely variation.
- Equipment and relevant environmental context.
- Movement pattern and repetition structure.
- Recognition confidence and plausible alternatives.
- Which coaching standards are appropriate.

The 50 curated profiles are retrieved when they match or closely resemble the detected movement. For any movement outside the catalog, Gemini constructs a recording-specific observation rubric from the visible exercise, equipment, movement phases, and safe coaching knowledge.

If variation confidence is low, use safe criteria shared by plausible variants. If exercise identity is too uncertain, FORM may still describe visible control, stability, symmetry, tempo, consistency, and range of motion, but it must not display an exercise-specific score or pretend the label is certain.

The results menu permits optional correction of the detected label after analysis. The correction updates organization and future comparison context; it does not silently rewrite the original model evidence.

### 6. Analysis Progress

Display only stages backed by persisted worker state:

1. Checking video quality.
2. Tracking movement.
3. Detecting repetitions.
4. Identifying exercise.
5. Reviewing technique.
6. Preparing coaching.

Do not fabricate completion percentages. A stage becomes complete only after the backend records it as complete.

### 7. Results

The results screen shows:

- Detected exercise and recognition confidence language.
- Overall assessment in concise gym language.
- Optional score when supported.
- **What You Did Well** with zero or more observations.
- **Priority Corrections** with zero or more corrections.
- **Coaching Cues** with zero or more short cues.
- View/visibility note when it helps the next recording.
- **Record Another Set** as the primary action.

There is no hard maximum for feedback arrays. Gemini chooses the count based on evidence and coaching value. The verifier filters unsupported items; the UI renders every accepted item in ranked order.

Each accepted finding records:

- What happened.
- When it happened, using a video interval and repetition when available.
- Why it matters in cautious, non-medical language.
- What to change.
- A short cue.
- Visual evidence and optional MediaPipe evidence.
- Confidence and applicable view.

Do not manufacture criticism. A good set can contain many positive observations and no correction. Multiple corrections are allowed when each is useful and supported.

### 8. Detailed Feedback

Selecting a result item opens the relevant video moment and explains what happened, when, why it matters, what to change, and the cue. Keep the writing short and practical.

### 9. Repeat and Compare

**Record Another Set** starts the tips/camera flow without requiring an exercise selection. The new analysis links to the prior session and compares:

- Whether earlier priority corrections improved, persisted, or were not observable.
- Score change only when both scores are comparable.
- Rep consistency and relevant measured trends.

Progress is organized by the detected or user-corrected exercise label.

## Responsibility Boundary

### Gemini 3.5 Flash

Gemini handles:

- Recognizing the exercise and variation.
- Understanding equipment and environment.
- Interpreting the complete movement.
- Connecting visible problems to coaching knowledge.
- Selecting and ranking evidence-backed feedback.
- Writing clear positive observations, corrections, cues, and explanations.
- Explaining uncertainty and camera-view limitations.
- Comparing the current set to a prior set when comparable evidence is supplied.

Gemini receives:

- The original video through the Gemini Files API.
- Full-resolution evidence frames around phases and suspected events.
- MediaPipe time-series summaries, repetitions, angles, visibility, and candidate asymmetries.
- Matching curated profiles when available.
- The previous session's accepted result for repeat comparisons.
- A strict structured-output schema.

Use `gemini-3.5-flash` with default sampling parameters and `thinkingLevel: "medium"` unless evaluation data supports another level.

### MediaPipe

MediaPipe handles:

- Tracking body joints throughout the recording at 15 frames per second.
- Measuring landmark presence, visibility, and tracking confidence.
- Detecting repetitions from smoothed motion trajectories.
- Measuring camera-aware 2D joint angles.
- Measuring range of motion.
- Detecting tempo, phase duration, and pauses.
- Comparing repetitions at aligned movement phases.
- Identifying possible asymmetry only when both sides are visible and comparable.
- Producing candidate event intervals and high-resolution frame-selection timestamps.

MediaPipe does not name the exercise, diagnose technique, write feedback, or infer invisible joints. Gemini interprets its measurements together with the actual video.

## Technical Architecture

### Mobile App

- Expo SDK 57, React Native, Expo Router, Native Tabs, `expo-camera`, `expo-video`, Reanimated, TanStack Query, Zustand, and Zod.
- Routes contain only route adapters. Screen components live under `src/screens` and feature logic under `src/features`.
- Supabase URL and anon key are the only backend configuration embedded in the app.
- Capture state survives foreground/background transitions when possible.

### Supabase

- Auth identifies users.
- Postgres stores sessions, recognition, accepted results, feedback, comparisons, and corrections.
- Private Storage stores original recordings and derived evidence.
- Row Level Security isolates all user-owned data.
- Edge Functions create sessions, sign uploads, enqueue processing, report status, accept label corrections, and delete sessions.
- Gemini and service-role keys exist only in Edge Function or worker secrets.

### Analysis Worker

- Python Cloud Run service with FFmpeg, MediaPipe Pose Landmarker, and the Google Gen AI SDK.
- FFmpeg validates and normalizes the video and extracts full-resolution evidence frames.
- MediaPipe samples at 15 FPS and produces measurements.
- Gemini 3.5 Flash performs open-ended recognition and coaching from the original video plus measurement evidence.
- A deterministic verifier checks confidence, timestamps, visibility, score support, and safe language before persistence.

## End-to-End Data Flow

1. The app creates an analysis session without an exercise ID.
2. The backend returns a signed private upload URL.
3. The app uploads the original recording and completes the upload.
4. The worker validates video quality and records the video-check outcome.
5. FFmpeg normalizes orientation and selects frames without replacing the original video.
6. MediaPipe tracks landmarks at 15 FPS and derives repetitions, angles, range, tempo, pauses, visibility, consistency, and possible asymmetry.
7. The original video is uploaded to the Gemini Files API and polled until active.
8. Gemini performs open-ended recognition and returns structured recognition context.
9. Matching curated profile knowledge is included when available; otherwise a safe dynamic rubric is used.
10. Gemini analyzes the complete video with the measurement evidence and optional prior-session context.
11. The verifier accepts, removes, or downgrades individual findings based on evidence. One weak item never invalidates unrelated supported feedback.
12. Supabase stores the accepted result and progress grouping label.
13. The app polls real stage changes and renders the result.

## Structured Result Contract

```ts
type EvidenceMoment = {
  startMs: number;
  endMs: number;
  repNumber: number | null;
  phase: string | null;
  visualEvidence: string;
  mediaPipeEvidence: string | null;
  observableLandmarks: string[];
  confidence: number;
};

type CoachingFinding = {
  id: string;
  title: string;
  detail: string;
  whyItMatters: string;
  correction: string | null;
  cue: string | null;
  severity: "note" | "important" | "high";
  evidence: EvidenceMoment[];
};

type AnalysisResult = {
  status: "complete" | "partial" | "unable";
  recognition: {
    label: string | null;
    variation: string | null;
    equipment: string[];
    confidence: number;
    alternatives: string[];
    catalogExerciseId: number | null;
  };
  videoCheck: {
    outcome: "usable" | "partial" | "unable";
    usableObservations: string[];
    limitations: string[];
    retryReason: string | null;
    retryInstruction: string | null;
  };
  overallAssessment: string | null;
  score: number | null;
  scoreRationale: Array<{
    criterion: string;
    observed: string;
    impact: number;
    confidence: number;
  }>;
  didWell: CoachingFinding[];
  priorityCorrections: CoachingFinding[];
  coachingCues: CoachingFinding[];
  viewNote: string | null;
  comparison: {
    previousSessionId: string;
    summary: string;
    priorityIssueImproved: boolean | null;
  } | null;
};
```

Arrays have no application-level maximum. Request and database size limits still protect the service from malformed output. Every finding requires at least one evidence moment and confidence of at least `0.75`.

## Recognition and Scoring Rules

- A confident open-ended label is allowed even when it does not exist in the curated catalog.
- A corrected label is stored separately from the original detected label.
- Exercise-specific scoring requires recognition confidence of at least `0.8`, at least two supported criteria, and enough view coverage for those criteria.
- A partial analysis may show a score only when its observable criteria remain meaningful for that exercise and view.
- If identity confidence is below the exercise-specific threshold, omit the score and use only safe visible observations.
- Scores are technique summaries for the visible set, not medical, injury, strength, or athletic-potential grades.
- Never claim exact 3D joint angles, joint loading, pain causes, muscle activation, or injury diagnosis from one 2D recording.

## Data Model

### `exercises` and `exercise_profiles`

The curated 50-profile reference catalog remains available for rubric retrieval. It is no longer a user-facing selection requirement.

### `analysis_sessions`

- `id`, `user_id`, `status`, `stage`, `video_path`, `duration_ms`, `camera_view`, `previous_session_id`, `failure_code`, timestamps.
- `exercise_id` is nullable and represents a confident catalog match, never required input.
- `detected_label`, `detected_variation`, `recognition_confidence`, `recognition_alternatives`, and `detected_equipment` store the original recognition.
- `corrected_label` and `corrected_exercise_id` store optional user correction.

### `analysis_results`

- `session_id`, `status`, `video_check`, `overall_assessment`, `score`, `score_rationale`, `did_well`, `priority_corrections`, `coaching_cues`, `view_note`, `comparison`, `analysis_version`.

### `pose_artifacts`

- `session_id`, `storage_path`, `sample_rate`, `visibility_summary`, `rep_boundaries`, `measurements`, `candidate_events`, `expires_at`.

## Security and Privacy

- `.env.local` remains ignored by Git.
- `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are never prefixed with `EXPO_PUBLIC_` and never imported into client code.
- Raw videos are private and accessed through short-lived signed URLs.
- Default retention is 30 days for raw video and 7 days for derived artifacts, with immediate user deletion available.
- Users explicitly consent before the first body-video upload.
- Logs contain identifiers, model/version names, timings, and error codes, not API keys or raw body frames.
- The credentials previously pasted into chat must be rotated before a production launch.

## Error and Uncertainty Behavior

- Camera permission denied: explain the need and provide a system-settings action.
- No recording space: provide the safe placement sheet; never block recording for an imperfect setup.
- Upload interrupted: retain the local URI and permit retry.
- Gemini file processing delayed: show the real current stage and poll with bounded backoff.
- MediaPipe cannot track a joint: mark it unobservable and prevent related measurements from supporting feedback.
- Gemini and MediaPipe disagree: keep the video-grounded observation only if its visual evidence independently supports it; otherwise remove or downgrade it.
- Invalid structured output: retry once with validation feedback, then fail without showing raw model text.
- Model or worker failure: show a clear retry action while preserving the recording when possible.

## Validation

### Automated

- Result-schema tests for unbounded arrays, evidence requirements, optional scores, unable states, and recognition confidence.
- Video-check and angle-tolerance tests.
- MediaPipe unit tests for smoothing, repetition boundaries, angles, range, tempo, pauses, visibility, comparisons, and asymmetry gates.
- Gemini contract tests proving the original video file, evidence frames, measurements, recognition context, and prior result are supplied.
- API tests proving session creation has no exercise ID.
- RLS tests proving users cannot read another user's sessions, results, or recordings.
- Mobile tests for record-first navigation, phone-placement help, permissions, countdown, recording, upload retry, real analysis stages, results, correction, and repeat flow.

### Evaluation Set

- Use consented clips across curated and non-catalog exercises, multiple body types, clothing, equipment, lighting, environments, and camera views.
- Coach annotations identify recognition, repetitions, visible strengths, visible corrections, non-observable criteria, and useful cues.
- Track recognition precision, unsupported-claim rate, issue precision, repetition-count error, timestamp accuracy, score calibration, camera-view tolerance, and coach usefulness.
- Do not launch on JSON validity alone. The open-ended system must pass expert review across both known and unfamiliar movements.

### Acceptance Tests

1. The app begins recording without exercise selection.
2. Network and worker logs prove Gemini receives the original video.
3. A non-catalog exercise can receive a confident label and evidence-backed analysis.
4. An uncertain label produces useful generic observations without an exercise-specific score.
5. A front recording can receive symmetry feedback while side-only claims are omitted.
6. A side recording can receive depth or torso feedback while unsupported symmetry claims are omitted.
7. One occluded joint does not cause the full video to be rejected.
8. Feedback arrays can contain more than three items and all accepted items render.
9. Every finding opens a matching video interval.
10. A second set reports whether earlier priority corrections improved when comparable.
11. The mobile bundle contains neither the Gemini key nor the Supabase service-role key.

## Superseded Logic to Remove

- Exercise search route and screen.
- Category filters and search utilities used only by selection UI.
- Exercise detail and variation confirmation routes/screens.
- Home recent-exercise rows that start selection.
- Required `exerciseId` in session-creation API and database constraints.
- Exercise-specific camera setup gates that prevent recording.
- Result limit of three issues and the old `whatWentWrong` / `whatToImprove`-only shape.
- The rule that complete analyses always require a score.

## Confirmed Decisions

- Recognition is fully open-ended.
- The 50 profiles are reference knowledge, not a whitelist.
- Gemini uses the stable `gemini-3.5-flash` model and watches the original video.
- MediaPipe provides measurements and never replaces Gemini's semantic video analysis.
- Feedback count is determined by evidence and coaching value, with no fixed item maximum.
- Phone setup is forgiving and angle-tolerant.
- The supplied black-and-gold reference images remain the visual target.
- Implementation remains a single-agent workflow with no subagents.
