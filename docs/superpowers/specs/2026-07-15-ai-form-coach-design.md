# AI Form Coach Design

## Product Goal

Build a premium iOS and Android fitness app called FORM that records a gym set, sends the actual video to a multimodal model, grounds the model with dense pose and frame evidence, and returns concise coaching the user can act on immediately.

The first release supports 50 exercises. The experience follows the supplied black-and-gold references and keeps the results screen deliberately simple: score, what went wrong, and what to improve. The AI decides which visible problem or problems are important enough to show, subject to evidence and confidence gates.

## Success Criteria

1. A user can select any supported exercise, learn the required camera position, record a set, upload it, receive analysis, and record another set.
2. The original MP4 is supplied directly to Gemini. The system must never claim the AI watched the video if it only received text, metadata, or isolated pose coordinates.
3. Fast movement is examined at 15 frames per second by the pose pipeline, with high-resolution evidence frames selected around movement phase changes and suspected faults.
4. Every visible coaching claim includes internal timestamp, visibility, and confidence evidence. Unsupported claims are removed before the result reaches the app.
5. The results screen contains only an overall score, AI-selected "What went wrong" content, AI-selected "What to improve" content, and the next-recording action.
6. If the relevant joints or equipment are not visible, the app requests a new recording rather than inventing feedback.
7. The service-role and Gemini keys remain server-only. The mobile bundle contains only the Supabase URL and anon key.

## Scope

### Included

- Email/social authentication and private user accounts.
- Searchable catalog of 50 exercises.
- Exercise-specific camera setup guidance.
- Live setup readiness checks with one instruction at a time.
- Video capture, resumable upload, analysis status, results, and retry flows.
- Native Gemini video understanding of the original recording.
- Dense pose extraction, repetition segmentation, phase detection, and high-resolution evidence-frame selection.
- AI-selected results content and score.
- Per-exercise session history and progress chart.
- Private video storage with deletion controls.

### Not Included in the First Release

- Real-time coaching during the set.
- Medical diagnosis, injury diagnosis, or rehabilitation prescriptions.
- Weight-plate recognition, one-repetition-max estimation, nutrition, workout programming, social feeds, trainer marketplaces, or subscriptions.
- Claims that require force plates, multiple synchronized cameras, or depth sensors.
- Automatic exercise recognition. The user selects the exercise before recording.

## Visual Direction

The attached references are the source of truth:

- `C:\Users\yuanc\Downloads\ChatGPT Image Jul 14, 2026, 11_57_42 PM (1).png`
- `C:\Users\yuanc\Downloads\ChatGPT Image Jul 14, 2026, 11_57_42 PM (2).png`

### Visual Rules

- Matte black `#090909` foundation with charcoal surfaces, white type, and warm gold accents.
- Gold is reserved for primary actions, selected states, progress, and high-value emphasis.
- Large, confident numeric hierarchy; sparse copy; generous spacing.
- Thin borders and subtle surface differences instead of glow or gradients.
- Slow fades, short directional slides, and restrained scale transitions. No bounce.
- Real user video is used in recording and evidence views. Instructional art uses neutral monochrome mannequins.
- Bottom navigation contains Home, Progress, and Profile. Recording remains the central product flow even though it is not a persistent fourth tab.

## Navigation and Screens

### Home

- FORM wordmark, greeting, search field, category chips, recent exercises, and bottom navigation.
- Selecting search opens the full exercise catalog.
- Recent exercises are derived from completed analyses.

### Exercise Search

- Search and category filtering over all 50 exercises.
- Each row has a monochrome exercise icon, name, and chevron.

### Exercise Confirmation

- Exercise name, movement demonstration, one short coaching description, and "This Is My Exercise."
- A variation chooser returns to the filtered catalog.

### Camera Setup

- A 4–6 second looping instructional animation shows phone placement, viewing angle, distance, and required body framing.
- The screen shows no technique tutorial. It teaches camera placement only.
- Requirements are driven by the selected exercise profile.

### Live Setup

- The camera checks body visibility, orientation, distance/framing, camera height, and lighting.
- Only the highest-priority instruction appears at a time.
- The record action unlocks when required landmarks are consistently visible for at least one second.

### Recording

- Full-screen camera, timer, stop control, and no coaching overlays.
- Target duration is 3–60 seconds and one working set.

### Analysis

- Show only real persisted stages: uploading, checking video, tracking movement, reviewing technique, and preparing feedback.
- A stage is checked only after its backend state completes. No fabricated percentage.

### Results

- Exercise name and overall score from 0–100.
- "What went wrong" shows zero to three AI-selected issue cards, ordered by severity, actionability, and confidence.
- "What to improve" gives one concise action for each displayed issue. A coaching cue may be included within the improvement sentence, but it is not a separate permanent section.
- If no meaningful error is detected, "What went wrong" says "No major form issue detected in the visible set," and "What to improve" gives the best next refinement.
- The AI determines how many issues to show. The UI does not require fixed sub-scores such as tempo, range of motion, or consistency.
- "Record Another Set" is the single primary action.

### Unable to Analyze

- Explain the exact visibility or recording problem and show one corrective setup instruction.
- Actions: "Record Again" and "Replay Camera Setup."

### Progress

- Overall score history, per-exercise filter, and recent sessions.
- Do not show a metric trend until that metric has appeared consistently and comparably across enough sessions.

## Supported Exercise Catalog

### Chest

1. Barbell Bench Press
2. Incline Dumbbell Press
3. Dumbbell Bench Press
4. Incline Barbell Bench Press
5. Push-Up
6. Machine Chest Press
7. Cable Fly

### Back

8. Conventional Deadlift
9. Lat Pulldown
10. Pull-Up
11. Seated Cable Row
12. One-Arm Dumbbell Row
13. Barbell Bent-Over Row
14. Chest-Supported Row
15. Face Pull

### Legs and Glutes

16. Romanian Deadlift
17. Back Squat
18. Front Squat
19. Goblet Squat
20. Leg Press
21. Bulgarian Split Squat
22. Walking Lunge
23. Reverse Lunge
24. Leg Extension
25. Seated Leg Curl
26. Hip Thrust
27. Standing Calf Raise

### Shoulders

28. Barbell Overhead Press
29. Dumbbell Shoulder Press
30. Dumbbell Lateral Raise
31. Dumbbell Front Raise
32. Rear-Delt Fly
33. Upright Row
34. Dumbbell Shrug

### Arms

35. Standing Dumbbell Curl
36. Hammer Curl
37. Barbell Curl
38. Cable Curl
39. Preacher Curl
40. Cable Triceps Pushdown
41. Overhead Triceps Extension
42. Skull Crusher
43. Parallel-Bar Dip
44. Close-Grip Bench Press

### Core

45. Front Plank
46. Side Plank
47. Crunch
48. Hanging Leg Raise
49. Cable Crunch
50. Ab Wheel Rollout

## Exercise Profiles

The 50 exercises use one analysis engine and 50 data profiles. Each profile contains:

- Exercise ID, display name, category, equipment, and aliases.
- Required and acceptable camera angles.
- Minimum visible landmarks and any important equipment visibility.
- Setup animation copy and live setup priority rules.
- Movement phases and expected joint or body relationships.
- Common observable faults, why each matters, and one safe corrective cue.
- Conditions that make a fault unobservable from the chosen camera angle.
- Scoring dimensions and their relative importance for this exercise.
- Model prompt context and prohibited claims.

The profiles guide attention; they do not replace visual reasoning. Gemini still receives and analyzes the entire video.

## Technical Architecture

### Mobile Application

- Expo Router and React Native with a custom development build for iOS and Android.
- Camera module capable of video recording and on-device frame processing.
- On-device pose inference for setup readiness only; final technique analysis occurs server-side.
- Supabase client uses only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- TanStack Query manages server state. Zustand manages transient capture flow state.

### Supabase

- Auth for user identity.
- Postgres for exercises, sessions, analysis jobs, results, and progress summaries.
- Private Storage bucket for raw videos and derived evidence images.
- Row Level Security restricts every user-owned row and object path to its owner.
- An Edge Function creates signed upload URLs, enqueues analysis jobs, reports status, and deletes user media.
- The service-role key is available only to trusted server processes.

### Analysis Worker

- Python service deployed on Google Cloud Run.
- FFmpeg/ffprobe validates, rotates, normalizes, and samples the recording.
- MediaPipe Pose Landmarker extracts landmarks at 15 FPS with timestamped confidence and visibility.
- A motion module smooths landmarks, identifies repetitions, separates movement phases, computes camera-aware joint relationships, and flags candidate anomalies.
- A frame selector saves full-resolution frames around phase transitions and candidate anomalies. These images preserve details that Gemini's default one-frame-per-second video sampling might miss.
- The Gemini adapter uploads the original MP4 and sends it together with selected high-resolution evidence frames, pose summaries, exercise profile, and a strict structured-output schema.
- A verifier checks timestamps, evidence availability, visibility, score consistency, and unsupported medical or biomechanical certainty before saving a result.

## Video Analysis Data Flow

1. The app creates an `analysis_session` for a selected exercise.
2. The backend returns a signed path for a private upload.
3. The app uploads the original MP4 and marks the upload complete.
4. The worker validates duration, orientation, resolution, brightness, body coverage, and usable frame rate.
5. If quality is inadequate, the job stops with one retry instruction.
6. Pose landmarks are extracted at 15 FPS. The worker measures visibility per landmark and never fills an invisible joint with an assumed value.
7. Repetitions and their eccentric, transition, and concentric phases are detected from smoothed motion trajectories.
8. Full-resolution evidence frames are selected before, during, and after important phase boundaries and suspected deviations.
9. Gemini receives the original video first, followed by the selected frames and a prompt containing the exercise profile and pose evidence.
10. Gemini identifies only the most important visible coaching observations and returns structured JSON.
11. The verifier removes unsupported issues, recalculates availability, and either accepts the result, retries once with validation feedback, or returns partial/unable status.
12. Supabase stores the compact result. The user sees the simplified results screen.

## AI Output Contract

The model may decide which issues matter and how many to show, but it must conform to this shape:

```ts
type AnalysisResult = {
  status: "complete" | "partial" | "unable";
  score: number | null;
  scoreRationale: Array<{
    criterion: string;
    observed: string;
    impact: number;
    confidence: number;
  }>;
  issues: Array<{
    title: string;
    whatWentWrong: string;
    whatToImprove: string;
    startMs: number;
    endMs: number;
    repNumber: number | null;
    visualEvidence: string;
    poseEvidence: string | null;
    severity: "low" | "medium" | "high";
    confidence: number;
    observableLandmarks: string[];
  }>;
  noMajorIssueSummary: string | null;
  nextRefinement: string | null;
  retryInstruction: string | null;
};
```

Only `score`, `issues[].whatWentWrong`, `issues[].whatToImprove`, `noMajorIssueSummary`, `nextRefinement`, and `retryInstruction` are user-facing. The remaining fields exist to audit and validate the AI.

### AI Selection Rules

- Return at most three issues and prefer one excellent observation over three weak ones.
- Display an issue only when confidence is at least `0.75` and the required landmarks or equipment are visible.
- Mention the exact repetition or movement phase when supported.
- Describe visible motion, not an inferred diagnosis or hidden internal condition.
- Give one actionable improvement per issue in plain gym language.
- Do not manufacture a problem to fill the screen.
- Do not claim exact 3D angles, load distribution, pain source, muscle activation, or injury risk from a single 2D recording.

## Scoring

- The exercise profile supplies relevant criteria, but the AI decides which criteria were actually observable in the set.
- The internal score rationale must contain at least two supported criteria before a score can be shown.
- Each criterion has an impact from 0–100 and confidence from 0–1. Low-confidence criteria are excluded.
- The final score is a normalized weighted score across observable criteria, with consistency across repetitions considered only when at least two repetitions are detected.
- `partial` analysis can show a score only when at least 70% of the profile's required observation coverage is available. Otherwise `score` is null and the app requests another recording.
- Scores compare technique visible under similar camera conditions; they are not medical or athletic-performance grades.

## Tiny-Detail Strategy

The system uses multiple evidence resolutions so useful details are not lost:

- Original video gives Gemini global context, equipment, sequencing, body orientation, and the complete set.
- Fifteen-FPS pose data catches brief joint and torso changes between Gemini's default video samples.
- High-resolution evidence frames show hand, elbow, knee, foot, bar, and equipment relationships around important moments.
- Phase-aligned frame groups let the model compare the same point across repetitions.
- Visibility masks prevent false measurements when a joint is occluded.
- Camera-angle rules suppress conclusions that cannot be supported from the recorded viewpoint.
- The verifier requires the text observation, timestamp, and available visual/pose evidence to agree.

## Data Model

### `exercises`

- `id`, `slug`, `name`, `category`, `equipment`, `aliases`, `profile_version`, `is_active`.

### `exercise_profiles`

- `exercise_id`, `version`, `camera_requirements`, `landmark_requirements`, `movement_phases`, `observable_faults`, `scoring_criteria`, `prompt_context`.

### `analysis_sessions`

- `id`, `user_id`, `exercise_id`, `status`, `video_path`, `duration_ms`, `camera_angle`, `created_at`, `completed_at`, `failure_code`.

### `analysis_jobs`

- `id`, `session_id`, `stage`, `attempt`, `lease_until`, `worker_version`, `profile_version`, `model_name`, `error_detail`, `updated_at`.

### `analysis_results`

- `session_id`, `status`, `score`, `score_rationale`, `issues`, `no_major_issue_summary`, `next_refinement`, `retry_instruction`, `analysis_version`.

### `pose_artifacts`

- `session_id`, `storage_path`, `sample_rate`, `visibility_summary`, `rep_boundaries`, `expires_at`.

## Security and Privacy

- `.env.local` is ignored by Git. A committed `.env.example` contains names only.
- `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are read only by trusted backend services.
- The app receives the Supabase URL and anon key. RLS is mandatory before client access.
- Videos live in a private bucket and are accessed with short-lived signed URLs.
- Default retention is 30 days for raw video and 7 days for derived pose/frame artifacts; users can delete immediately.
- Analysis logs contain identifiers and timings, not raw frames or model secrets.
- The app requires explicit consent before uploading body video for analysis.

## Error Handling

- Camera denied: explain why recording is needed and link to system settings.
- Upload interrupted: persist local video and resume or retry without losing the set.
- Body not visible or lighting inadequate: stop before model analysis and return one setup correction.
- Gemini file processing delayed: retain a real processing state and poll with backoff.
- Invalid model JSON: retry once with schema feedback; then mark the job failed without exposing raw model text.
- Pose and Gemini disagree: suppress the disputed issue or return partial analysis.
- Worker crash: lease-based job processing permits safe retry without duplicate results.
- User leaves the app: analysis continues, and the result is available from session history.

## Validation Strategy

### Automated Tests

- Unit tests for exercise profile validation, pose smoothing, repetition segmentation, phase boundaries, scoring normalization, result schema, confidence gates, and RLS policies.
- Contract tests using a fake Gemini adapter to verify that the original video reference, evidence frames, pose summary, and exercise profile are all included.
- Integration tests for signed upload, job lifecycle, retry behavior, private storage, and result persistence.
- Mobile tests for navigation, permissions, recording state, background/foreground transitions, analysis polling, results rendering, and retry flows.

### Video Evaluation Set

- Maintain consented test clips across all 50 exercises, body types, clothing, lighting conditions, camera angles, equipment variants, and both correct and intentionally flawed repetitions.
- Each clip is annotated by a qualified coach with visible issues, observable/non-observable criteria, repetition boundaries, and acceptable coaching language.
- Track issue precision, unsupported-claim rate, retry correctness, rep-count accuracy, and coach usefulness ratings.
- Launch gate: no exercise ships merely because the model returns JSON. Each profile must pass its small evaluation set and an expert spot check.

### Acceptance Tests

1. Network inspection proves the backend uploads the original MP4 to Gemini.
2. A brief fault occurring between one-second samples is detectable through pose data or selected evidence frames.
3. Occluded elbows cannot produce an elbow-position critique.
4. A well-executed set may return zero issues without fabricated criticism.
5. The UI never exposes internal metric clutter, rationales, secrets, or unvalidated model output.
6. The service-role key is absent from compiled mobile assets.
7. RLS prevents one user from reading another user's sessions or videos.

## Delivery Sequence

1. Foundation: Expo app, visual system, navigation, Supabase schema, authentication, and security policies.
2. Catalog: 50 exercise records and profiles, search, confirmation, and camera setup screens.
3. Capture: live readiness, recording, private upload, and job status.
4. Analysis core: video validation, 15-FPS pose pipeline, repetition/phase processing, and evidence frames.
5. Gemini: original-video ingestion, structured prompt, AI selection rules, and result verifier.
6. Results: simplified score/problem/improvement UI and unable/partial states.
7. Progress: history and trend display.
8. Quality: 50-exercise evaluation suite, security review, performance tuning, and store readiness.

## Confirmed Decisions

- Launch catalog contains all 50 exercises.
- Gemini receives the actual original video.
- Pose analysis supplements rather than replaces native video understanding.
- Results show only score, what went wrong, and what to improve.
- The AI decides which evidence-backed issues to display.
- The supplied black-and-gold images are the visual target.
- Implementation will stay in this single agent/session workflow; no subagents are used.

