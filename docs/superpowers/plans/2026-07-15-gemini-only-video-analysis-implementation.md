# Gemini-Only Video Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Repository instructions prohibit subagents, so execution is inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Python/MediaPipe worker pipeline with an Expo Go-compatible, app-driven Supabase Edge Function that sends the original exercise video to Gemini at the supported maximum of 24 FPS and persists one view-aware structured coaching result.

**Architecture:** Expo records and privately uploads the unchanged source video plus capture-orientation metadata. One idempotent `analyze-video` Edge Function uploads or resumes a Gemini Files API object, then performs one structured generation containing recognition, camera-view classification, technique review, and coaching. The analysis screen repeatedly invokes that same endpoint until the persisted session becomes terminal; there is no global queue, worker lease, pose artifact, WebView, second reviewer, or second-angle requirement.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, expo-camera, expo-screen-orientation, TanStack Query, Zod 4, Supabase Auth/Postgres/Storage/Edge Functions, Gemini Files API, Gemini `generateContent`, Jest 29, TypeScript 6.

## Global Constraints

- Standard Expo Go on Android and iOS must remain supported.
- Source recordings may be 45/60 FPS, but every Gemini request must set `videoMetadata.fps` to the API maximum `24`, never `45`.
- Gemini receives the original video and performs recognition, view classification, technique analysis, and coaching in one generation.
- No Python worker, MediaPipe, joint tracking, WebView, job queue, separately hosted service, second AI reviewer, or required second recording remains active.
- Gemini and service-role credentials remain server-only.
- Findings require timestamped visible evidence and confidence of at least `0.75`; hidden or low-confidence details are omitted.
- Capture orientation is preserved and supplied as context; the app does not claim to synthesize an unseen camera viewpoint.
- Implementation follows TDD and each task ends in an independently reviewable commit.

---

## File map

- `src/features/analysis/result-schema.ts`: mobile result contract without MediaPipe fields.
- `src/features/analysis/stages.ts`: four persisted Gemini-only progress stages.
- `src/features/analysis/api.ts`: complete-upload metadata and `analyze-video` client calls.
- `src/features/analysis/use-analysis-status.ts`: app-driven resumable analysis polling.
- `src/features/capture/types.ts`: capture-orientation metadata and `processing` phase.
- `src/screens/camera/index.tsx`: capture device orientation and start processing after upload.
- `supabase/migrations/202607150004_gemini_only_analysis.sql`: remove worker tables and add Gemini/capture state.
- `supabase/functions/_shared/analysis-contract.ts`: Edge Function JSON schema and strict value validation.
- `supabase/functions/_shared/analysis-prompt.ts`: single-pass, view-aware coaching prompt and compact catalog context.
- `supabase/functions/_shared/gemini-video.ts`: injectable Gemini Files/generation REST client.
- `supabase/functions/complete-upload/handler.ts`: pure upload-completion contract.
- `supabase/functions/analyze-video/handler.ts`: pure resumable session state machine.
- `supabase/functions/analyze-video/index.ts`: Supabase repository and Gemini dependency wiring.
- `worker/`: delete after the Edge Function path is covered.

---

### Task 1: Replace pose-oriented result and stage contracts

**Files:**
- Modify: `src/features/analysis/result-schema.ts`
- Modify: `src/features/analysis/result-schema.test.ts`
- Modify: `src/features/analysis/presentation.ts`
- Modify: `src/features/analysis/presentation.test.ts`
- Modify: `src/features/analysis/stages.ts`
- Modify: `src/features/analysis/stages.test.ts`
- Modify: `src/screens/results/results.test.tsx`
- Modify: `src/screens/finding-detail/finding-detail.test.tsx`

**Interfaces:**
- Produces: `CameraView = "front" | "side" | "diagonal" | "elevated" | "low" | "uncertain"`.
- Produces: evidence moments with `visibleBodyAreas: string[]`; removes `mediaPipeEvidence` and `observableLandmarks`.
- Produces: stages `video_check`, `video_processing`, `technique_review`, `coaching`.

- [ ] **Step 1: Write failing contract tests**

Update fixtures to use:

```ts
recognition: {
  label: "Standing Dumbbell Curl",
  variation: "Alternating curl",
  equipment: ["dumbbells"],
  confidence: 0.94,
  alternatives: ["Hammer curl"],
  catalogExerciseId: 35,
  cameraView: "side",
},
evidence: [{
  startMs: 8_000,
  endMs: 8_700,
  repNumber: 3,
  phase: "concentric",
  visualEvidence: "Both elbows move forward between 00:08.0 and 00:08.7.",
  visibleBodyAreas: ["shoulders", "elbows", "torso"],
  confidence: 0.88,
}],
```

Assert that MediaPipe-shaped evidence is rejected and the stage IDs equal the four values above.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```powershell
npx jest src/features/analysis/result-schema.test.ts src/features/analysis/presentation.test.ts src/features/analysis/stages.test.ts src/screens/results/results.test.tsx src/screens/finding-detail/finding-detail.test.tsx --runInBand
```

Expected: FAIL because `cameraView` and `visibleBodyAreas` are not in the current schema and pose stages remain.

- [ ] **Step 3: Implement the minimal Gemini-only contracts**

Use these definitions:

```ts
const cameraViewSchema = z.enum(["front", "side", "diagonal", "elevated", "low", "uncertain"]);

export const evidenceMomentSchema = z.object({
  startMs: z.number().int().min(0),
  endMs: z.number().int().positive(),
  repNumber: z.number().int().positive().nullable(),
  phase: z.string().min(1).nullable(),
  visualEvidence: z.string().min(1),
  visibleBodyAreas: z.array(z.string().min(1)).min(1),
  confidence: z.number().min(0.75).max(1),
}).refine((value) => value.endMs > value.startMs, {
  path: ["endMs"],
  message: "Evidence end time must follow its start time",
});
```

Add `cameraView` to recognition, update presentation checks to use `visibleBodyAreas`, and replace the stage list with:

```ts
export const analysisStages = [
  { id: "video_check", label: "Checking your recording" },
  { id: "video_processing", label: "Preparing the full video" },
  { id: "technique_review", label: "Reviewing visible technique" },
  { id: "coaching", label: "Preparing your coaching" },
] as const;
```

- [ ] **Step 4: Rerun focused tests**

Expected: all listed suites PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/features/analysis src/screens/results/results.test.tsx src/screens/finding-detail/finding-detail.test.tsx
git commit -m "refactor: make results video-only"
```

---

### Task 2: Replace queue persistence with resumable Gemini session state

**Files:**
- Create: `supabase/migrations/202607150004_gemini_only_analysis.sql`
- Create: `supabase/functions/complete-upload/handler.ts`
- Create: `supabase/functions/complete-upload/handler.test.ts`
- Modify: `supabase/functions/complete-upload/index.ts`
- Modify: `supabase/tests/rls.sql`

**Interfaces:**
- Consumes: `{ sessionId, durationMs, captureOrientation, cameraFacing, cameraLens }`.
- Produces: `{ processing: true }` and session state `status = processing`, `stage = video_check`.
- Produces DB fields: `capture_orientation`, `camera_facing`, `camera_lens`, `requested_fps`, `gemini_file_name`, `gemini_file_uri`, `gemini_file_state`, `analysis_attempts`, `cleanup_pending`.

- [ ] **Step 1: Write the failing complete-upload handler tests**

Test valid metadata, owner checks, missing storage objects, duration outside `3000..60000`, and allowed orientation values:

```ts
expect(await completeUploadHandler(request, dependencies)).toMatchObject({ status: 200 });
expect(dependencies.markProcessing).toHaveBeenCalledWith({
  sessionId: "session-1",
  userId: "user-1",
  videoPath: "user-1/session-1/original.mp4",
  durationMs: 18_500,
  captureOrientation: "landscapeLeft",
  cameraFacing: "back",
  cameraLens: "wideAngleCamera",
  requestedFps: 24,
});
```

The dependency type must contain no enqueue or job-upsert method.

- [ ] **Step 2: Run the handler test and confirm failure**

```powershell
npx jest supabase/functions/complete-upload/handler.test.ts --runInBand
```

Expected: FAIL because the pure handler does not exist.

- [ ] **Step 3: Add the migration**

Use explicit state columns and remove worker-owned tables:

```sql
drop table if exists public.pose_artifacts cascade;
drop table if exists public.analysis_jobs cascade;

alter table public.analysis_sessions
  add column if not exists capture_orientation text,
  add column if not exists camera_facing text,
  add column if not exists camera_lens text,
  add column if not exists requested_fps integer not null default 24 check (requested_fps = 24),
  add column if not exists gemini_file_name text,
  add column if not exists gemini_file_uri text,
  add column if not exists gemini_file_state text check (gemini_file_state in ('PROCESSING', 'ACTIVE', 'FAILED')),
  add column if not exists analysis_attempts integer not null default 0 check (analysis_attempts between 0 and 3),
  add column if not exists cleanup_pending boolean not null default false;
```

Update RLS assertions so users still cannot modify server-owned analysis state and no pose/job policy is expected.

- [ ] **Step 4: Implement the pure handler and index wiring**

Validate the request body, authenticate, find the owned session, verify the storage object, and call only `markProcessing`. Return:

```ts
return json({ processing: true }, 200);
```

The index update must persist video/capture metadata and never write `analysis_jobs`.

- [ ] **Step 5: Run focused verification**

```powershell
npx jest supabase/functions/complete-upload/handler.test.ts --runInBand
```

Expected: handler tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add supabase/migrations/202607150004_gemini_only_analysis.sql supabase/functions/complete-upload supabase/tests/rls.sql
git commit -m "refactor: remove worker queue state"
```

---

### Task 3: Build one authoritative analysis schema and prompt

**Files:**
- Create: `supabase/functions/_shared/analysis-contract.ts`
- Create: `supabase/functions/_shared/analysis-contract.test.ts`
- Create: `supabase/functions/_shared/analysis-prompt.ts`
- Create: `supabase/functions/_shared/analysis-prompt.test.ts`

**Interfaces:**
- Produces: `GEMINI_ANALYSIS_JSON_SCHEMA` matching the mobile result contract.
- Produces: `validateAnalysisCandidate(value: unknown, durationMs: number): AnalysisCandidate`.
- Produces: `buildAnalysisPrompt(input: PromptInput): string`.

- [ ] **Step 1: Write failing schema and prompt tests**

Cover valid results, timestamps past video duration, confidence below `0.75`, missing visible body areas, unsupported camera views, uncertain recognition with a score, unable results containing findings, and prompt requirements. The prompt test must assert all of these strings:

```ts
expect(prompt).toContain("front, side, diagonal, elevated, low, or uncertain");
expect(prompt).toContain("Do not infer details hidden from the recorded camera view");
expect(prompt).toContain("qualitative or estimated");
expect(prompt).toContain("24 frames per second");
expect(prompt).not.toContain("MediaPipe");
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
npx jest supabase/functions/_shared/analysis-contract.test.ts supabase/functions/_shared/analysis-prompt.test.ts --runInBand
```

Expected: FAIL because the shared modules do not exist.

- [ ] **Step 3: Implement the schema and strict validator**

Define the same required properties used by `analysisResultSchema`, including `recognition.cameraView` and evidence `visibleBodyAreas`. Reject the whole candidate when any invariant fails so the Gemini client can retry once; do not silently invent, merge, or rewrite findings.

The duration check must be exact:

```ts
if (moment.startMs < 0 || moment.endMs <= moment.startMs || moment.endMs > durationMs) {
  throw new Error("Evidence timestamp is outside the recorded video");
}
```

- [ ] **Step 4: Implement the one-pass prompt**

`PromptInput` contains capture metadata, compact profiles, and optional previous result. The prompt must require the model to identify the exercise and actual camera view before applying view-specific checks, but return one final object. It must prohibit exact biomechanical claims and support open-ended movements not in the catalog.

- [ ] **Step 5: Rerun tests**

Expected: both suites PASS.

- [ ] **Step 6: Commit**

```powershell
git add supabase/functions/_shared/analysis-contract* supabase/functions/_shared/analysis-prompt*
git commit -m "feat: define Gemini video coaching contract"
```

---

### Task 4: Add the Gemini Files and 24-FPS generation client

**Files:**
- Create: `supabase/functions/_shared/gemini-video.ts`
- Create: `supabase/functions/_shared/gemini-video.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `createGeminiVideoClient({ apiKey, model, fetcher })`.
- Produces: `uploadVideo`, `getFile`, `generateAnalysis`, and `deleteFile`.
- `generateAnalysis` always places the video part before text and sets `videoMetadata: { fps: 24 }`.

- [ ] **Step 1: Write failing REST contract tests**

Mock the resumable upload start/finalize calls, file-state GET, generation request, malformed JSON retry, and deletion. Assert the generation body includes:

```ts
expect(parts[0]).toEqual({
  fileData: { mimeType: "video/mp4", fileUri: "https://generativelanguage.googleapis.com/v1beta/files/file-1" },
  videoMetadata: { fps: 24 },
});
expect(parts[1]).toEqual({ text: expect.stringContaining("actual camera view") });
expect(generationConfig).toMatchObject({
  responseMimeType: "application/json",
  responseJsonSchema: GEMINI_ANALYSIS_JSON_SCHEMA,
});
```

Also assert no request contains `fps: 45`.

- [ ] **Step 2: Run the test and confirm failure**

```powershell
npx jest supabase/functions/_shared/gemini-video.test.ts --runInBand
```

Expected: FAIL because the client does not exist.

- [ ] **Step 3: Implement the injectable REST client**

Use the official endpoints:

```ts
const API = "https://generativelanguage.googleapis.com/v1beta";
const UPLOAD_API = "https://generativelanguage.googleapis.com/upload/v1beta/files";
```

Start a resumable upload with `X-Goog-Upload-Protocol: resumable`, finalize the Supabase video stream through the returned upload URL, poll `${API}/${file.name}`, generate through `${API}/models/${model}:generateContent`, and best-effort delete `${API}/${file.name}`. Parse model text and call `validateAnalysisCandidate`; on validation failure, retry generation once with the validation error appended to the prompt.

- [ ] **Step 4: Add environment names only**

Keep `GEMINI_API_KEY=` and add:

```dotenv
GEMINI_MODEL=gemini-3.5-flash
```

Do not add any value.

- [ ] **Step 5: Rerun tests**

Expected: all Gemini client contract tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add supabase/functions/_shared/gemini-video* .env.example
git commit -m "feat: call Gemini video analysis at 24 fps"
```

---

### Task 5: Implement the resumable `analyze-video` Edge Function

**Files:**
- Create: `supabase/functions/analyze-video/handler.ts`
- Create: `supabase/functions/analyze-video/handler.test.ts`
- Create: `supabase/functions/analyze-video/index.ts`
- Modify: `supabase/functions/analysis-status/index.ts`

**Interfaces:**
- Consumes: authenticated `POST { sessionId: string }`.
- Produces: the existing status payload with HTTP `202` while nonterminal and HTTP `200` with a result when terminal.
- Persists one Gemini file identity and one canonical result per session.

- [ ] **Step 1: Write failing state-machine tests**

Cover these exact transitions:

```text
missing session -> 404
terminal session -> 200 without new Gemini calls
no video path -> 409
no Gemini file -> upload, persist file, return 202/video_processing
PROCESSING file -> return 202/video_processing
FAILED file -> persist failed and return 502
ACTIVE file -> generate once, persist result, delete file, return 200/coaching
malformed result twice -> persist failed and return 502
```

Assert a repeat request after completion never uploads or generates again.

- [ ] **Step 2: Run the handler test and confirm failure**

```powershell
npx jest supabase/functions/analyze-video/handler.test.ts --runInBand
```

Expected: FAIL because the function does not exist.

- [ ] **Step 3: Implement the pure handler**

Define dependencies for authentication, session loading, file upload/status, prompt context, generation, persistence, failure marking, and cleanup. Advance at most one externally expensive phase per invocation. Return the same payload shape as `analysis-status` so the app needs one schema.

- [ ] **Step 4: Wire Supabase and Gemini dependencies**

The index must:

- authenticate through `requireUserId`;
- fetch only the owner's session;
- download the private storage object as a stream with content length and MIME type;
- load compact active catalog profiles and the explicitly linked previous result;
- persist Gemini file state before returning `202`;
- persist `camera_view`, recognition fields, `analysis_results`, model name, and completed timestamp;
- never read or write `analysis_jobs` or pose artifacts.

Refactor `analysis-status` result mapping into a shared helper only if needed to keep response shapes identical.

- [ ] **Step 5: Run focused Edge Function tests**

```powershell
npx jest supabase/functions/analyze-video/handler.test.ts supabase/functions/complete-upload/handler.test.ts supabase/functions/_shared/gemini-video.test.ts supabase/functions/_shared/analysis-contract.test.ts supabase/functions/_shared/analysis-prompt.test.ts --runInBand
```

Expected: all suites PASS.

- [ ] **Step 6: Commit**

```powershell
git add supabase/functions/analyze-video supabase/functions/analysis-status supabase/functions/_shared
git commit -m "feat: analyze stored videos without a worker"
```

---

### Task 6: Capture orientation and drive analysis from Expo Go

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/features/capture/types.ts`
- Modify: `src/features/capture/capture-store.ts`
- Modify: `src/features/capture/capture-store.test.ts`
- Modify: `src/features/analysis/api.ts`
- Modify: `src/features/analysis/api.test.ts`
- Modify: `src/features/analysis/use-analysis-status.ts`
- Modify: `src/screens/camera/index.tsx`

**Interfaces:**
- Produces: `CaptureOrientation = "portraitUp" | "portraitDown" | "landscapeLeft" | "landscapeRight" | "unknown"`.
- Produces: `processAnalysis(input): Promise<AnalysisStatusResponse>`.
- Renames capture phase/event `queued` to `processing`.

- [ ] **Step 1: Install the Expo Go-compatible orientation package**

```powershell
npx expo install expo-screen-orientation
```

Expected: package and lockfile use the SDK 57-compatible `~57.0.1` release.

- [ ] **Step 2: Write failing client and state tests**

Assert `completeAnalysisUpload` sends all capture metadata and expects `{ processing: true }`; assert `processAnalysis` posts to `/analyze-video`; assert capture state transitions from `uploading` to `processing`.

```ts
expect(fetcher).toHaveBeenCalledWith(
  "https://example.supabase.co/functions/v1/analyze-video",
  expect.objectContaining({ method: "POST", body: JSON.stringify({ sessionId: "session-123" }) }),
);
```

- [ ] **Step 3: Run focused tests and confirm failure**

```powershell
npx jest src/features/analysis/api.test.ts src/features/capture/capture-store.test.ts --runInBand
```

Expected: FAIL because metadata, the process endpoint, and processing event do not exist.

- [ ] **Step 4: Implement capture metadata and API calls**

Immediately before recording, call `ScreenOrientation.getOrientationAsync()` and map the enum to `CaptureOrientation`. Store it with `durationMs`, `facing`, and `selectedLens`. Send those fields to `complete-upload` after the signed upload succeeds.

Add:

```ts
export async function processAnalysis(
  input: RequestContext & { sessionId: string },
): Promise<AnalysisStatusResponse> {
  return requestJson(
    "analyze-video",
    input,
    { method: "POST", body: JSON.stringify({ sessionId: input.sessionId }) },
    statusResponseSchema,
  );
}
```

- [ ] **Step 5: Change polling to advance the requested session**

`useAnalysisStatus` must call `processAnalysis`, stop on `complete|partial|unable|failed`, keep the two-second interval for `202` responses, and avoid overlapping requests through TanStack Query's existing in-flight behavior.

- [ ] **Step 6: Rerun focused tests and typecheck**

```powershell
npx jest src/features/analysis/api.test.ts src/features/capture/capture-store.test.ts --runInBand
npx tsc --noEmit
```

Expected: tests PASS and TypeScript exits `0`.

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json src/features/capture src/features/analysis src/screens/camera/index.tsx
git commit -m "feat: drive Gemini analysis from Expo Go"
```

---

### Task 7: Remove worker implementation and worker-facing product copy

**Files:**
- Delete: `worker/`
- Modify: `.env.example`
- Modify: `src/screens/profile/index.tsx`
- Modify: `src/screens/profile/profile.test.tsx`
- Modify: `src/screens/analysis-progress/analysis-progress.test.tsx`
- Modify: `docs/superpowers/specs/2026-07-15-ai-form-coach-design.md`
- Modify: `docs/superpowers/plans/2026-07-15-ai-form-coach-implementation.md`

**Interfaces:**
- Removes all active Python, FFmpeg, MediaPipe, pose-model, worker ID, and artifact-retention requirements.
- Keeps historical documents but marks their worker architecture superseded.

- [ ] **Step 1: Update tests to reject worker/MediaPipe copy**

The profile test must expect wording equivalent to:

```text
Gemini reviews the complete recording at a high sampling rate, adapts its coaching to the visible camera view, and cites the moments supporting each finding.
```

The progress test name and failure copy must refer to analysis rather than a worker.

- [ ] **Step 2: Run profile and progress tests and confirm failure**

```powershell
npx jest src/screens/profile/profile.test.tsx src/screens/analysis-progress/analysis-progress.test.tsx --runInBand
```

Expected: FAIL while MediaPipe/worker copy remains.

- [ ] **Step 3: Delete the worker and obsolete environment entries**

Remove the entire `worker` directory. Remove `POSE_LANDMARKER_MODEL_PATH`, `WORKER_ID`, `WORKER_RUN_CONTINUOUSLY`, and `POSE_ARTIFACT_RETENTION_DAYS` from `.env.example`.

- [ ] **Step 4: Update active copy and mark historical docs superseded**

Replace profile copy with Gemini-only wording. Add a superseded notice at the top of the original design and implementation plan linking to the Gemini-only spec and this plan; do not rewrite historical task content.

- [ ] **Step 5: Verify removal and run tests**

```powershell
rg -n "MediaPipe|POSE_LANDMARKER|WORKER_ID|WORKER_RUN_CONTINUOUSLY|pose_tracking|rep_detection" src supabase/functions .env.example
npx jest src/screens/profile/profile.test.tsx src/screens/analysis-progress/analysis-progress.test.tsx --runInBand
```

Expected: `rg` returns no active-code matches; both test suites PASS.

- [ ] **Step 6: Commit**

```powershell
git add -A worker .env.example src/screens/profile src/screens/analysis-progress docs/superpowers
git commit -m "refactor: remove the analysis worker"
```

---

### Task 8: Verify the complete no-worker pipeline

**Files:**
- Modify only files required by failures found during this task.

**Interfaces:**
- Produces: verified Expo app, migrations, Edge Function contracts, and worker-free repository.

- [ ] **Step 1: Run every JavaScript test serially**

```powershell
npm test -- --runInBand
```

Expected: all Jest suites PASS with no failed tests.

- [ ] **Step 2: Run the mobile typecheck**

```powershell
npx tsc --noEmit
```

Expected: exit code `0`.

- [ ] **Step 3: Validate database migrations and RLS**

```powershell
supabase start
supabase db reset
supabase db lint
supabase test db supabase/tests/rls.sql
```

Expected: the local stack starts, migrations apply cleanly, database lint reports no errors, and RLS tests PASS.

- [ ] **Step 4: Run repository truth checks**

```powershell
if (Test-Path worker) { throw 'worker directory still exists' }
rg -n "analysis_jobs|pose_artifacts|MediaPipe|mediaPipeEvidence|observableLandmarks|fps\s*[:=]\s*45" src supabase/functions .env.example
git diff --check
```

Expected: no active-code matches and no whitespace errors.

- [ ] **Step 5: Perform a local authenticated smoke test when Supabase is running**

Record a 10-20 second set in Expo Go and verify persisted stages progress through `video_check -> video_processing -> technique_review -> coaching`. Inspect the mocked or local request log and confirm the Gemini content part contains `videoMetadata.fps = 24`, the original video file URI, and one text prompt after the video part. Confirm the result opens, plays evidence timestamps, and states the actual camera view.

- [ ] **Step 6: Commit verification fixes, if any**

```powershell
git add -A
git commit -m "test: verify Gemini-only analysis pipeline"
```

Skip this commit only when `git status --short` is empty after all verification commands.
