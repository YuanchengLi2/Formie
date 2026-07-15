# FORM Record-First AI Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repository instructions prohibit subagents, so execution is inline.

**Goal:** Replace the exercise-selection prototype with a working record-any-exercise flow that uploads the original video, derives MediaPipe evidence, uses Gemini 3.5 Flash for open-ended recognition and coaching, and renders unlimited evidence-backed feedback.

**Architecture:** The Expo app records and privately uploads video without an exercise ID, then polls real Supabase job stages. A Python Cloud Run worker validates video, extracts 15-FPS MediaPipe evidence, uploads the original MP4 to Gemini, receives structured recognition/coaching output, verifies each finding, and persists a compact result. The curated 50 exercises remain optional rubric context rather than a recognition boundary.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router Native Tabs, expo-camera, expo-video, Reanimated 4, Zustand, TanStack Query, Zod 4, Supabase Auth/Postgres/Storage/Edge Functions, Python 3.12, FFmpeg, MediaPipe, Google Gen AI SDK, pytest.

## Global Constraints

- Use the exact Gemini model ID `gemini-3.5-flash` with `thinkingLevel: "medium"` and default sampling parameters.
- Gemini receives the original video and owns recognition, environment/equipment understanding, movement interpretation, coaching knowledge, feedback writing, and uncertainty explanations.
- MediaPipe owns joint tracking, repetitions, angles, range, tempo, pauses, rep comparison, visibility, and possible asymmetry measurements.
- Session creation never accepts or requires an exercise selection.
- Feedback arrays have no application-level maximum; every accepted finding requires timestamped visual evidence and confidence of at least `0.75`.
- Accept front, side, diagonal, low, and imperfect views. Reject only when the movement cannot genuinely be analyzed.
- Gemini and service-role keys remain server-only. Never expose either with `EXPO_PUBLIC_`.
- Preserve the premium matte-black, charcoal, white, and warm-gold visual system.
- Use test-first red-green-refactor for every behavior change.
- Do not use subagents.

---

### Task 1: Replace the selected-exercise analysis contract

**Files:**
- Modify: `src/features/analysis/result-schema.test.ts`
- Modify: `src/features/analysis/result-schema.ts`
- Modify: `src/features/analysis/types.ts`
- Modify: `src/features/analysis/presentation.test.ts`
- Modify: `src/features/analysis/presentation.ts`
- Modify: `src/features/analysis/api.test.ts`
- Modify: `src/features/analysis/api.ts`

**Interfaces:**
- Produces: `AnalysisResult`, `CoachingFinding`, `EvidenceMoment`, `AnalysisStatusResponse`, and `createAnalysisSession({ accessToken })`.
- Consumed by: result screens, progress screens, Edge Function responses, worker output verifier.

- [ ] **Step 1: Write failing schema tests**

Replace the old issue-cap test with tests that parse four or more findings, reject findings with no evidence, permit a complete result with a null score, require an unable result to contain one retry reason/instruction, and reject exercise-specific scores below `0.8` recognition confidence.

```ts
it("accepts every evidence-backed finding without a fixed count cap", () => {
  const result = validResult();
  result.priorityCorrections = Array.from({ length: 5 }, (_, index) => validFinding(`correction-${index}`));
  expect(analysisResultSchema.safeParse(result).success).toBe(true);
});

it("omits exercise-specific scores when recognition is uncertain", () => {
  const result = validResult();
  result.recognition.confidence = 0.62;
  expect(analysisResultSchema.safeParse(result).success).toBe(false);
});
```

- [ ] **Step 2: Run the schema tests and verify RED**

Run: `npm test -- --runInBand src/features/analysis/result-schema.test.ts`

Expected: FAIL because the old result shape has `issues` and a three-item maximum.

- [ ] **Step 3: Implement the new Zod contract**

Define `evidenceMomentSchema`, `coachingFindingSchema`, `recognitionSchema`, `videoCheckSchema`, `comparisonSchema`, and `analysisResultSchema`. Use `.array()` with no `.max()`. Add refinements for `endMs > startMs`, `confidence >= 0.75`, unable-result retry requirements, and score support.

- [ ] **Step 4: Write and run failing API tests**

Change session creation to call:

```ts
await createAnalysisSession({ accessToken: "user-jwt", baseUrl, fetcher });
expect(fetcher).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: "{}" }));
```

Run: `npm test -- --runInBand src/features/analysis/api.test.ts`

Expected: FAIL because `exerciseId` is still required.

- [ ] **Step 5: Update API and presentation helpers**

Remove `exerciseId` from `createAnalysisSession`. Replace issue-only presentation helpers with helpers that rank accepted findings, format recognition uncertainty, and return every accepted item.

- [ ] **Step 6: Verify GREEN**

Run: `npm test -- --runInBand src/features/analysis/result-schema.test.ts src/features/analysis/api.test.ts src/features/analysis/presentation.test.ts`

Expected: all suites pass.

- [ ] **Step 7: Commit**

```powershell
git add src/features/analysis
git commit -m "feat: support open-ended analysis results"
```

---

### Task 2: Reshape Supabase for automatic recognition

**Files:**
- Modify: `supabase/migrations/202607150001_form_schema.sql`
- Modify: `supabase/tests/rls.sql`
- Create: `supabase/seed.sql`

**Interfaces:**
- Produces: nullable catalog match, detected/corrected labels, JSON feedback arrays, previous-session link, and owner-scoped persistence.
- Consumed by: Edge Functions and Python worker.

- [ ] **Step 1: Write failing pgTAP assertions**

Assert that `analysis_sessions.exercise_id` is nullable, recognition columns exist, `previous_session_id` exists, and `analysis_results` has `did_well`, `priority_corrections`, `coaching_cues`, `video_check`, and `comparison` JSONB columns.

```sql
select col_is_null('public', 'analysis_sessions', 'exercise_id', 'exercise match is optional');
select has_column('public', 'analysis_sessions', 'detected_label');
select has_column('public', 'analysis_results', 'priority_corrections');
```

- [ ] **Step 2: Start local Supabase and verify RED**

Run: `npx supabase db start`

Run: `npx supabase test db`

Expected: FAIL on missing recognition/result columns.

- [ ] **Step 3: Replace selected-exercise constraints**

Make `exercise_id` nullable; add recognition, correction, view, and comparison fields. Replace `issues` with unbounded JSON arrays guarded only by `jsonb_typeof(...)= 'array'`. Keep all owner-scoped RLS and private storage policies.

- [ ] **Step 4: Move the 50-row catalog seed into `supabase/seed.sql`**

The seed remains idempotent and keeps every curated profile available without making it required by `analysis_sessions`.

- [ ] **Step 5: Verify GREEN**

Run: `npx supabase db reset --no-seed=false`

Run: `npx supabase test db`

Expected: all pgTAP assertions pass.

- [ ] **Step 6: Commit**

```powershell
git add supabase
git commit -m "feat: persist automatic exercise recognition"
```

---

### Task 3: Replace discovery routes with the record-first flow

**Files:**
- Delete: `src/app/exercises/_layout.tsx`
- Delete: `src/app/exercises/index.tsx`
- Delete: `src/app/exercises/[slug].tsx`
- Delete: `src/screens/exercise-search/index.tsx`
- Delete: `src/screens/exercise-search/exercise-search.test.tsx`
- Delete: `src/screens/exercise-detail/index.tsx`
- Delete: `src/screens/home/exercise-row.tsx`
- Delete: `src/features/exercises/search.ts`
- Delete: `src/features/exercises/search.test.ts`
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/(tabs)/(home)/index.tsx`
- Modify: `src/screens/home/index.tsx`
- Create: `src/app/recording-tips.tsx`
- Create: `src/screens/recording-tips/index.tsx`
- Create: `src/screens/recording-tips/recording-tips.test.tsx`
- Create: `src/components/phone-placement-illustration.tsx`

**Interfaces:**
- Produces: `/recording-tips` route and `RecordingTipsScreen` callbacks `onContinue` and `onOpenSpaceHelp`.
- Consumed by: camera route in Task 4.

- [ ] **Step 1: Write failing home and tips tests**

Assert Home renders `Record an Exercise` and not `Search exercises`. Assert tips render the required stability, 0.5x, angle reassurance, and `No good place for your phone?` copy.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --runInBand src/screens/home/home.test.tsx src/screens/recording-tips/recording-tips.test.tsx`

Expected: FAIL because the record-first screens do not exist.

- [ ] **Step 3: Implement premium Home and Recording Tips screens**

Use the existing theme, `FormWordmark`, `FormButton`, Reanimated entrance transitions, a camera-inspired hero card, the three placement examples, and the explicit reassurance. Keep Home recent content data-driven with an empty state until history exists.

- [ ] **Step 4: Add the native space-help sheet**

Create `src/app/no-phone-space.tsx` as an Expo Router form sheet and `src/screens/recording-tips/no-phone-space.tsx` with exactly the five safe options and the “Good enough to see is good enough to try” close.

- [ ] **Step 5: Remove all selection-only routes and components**

Delete search/detail route adapters and selection-only search logic. Retain `catalog.ts` and profile schema as backend reference knowledge.

- [ ] **Step 6: Verify GREEN and route generation**

Run: `npm test -- --runInBand src/screens/home/home.test.tsx src/screens/recording-tips/recording-tips.test.tsx`

Run: `npm run typecheck`

Expected: tests and TypeScript pass with no references to `/exercises`.

- [ ] **Step 7: Commit**

```powershell
git add -A src/app src/screens src/components src/features/exercises
git commit -m "feat: replace exercise discovery with record-first flow"
```

---

### Task 4: Implement countdown video capture

**Files:**
- Create: `src/features/capture/types.ts`
- Create: `src/features/capture/capture-store.ts`
- Create: `src/features/capture/capture-store.test.ts`
- Create: `src/features/capture/countdown.ts`
- Create: `src/features/capture/countdown.test.ts`
- Create: `src/app/camera.tsx`
- Create: `src/screens/camera/index.tsx`
- Create: `src/screens/camera/camera-controls.tsx`
- Modify: `app.json`

**Interfaces:**
- Produces: `useCaptureStore`, `RecordedSet`, and `/camera` route that navigates to `/analysis/[sessionId]` after upload.
- Consumes: `createAnalysisSession`, `uploadAnalysisVideo`, `completeAnalysisUpload`.

- [ ] **Step 1: Write failing capture-state and countdown tests**

Test `idle -> countingDown -> recording -> recorded -> uploading` transitions, a ten-to-zero sequence, retryable local URI preservation, and invalid transition rejection.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --runInBand src/features/capture`

Expected: FAIL because capture modules do not exist.

- [ ] **Step 3: Implement the finite capture store and countdown utility**

Keep state serializable except the camera ref. Store the local URI, duration, upload state, and current session ID. Reset only after a successful queue or explicit discard.

- [ ] **Step 4: Implement full-screen `CameraView` recording**

Use rear camera by default, hide the header, request permissions eagerly, expose camera flip/flash, show 0.5x only if `minAvailableVideoZoomFactor <= 0.5`, call `recordAsync`, and stop with `stopRecording`. Use `expo-haptics` plus a short platform notification sound at actual start.

- [ ] **Step 5: Wire upload retry without losing the local file**

Create the server session after recording, upload the blob to the signed URL, complete the upload, and navigate only when the backend returns `{ queued: true }`. Keep a retry action on any network failure.

- [ ] **Step 6: Verify GREEN**

Run: `npm test -- --runInBand src/features/capture`

Run: `npm run typecheck`

Expected: capture tests and TypeScript pass.

- [ ] **Step 7: Commit**

```powershell
git add app.json src/app/camera.tsx src/screens/camera src/features/capture
git commit -m "feat: record exercise sets with countdown"
```

---

### Task 5: Add real analysis stages and result navigation

**Files:**
- Create: `src/features/analysis/stages.ts`
- Create: `src/features/analysis/stages.test.ts`
- Create: `src/features/analysis/use-analysis-status.ts`
- Create: `src/app/analysis/[session-id].tsx`
- Create: `src/screens/analysis-progress/index.tsx`
- Create: `src/screens/analysis-progress/analysis-progress.test.tsx`

**Interfaces:**
- Produces: stage labels and a polling hook that stops at complete/partial/unable/failed.
- Consumes: `getAnalysisStatus` and TanStack Query.

- [ ] **Step 1: Write failing stage tests**

Test exact persisted-stage mapping: `video_check`, `pose_tracking`, `rep_detection`, `recognition`, `technique_review`, `coaching`, with no percentage calculation.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --runInBand src/features/analysis/stages.test.ts src/screens/analysis-progress/analysis-progress.test.tsx`

Expected: FAIL because stage modules and screen do not exist.

- [ ] **Step 3: Implement polling and real-stage rendering**

Use React Query with a two-second interval while processing, bounded retry, AbortSignal propagation, stage checkmarks only for preceding persisted stages, and navigation to results when a result is present.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- --runInBand src/features/analysis/stages.test.ts src/screens/analysis-progress/analysis-progress.test.tsx`

Expected: both suites pass.

- [ ] **Step 5: Commit**

```powershell
git add src/features/analysis src/app/analysis src/screens/analysis-progress
git commit -m "feat: show persisted video analysis stages"
```

---

### Task 6: Build results, evidence detail, correction, and repeat UI

**Files:**
- Create: `src/features/analysis/result-store.ts`
- Create: `src/app/results/[session-id].tsx`
- Create: `src/app/results/[session-id]/finding/[finding-id].tsx`
- Create: `src/screens/results/index.tsx`
- Create: `src/screens/results/results.test.tsx`
- Create: `src/screens/finding-detail/index.tsx`
- Create: `src/screens/finding-detail/finding-detail.test.tsx`
- Create: `src/components/feedback-section.tsx`
- Create: `src/components/evidence-video.tsx`
- Modify: `src/features/analysis/api.ts`
- Modify: `src/features/analysis/api.test.ts`

**Interfaces:**
- Produces: results rendering, finding deep link, `correctAnalysisLabel`, and repeat route with `previousSessionId`.

- [ ] **Step 1: Write failing results tests**

Render a result with five positives, four corrections, and four cues. Assert all titles appear, a null score omits the score component, uncertainty language appears, and `Record Another Set` is present.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --runInBand src/screens/results/results.test.tsx src/screens/finding-detail/finding-detail.test.tsx`

Expected: FAIL because results screens do not exist.

- [ ] **Step 3: Implement complete/partial/unable result states**

Use detected label at top, optional score ring, overall assessment, unbounded sections, angle note, comparison summary, and retry/record-another actions. Each card links to its finding route.

- [ ] **Step 4: Implement evidence playback**

Use `expo-video` to seek to `evidence[0].startMs`, show the relevant repetition/phase, and render the short what/when/why/change/cue explanation.

- [ ] **Step 5: Add optional label correction**

Add a results menu action that opens a native prompt/sheet, calls `correct-analysis-label`, invalidates result/history queries, and preserves the original detected label server-side.

- [ ] **Step 6: Implement repeat context**

`Record Another Set` resets capture state and navigates to tips with `previousSessionId`; session creation includes only that optional previous ID.

- [ ] **Step 7: Verify GREEN**

Run: `npm test -- --runInBand src/screens/results src/screens/finding-detail src/features/analysis/api.test.ts`

Run: `npm run typecheck`

Expected: tests and TypeScript pass.

- [ ] **Step 8: Commit**

```powershell
git add src/app/results src/screens/results src/screens/finding-detail src/components src/features/analysis
git commit -m "feat: show unlimited evidence-backed coaching"
```

---

### Task 7: Implement Supabase analysis lifecycle functions

**Files:**
- Create: `supabase/functions/_shared/auth.ts`
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/_shared/responses.ts`
- Create: `supabase/functions/create-analysis/index.ts`
- Create: `supabase/functions/create-analysis/index.test.ts`
- Create: `supabase/functions/complete-upload/index.ts`
- Create: `supabase/functions/analysis-status/index.ts`
- Create: `supabase/functions/correct-analysis-label/index.ts`
- Create: `supabase/functions/delete-analysis/index.ts`

**Interfaces:**
- Produces: authenticated create/upload-complete/status/correct/delete endpoints.
- Consumed by: Expo API client and worker job lease.

- [ ] **Step 1: Write failing Deno tests for session creation**

Assert the handler rejects a body containing `exerciseId`, accepts `{ previousSessionId?: string }`, verifies prior-session ownership, inserts an owner-scoped session, and returns a signed upload URL.

- [ ] **Step 2: Verify RED**

Run: `npx supabase functions serve create-analysis --env-file .env.local`

Run the function test with the Supabase Deno runtime command configured by the CLI.

Expected: FAIL because functions do not exist.

- [ ] **Step 3: Implement small dependency-injected handlers**

Keep HTTP adapters thin. Verify JWT identity, never accept `user_id` from clients, create storage paths as `{userId}/{sessionId}/original.mp4`, and return typed JSON errors.

- [ ] **Step 4: Implement upload completion and status**

`complete-upload` verifies object existence and moves the session to `queued`. `analysis-status` returns only owner-visible session/result fields and the real persisted stage.

- [ ] **Step 5: Implement correction and deletion**

Correction writes separate `corrected_label`/`corrected_exercise_id`. Delete removes the private object and owner session without exposing the service role.

- [ ] **Step 6: Verify functions and RLS**

Run: `npx supabase test db`

Run: `npx supabase functions serve --env-file .env.local` and smoke-test authenticated endpoints against the local stack.

Expected: owner requests succeed; cross-user requests return 404/403.

- [ ] **Step 7: Commit**

```powershell
git add supabase/functions supabase/tests
git commit -m "feat: add private analysis lifecycle APIs"
```

---

### Task 8: Build the MediaPipe measurement worker

**Files:**
- Create: `worker/pyproject.toml`
- Create: `worker/Dockerfile`
- Create: `worker/form_worker/__init__.py`
- Create: `worker/form_worker/models.py`
- Create: `worker/form_worker/video.py`
- Create: `worker/form_worker/pose.py`
- Create: `worker/form_worker/measurements.py`
- Create: `worker/form_worker/repetitions.py`
- Create: `worker/form_worker/evidence_frames.py`
- Create: `worker/tests/test_measurements.py`
- Create: `worker/tests/test_repetitions.py`
- Create: `worker/tests/test_visibility.py`

**Interfaces:**
- Produces: `PoseEvidence` containing timestamped landmarks, visibility, rep boundaries, joint angles, ROM, tempo/pauses, rep comparison, possible asymmetry, and evidence-frame timestamps.
- Consumed by: Gemini prompt builder and verifier.

- [ ] **Step 1: Write failing pure measurement tests**

Use synthetic landmarks to assert a 90-degree elbow angle, ROM max-min, hidden-landmark exclusion, rep boundaries from a periodic trajectory, pause intervals, aligned rep comparison, and asymmetry only when both sides exceed the visibility threshold.

- [ ] **Step 2: Verify RED**

Run: `python -m pytest worker/tests -q`

Expected: FAIL because the worker package does not exist.

- [ ] **Step 3: Implement typed measurement primitives**

Use NumPy for smoothing and geometry. Angle calculations are camera-aware 2D observations and include visibility/confidence metadata. Never interpolate a landmark across an interval marked invisible.

- [ ] **Step 4: Implement MediaPipe Pose Landmarker adapter**

Load `POSE_LANDMARKER_MODEL_PATH`, run VIDEO mode at 15 FPS, map landmarks to typed samples, and return visibility rather than dropping low-confidence samples silently.

- [ ] **Step 5: Implement repetition and phase evidence**

Select the strongest periodic joint/body trajectory, smooth it, find alternating extrema with minimum duration/amplitude guards, and return candidate reps for Gemini to confirm semantically.

- [ ] **Step 6: Implement FFmpeg validation and evidence frames**

Use ffprobe for duration/rotation/resolution; FFmpeg creates a normalized analysis proxy and full-resolution JPEG frames at candidate events. The original MP4 remains unchanged for Gemini.

- [ ] **Step 7: Verify GREEN**

Run: `python -m pytest worker/tests -q`

Expected: all worker unit tests pass.

- [ ] **Step 8: Commit**

```powershell
git add worker
git commit -m "feat: extract MediaPipe movement evidence"
```

---

### Task 9: Integrate Gemini 3.5 Flash and evidence verification

**Files:**
- Create: `worker/form_worker/gemini.py`
- Create: `worker/form_worker/prompts.py`
- Create: `worker/form_worker/verifier.py`
- Create: `worker/form_worker/orchestrator.py`
- Create: `worker/form_worker/main.py`
- Create: `worker/tests/test_gemini_contract.py`
- Create: `worker/tests/test_verifier.py`
- Create: `worker/tests/test_orchestrator.py`
- Create: `.env.example`

**Interfaces:**
- Produces: lease-based job runner that saves validated `AnalysisResult` JSON.
- Consumes: private video download, `PoseEvidence`, Gemini Files API, optional curated profile, optional previous result.

- [ ] **Step 1: Write failing Gemini contract tests**

Inject a fake Gen AI client and assert the request uses `gemini-3.5-flash`, includes the uploaded original video reference, evidence images, serialized MediaPipe measurements, optional previous result, structured JSON schema, and `thinkingLevel: "medium"`.

- [ ] **Step 2: Write failing verifier tests**

Assert it removes findings with missing intervals, confidence below `0.75`, invisible claimed landmarks, or intervals beyond video duration; preserves unrelated valid findings; removes scores when recognition is below `0.8`; and permits more than three valid findings.

- [ ] **Step 3: Verify RED**

Run: `python -m pytest worker/tests/test_gemini_contract.py worker/tests/test_verifier.py -q`

Expected: FAIL because Gemini and verifier modules do not exist.

- [ ] **Step 4: Implement two-pass Gemini analysis**

Pass one recognizes exercise/equipment/environment/variation/uncertainty from the original video. Pass two receives recognition, optional profile, original video, full-resolution frames, MediaPipe evidence, and optional previous result, then returns the full coaching contract.

- [ ] **Step 5: Implement deterministic verification**

Validate each finding independently. Persist accepted arrays without a fixed maximum. Downgrade to partial or unable only from the video-check and remaining evidence, not because a single finding failed.

- [ ] **Step 6: Implement job orchestration**

Lease one queued job, download the private video, persist each real stage, run video/pose/Gemini/verifier steps, store results atomically, and clean local files. Record `model_name = 'gemini-3.5-flash'`.

- [ ] **Step 7: Add environment contract**

`.env.example` contains names only: Supabase URL, service key, Gemini key, pose model path, worker ID, and artifact retention values. Confirm no real values are committed.

- [ ] **Step 8: Verify GREEN**

Run: `python -m pytest worker/tests -q`

Expected: all worker suites pass.

- [ ] **Step 9: Commit**

```powershell
git add worker .env.example
git commit -m "feat: analyze original videos with Gemini 3.5 Flash"
```

---

### Task 10: Add automatic history and progress

**Files:**
- Create: `src/features/progress/api.ts`
- Create: `src/features/progress/group-sessions.ts`
- Create: `src/features/progress/group-sessions.test.ts`
- Modify: `src/screens/progress/index.tsx`
- Create: `src/screens/progress/progress.test.tsx`
- Modify: `src/screens/home/index.tsx`

**Interfaces:**
- Produces: recent analyses, exercise-label grouping, score trends, recurring corrections, and improvements.
- Consumes: owner-scoped completed analysis rows.

- [ ] **Step 1: Write failing grouping tests**

Assert corrected label wins over detected label, case/spacing variants normalize to one group, null scores do not enter score trends, and comparisons/recurring correction titles are preserved.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --runInBand src/features/progress src/screens/progress/progress.test.tsx`

Expected: FAIL because progress grouping does not exist.

- [ ] **Step 3: Implement history query and grouping**

Fetch owner-visible completed sessions/results through Supabase, group by effective label, derive comparable score points, recurring accepted corrections, and improvement summaries.

- [ ] **Step 4: Render Home recents and Progress**

Home shows recent analysis cards under the record action. Progress shows detected exercise history, supported score trends, recurring issues, improvements, and result links without manual logs.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- --runInBand src/features/progress src/screens/progress src/screens/home`

Run: `npm run typecheck`

Expected: tests and TypeScript pass.

- [ ] **Step 6: Commit**

```powershell
git add src/features/progress src/screens/progress src/screens/home
git commit -m "feat: organize progress by detected exercise"
```

---

### Task 11: Final security, build, and visual verification

**Files:**
- Modify only files revealed by verification failures.

**Interfaces:**
- Produces: verified mobile app, backend schema/functions, worker package, and documentation.

- [ ] **Step 1: Run the complete JavaScript verification**

Run: `npm test -- --runInBand`

Run: `npm run typecheck`

Run: `npx expo install --check`

Run: `npx expo export --platform web`

Expected: zero test failures, TypeScript errors, dependency mismatches, or export failures.

- [ ] **Step 2: Run complete backend verification**

Run: `npx supabase db start`

Run: `npx supabase db reset`

Run: `npx supabase test db`

Run: `python -m pytest worker/tests -q`

Expected: migrations reset cleanly, RLS tests pass, and worker tests pass.

- [ ] **Step 3: Scan client code and exported bundle for secrets**

Search for the real Gemini and service-role values without printing them by using fixed-name and JWT-role checks. Confirm client source references only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

- [ ] **Step 4: Visual QA the record-first flow**

Launch Expo web first, then inspect Home, Recording Tips, space-help sheet, analysis progress, results, finding detail, and Progress at phone dimensions. Verify the black/gold hierarchy, scroll safety, readable cards, and absence of search/selection UI. Camera hardware behavior is verified separately in Expo Go.

- [ ] **Step 5: Review requirements line by line**

Re-read `docs/superpowers/specs/2026-07-15-ai-form-coach-design.md` and map every acceptance test to code/test evidence. Report any hardware-only or cloud-deployment validation that remains external.

- [ ] **Step 6: Commit verification fixes**

```powershell
git add -A
git commit -m "chore: verify record-first FORM experience"
```
