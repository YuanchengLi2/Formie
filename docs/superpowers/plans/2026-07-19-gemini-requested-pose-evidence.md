# Gemini-Requested Pose Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repository instructions prohibit subagents, so execution and review stay inline.

**Goal:** Replace locally hard-coded wrist/repetition/equipment inference with a private neutral pose-data index that executes bounded geometry queries selected by Gemini.

**Architecture:** The existing native MediaPipe module remains a sensor and produces timestamped normalized and camera-relative world landmarks. The client uploads a compact raw version-3 artifact; after full-video foundation analysis, Gemini requests arbitrary neutral geometry queries, the server evaluates them against real source frames, and coaching receives the results with strict provenance and exact-frame verification.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, Swift/MediaPipe Pose Landmarker Heavy, Supabase Edge Functions/Postgres/Storage, Gemini Interactions API, Jest.

---

## Global constraints

- No subagents.
- No exercise-specific native or server rules.
- No local exercise recognition, repetition counting, phase segmentation, fault detection, or coaching.
- No fake equipment paths derived from hands.
- Preserve raw normalized and world landmarks; derived values never replace their source.
- No interpolation or silent timestamp shifting in version 1.
- Gemini chooses operations, joints, coordinate spaces, and time windows.
- Query execution is deterministic, bounded, auditable, and independent of model confidence claims.
- Tracking failure falls back to the existing video path.
- Preserve all unrelated uncommitted user changes.
- Do not commit, deploy, or publish until the user explicitly authorizes those actions.

## File map

New focused units:

- `src/features/tracking/pose-evidence-artifact.ts`: serialize native frame output into the version-3 raw artifact and neutral manifest.
- `src/features/tracking/pose-evidence-artifact.test.ts`: artifact schema, size, chronology, and semantic-neutrality tests.
- `supabase/functions/_shared/pose-evidence-contract.ts`: shared manifest, query-plan, and query-result validators.
- `supabase/functions/_shared/pose-evidence-contract.test.ts`: closed-schema and bounds tests.
- `supabase/functions/_shared/pose-evidence-index.ts`: immutable lookup/index over validated raw frames.
- `supabase/functions/_shared/pose-evidence-index.test.ts`: arbitrary-joint geometry and missing-data tests.
- `supabase/functions/_shared/pose-query-planner.ts`: Gemini planner prompt, schema, parsing, and retry behavior.
- `supabase/functions/_shared/pose-query-planner.test.ts`: planner neutrality and malformed-output tests.
- `supabase/migrations/202607190021_gemini_requested_pose_evidence.sql`: artifact, manifest, plan, result, and stage persistence.

Existing integration seams:

- `modules/form-motion-tracker/src/FormMotionTracker.types.ts`
- `modules/form-motion-tracker/ios/FormMotionTrackingEngine.swift`
- `src/features/tracking/tracking-plan.ts`
- `src/features/tracking/tracking-plan.test.ts`
- `src/features/tracking/tracker-summary.ts`
- `src/features/tracking/tracker-summary.test.ts`
- `src/features/analysis/api.ts`
- `src/features/analysis/api.test.ts`
- `src/features/capture/types.ts`
- `src/features/capture/upload-coordinator.ts`
- `src/features/capture/upload-coordinator.test.ts`
- `src/features/capture/analysis-upload-coordinator.ts`
- `supabase/functions/create-analysis/handler.ts`
- `supabase/functions/create-analysis/handler.test.ts`
- `supabase/functions/create-analysis/index.ts`
- `supabase/functions/complete-upload/handler.ts`
- `supabase/functions/complete-upload/handler.test.ts`
- `supabase/functions/complete-upload/index.ts`
- `supabase/functions/analyze-video/handler.ts`
- `supabase/functions/analyze-video/handler.test.ts`
- `supabase/functions/analyze-video/index.ts`
- `supabase/functions/_shared/gemini-video.ts`
- `supabase/functions/_shared/gemini-video.test.ts`
- `supabase/functions/_shared/analysis-contract.ts`
- `supabase/functions/_shared/analysis-contract.test.ts`
- `supabase/functions/_shared/analysis-prompt.ts`
- `supabase/functions/_shared/analysis-prompt.test.ts`
- `supabase/functions/analysis-status/index.ts`
- `src/features/analysis/progress-stages.ts`
- `src/features/analysis/progress-stages.test.ts`
- `src/screens/analysis-progress/index.tsx`
- `src/screens/analysis-progress/analysis-progress.test.tsx`
- `supabase/functions/delete-analysis/handler.ts`
- `supabase/functions/delete-analysis/handler.test.ts`
- `scripts/run-current-bench-analysis.mts`

### Task 1: Lock the version-3 raw artifact contract

**Files:**
- Create: `src/features/tracking/pose-evidence-artifact.ts`
- Create: `src/features/tracking/pose-evidence-artifact.test.ts`
- Modify: `modules/form-motion-tracker/src/FormMotionTracker.types.ts`

- [ ] **Step 1: Write a synthetic native-result fixture with nontrivial 2D, estimated-Z, world, confidence, rotation, and missing-frame values.**

The test must express the desired public shape:

```ts
const artifact = buildPoseEvidenceArtifact(nativeResult);

expect(artifact).toMatchObject({
  version: 3,
  model: "MediaPipe.PoseLandmarker.Heavy",
  requestedFps: 24,
  coordinateSpaces: ["image_normalized", "world_camera_relative"],
});
expect(artifact.frames[0].normalized[15]).toEqual([0.21, 0.32, -0.08, 0.91, 0.94]);
expect(artifact.frames[0].world[15]).toEqual([0.12, -0.24, -0.31, 0.91, 0.94]);
expect(JSON.stringify(artifact)).not.toMatch(/rep|fault|phase|equipment|symmetry/i);
```

- [ ] **Step 2: Add tests for monotonic timestamp enforcement, absent world points, non-finite numeric rejection, immutable input, and a 12 MiB ceiling for the 90-second artifact.**

- [ ] **Step 3: Run the test and verify RED.**

Run:

```powershell
npx jest --runInBand src/features/tracking/pose-evidence-artifact.test.ts
```

Expected: FAIL because `buildPoseEvidenceArtifact` does not exist.

- [ ] **Step 4: Implement compact array-based artifact serialization without derived features.**

Use explicit types:

```ts
export type PoseCoordinate = [x: number, y: number, z: number, visibility: number, presence: number];

export type PoseEvidenceArtifactV3 = {
  version: 3;
  model: "MediaPipe.PoseLandmarker.Heavy";
  requestedFps: 24;
  durationMs: number;
  status: "complete" | "partial" | "unavailable";
  jointNames: readonly string[];
  coordinateSpaces: ["image_normalized", "world_camera_relative"];
  camera: MotionTrackerResult["camera"];
  frames: Array<{
    sourceFrameIndex: number;
    timestampMs: number;
    confidence: number;
    sharpness: number;
    normalized: Array<PoseCoordinate | null>;
    world: Array<PoseCoordinate | null>;
  }>;
  limitations: string[];
};
```

- [ ] **Step 5: Return a separate small manifest containing only provenance, joint names, coordinate spaces, coverage, artifact byte size, and limitations.**

- [ ] **Step 6: Run the focused test and confirm GREEN.**

### Task 2: Remove local semantic influence from initial evidence selection

**Files:**
- Modify: `src/features/tracking/tracking-plan.ts`
- Modify: `src/features/tracking/tracking-plan.test.ts`
- Modify: `src/features/tracking/tracker-summary.ts`
- Modify: `src/features/tracking/tracker-summary.test.ts`
- Modify: `src/features/capture/analysis-upload-coordinator.ts`

- [ ] **Step 1: Write failing tests proving initial frames are coverage-only and never originate from native `events` or `repCandidates`.**

```ts
expect(selectCoverageFrames(durationMs, frameQuality))
  .toEqual(expect.arrayContaining([expect.objectContaining({ purpose: "coverage" })]));
expect(selectCoverageFrames(durationMs, frameQuality).map((item) => item.evidenceId))
  .not.toEqual(expect.arrayContaining([expect.stringMatching(/rep|reversal|event/i)]));
```

- [ ] **Step 2: Add a regression fixture where wrists oscillate but all selected frames remain uniformly quality-based.**

- [ ] **Step 3: Run tracking-plan and tracker-summary tests and verify RED.**

- [ ] **Step 4: Replace `buildPhaseDiverseCandidates` consumption with deterministic quality-approved coverage selection.**

Coverage may use confidence and sharpness because those are data-quality properties. It may not use joint motion magnitude or semantic labels.

- [ ] **Step 5: Change `buildTrackerSummary` into the small version-3 manifest builder or remove it in favor of `buildPoseEvidenceArtifact(...).manifest`.**

- [ ] **Step 6: Leave legacy native event fields readable temporarily, but prove they do not cross the upload boundary or Gemini prompt.**

- [ ] **Step 7: Re-run focused tests and confirm GREEN.**

### Task 3: Upload the private raw artifact with the video

**Files:**
- Modify: `src/features/analysis/api.ts`
- Modify: `src/features/analysis/api.test.ts`
- Modify: `src/features/capture/types.ts`
- Modify: `src/features/capture/upload-coordinator.ts`
- Modify: `src/features/capture/upload-coordinator.test.ts`
- Modify: `src/features/capture/analysis-upload-coordinator.ts`
- Modify: `supabase/functions/create-analysis/handler.ts`
- Modify: `supabase/functions/create-analysis/handler.test.ts`
- Modify: `supabase/functions/create-analysis/index.ts`

- [ ] **Step 1: Write failing API tests requiring one signed pose-artifact target.**

```ts
expect(response.poseArtifactUpload.path)
  .toBe("user-1/session-1/pose/landmarks-v3.json");
```

- [ ] **Step 2: Write a failing upload-coordinator test proving video, raw pose artifact, and initial coverage frames upload concurrently and retry without creating a second session.**

- [ ] **Step 3: Add `poseArtifactUpload` to create-analysis and client schemas.**

- [ ] **Step 4: Add `uploadSignedAnalysisJson` that PUTs UTF-8 JSON with `Content-Type: application/json` directly to the signed URL.**

- [ ] **Step 5: Extend tracking artifacts passed to `completeUpload` with `poseArtifactPath` and `poseManifest`; do not send the full raw artifact in the function request body.**

- [ ] **Step 6: Preserve video-only fallback when the module, artifact builder, or JSON upload fails.**

- [ ] **Step 7: Run focused client, create-analysis, and upload tests until GREEN.**

Run:

```powershell
npx jest --runInBand src/features/analysis/api.test.ts src/features/capture/upload-coordinator.test.ts supabase/functions/create-analysis/handler.test.ts
```

### Task 4: Persist and validate owned version-3 artifact metadata

**Files:**
- Create: `supabase/migrations/202607190021_gemini_requested_pose_evidence.sql`
- Create: `supabase/functions/_shared/pose-evidence-contract.ts`
- Create: `supabase/functions/_shared/pose-evidence-contract.test.ts`
- Modify: `supabase/functions/complete-upload/handler.ts`
- Modify: `supabase/functions/complete-upload/handler.test.ts`
- Modify: `supabase/functions/complete-upload/index.ts`

- [ ] **Step 1: Write failing contract tests for a valid version-3 manifest and invalid versions, coordinate spaces, durations, coverage, paths, and byte sizes.**

- [ ] **Step 2: Write handler tests rejecting artifacts outside `<user>/<session>/pose/`, non-JSON paths, and manifests whose duration disagrees with the video.**

- [ ] **Step 3: Add migration columns.**

```sql
alter table public.analysis_sessions
  add column if not exists pose_artifact_path text,
  add column if not exists pose_manifest jsonb,
  add column if not exists pose_query_plan jsonb,
  add column if not exists pose_query_results jsonb,
  add column if not exists pose_queries_completed_at timestamptz;
```

Add object/array checks, owned-path comments, and reanalysis reset behavior. Extend `analysis_input_strategy` with `video+pose` and `video+pose+keyframes` while retaining historical values.

- [ ] **Step 4: Implement closed version-3 manifest parsing and ownership validation in `complete-upload`.**

- [ ] **Step 5: Persist the path and manifest without copying the raw artifact into Postgres.**

- [ ] **Step 6: Re-run the contract and complete-upload tests until GREEN.**

### Task 5: Build the immutable neutral evidence index and query evaluator

**Files:**
- Create: `supabase/functions/_shared/pose-evidence-index.ts`
- Create: `supabase/functions/_shared/pose-evidence-index.test.ts`

- [ ] **Step 1: Write failing tests for all four operations using arbitrary joint names and synthetic frames.**

Required assertions:

- `trajectory` returns source coordinates unchanged;
- `relative_position` subtracts the requested reference joint only;
- `distance` uses Euclidean distance in the requested coordinate space;
- `angle` computes the three-point angle with the requested middle joint as vertex;
- confidence is the minimum visibility/presence of involved joints;
- returned samples retain source timestamp and source-frame index;
- missing joints produce missing samples and lower coverage;
- no interpolation occurs;
- uniform bounding selects real source frames including the first and last eligible frames;
- input artifacts remain immutable.

- [ ] **Step 2: Verify RED because the index and evaluator do not exist.**

- [ ] **Step 3: Implement the closed query schema.**

```ts
export type PoseQuery = {
  id: string;
  operation: "trajectory" | "relative_position" | "distance" | "angle";
  coordinateSpace: "image_normalized" | "world_camera_relative";
  joints: string[];
  startMs: number;
  endMs: number;
  maxSamples: number;
};
```

Enforce operation-specific joint counts, unique query IDs, maximum twelve queries, maximum 240 samples per query, valid timestamps, and known joints.

- [ ] **Step 4: Implement `createPoseEvidenceIndex` and `executePoseQueries` as pure functions.**

- [ ] **Step 5: Include coordinate system, units, requested sample count, returned sample count, coverage, and limitations in every result.**

- [ ] **Step 6: Add a vocabulary guard test proving production processor source contains no exercise names or terms such as `fault`, `rep`, `correct`, `acceptable`, or `symmetry`.**

- [ ] **Step 7: Run the focused evaluator test and confirm GREEN.**

### Task 6: Let Gemini request the measurements

**Files:**
- Create: `supabase/functions/_shared/pose-query-planner.ts`
- Create: `supabase/functions/_shared/pose-query-planner.test.ts`
- Modify: `supabase/functions/_shared/gemini-video.ts`
- Modify: `supabase/functions/_shared/gemini-video.test.ts`

- [ ] **Step 1: Write failing planner-parser tests for zero queries, valid arbitrary queries, too many queries, incorrect joint counts, unknown joints, out-of-range timestamps, and malformed JSON.**

- [ ] **Step 2: Write a Gemini interaction test proving the planner receives the original video, resolved foundation, and neutral manifest—but not raw frames, old wrist events, equipment proxies, technique profiles, or coaching thresholds.**

- [ ] **Step 3: Define a strict JSON schema whose only output is `{ queries: PoseQuery[] }`.**

- [ ] **Step 4: Implement the planner prompt.**

The prompt must state:

```text
Choose measurements only when they can resolve a visible uncertainty from this video.
The processor does not know the exercise and will not judge the result.
Request arbitrary joints and time windows using only the supplied universal operations.
Do not request measurements for hidden body parts. Return zero queries when pose data cannot help.
```

- [ ] **Step 5: Add `planPoseQueries` to the existing Gemini service using low-variance generation and high thinking.**

- [ ] **Step 6: Retry malformed planner JSON once with the exact parser error; after a second failure return planner-unavailable rather than inventing a query.**

- [ ] **Step 7: Run planner and Gemini tests until GREEN.**

### Task 7: Insert resumable planning and evaluation stages

**Files:**
- Modify: `supabase/functions/analyze-video/handler.ts`
- Modify: `supabase/functions/analyze-video/handler.test.ts`
- Modify: `supabase/functions/analyze-video/index.ts`
- Modify: `supabase/functions/analysis-status/index.ts`
- Modify: `src/features/analysis/api.ts`
- Modify: `src/features/analysis/api.test.ts`
- Modify: `src/features/analysis/progress-stages.ts`
- Modify: `src/features/analysis/progress-stages.test.ts`
- Modify: `src/screens/analysis-progress/index.tsx`
- Modify: `src/screens/analysis-progress/analysis-progress.test.tsx`

- [ ] **Step 1: Extend session and dependency types with artifact path, manifest, query plan, and query results.**

- [ ] **Step 2: Write failing handler tests for this state sequence.**

```text
video_processing
  -> pose_query_planning when foundation + valid pose manifest exist
  -> pose_querying after a valid plan is saved
  -> technique_review after results are saved
```

Also test zero-query plans, missing artifacts, invalid owned JSON, storage read failure, planner failure, query failure, polling resume, and video-only fallback.

- [ ] **Step 3: Add dependencies `planPoseQueries`, `loadPoseArtifact`, `savePoseQueryPlan`, `executePoseQueries`, and `savePoseQueryResults`.**

- [ ] **Step 4: Validate the downloaded artifact before indexing; never trust the stored manifest alone.**

- [ ] **Step 5: Ensure each poll performs at most one expensive model/storage stage and returns HTTP 202 with the new observable stage.**

- [ ] **Step 6: Add compatible API schemas and progress copy for `pose_query_planning` and `pose_querying`.**

- [ ] **Step 7: Re-run handler, API, and progress tests until GREEN.**

### Task 8: Ground coaching claims in requested query results

**Files:**
- Modify: `supabase/functions/_shared/analysis-contract.ts`
- Modify: `supabase/functions/_shared/analysis-contract.test.ts`
- Modify: `supabase/functions/_shared/analysis-prompt.ts`
- Modify: `supabase/functions/_shared/analysis-prompt.test.ts`
- Modify: `supabase/functions/_shared/gemini-video.ts`
- Modify: `supabase/functions/_shared/gemini-video.test.ts`
- Modify: `supabase/functions/_shared/scorecard.ts`
- Modify: `supabase/functions/_shared/scorecard.test.ts`

- [ ] **Step 1: Add failing contract tests for optional `measurementIds` on each evidence moment.**

The parser must reject unknown query IDs and query windows that do not overlap the evidence window.

- [ ] **Step 2: Write prompt tests proving coaching receives only the validated plan/results and labels world depth as estimated and camera-relative.**

- [ ] **Step 3: Add query provenance to the coaching prompt without making pose results authoritative over video.**

- [ ] **Step 4: Validate all cited query IDs after Gemini generation. Strip uncited unused results from persisted user-facing output.**

- [ ] **Step 5: Require exact video evidence for every correction even when a pose query supports it. A pose query alone cannot make a finding scoreable.**

- [ ] **Step 6: Make low-coverage or depth-limited query support reduce evidence confidence or remain a stated limitation; never silently upgrade it.**

- [ ] **Step 7: Re-run contract, prompt, Gemini, and scorecard tests until GREEN.**

### Task 9: Remove the legacy wrist architecture from the active path

**Files:**
- Modify: `modules/form-motion-tracker/ios/FormMotionTrackingEngine.swift`
- Modify: `modules/form-motion-tracker/src/FormMotionTracker.types.ts`
- Modify: `src/features/tracking/tracker-summary.ts`
- Modify: `supabase/functions/_shared/motion-evidence.ts`
- Modify: `supabase/functions/_shared/motion-evidence.test.ts`
- Modify: `scripts/run-current-bench-analysis.mts`

- [ ] **Step 1: Add regression tests proving new uploads and prompts contain none of `repCandidates`, `motion_reversal`, or `hand_proxy`.**

- [ ] **Step 2: Remove `MotionSample`, wrist-Y event construction, local repetition candidates, and fake equipment paths from the native result after the TypeScript boundary no longer consumes them.**

- [ ] **Step 3: Keep the native pass limited to pose frames, camera metadata, quality, progress, partial status, and limitations.**

- [ ] **Step 4: Remove version-2 motion compaction from the new production path while retaining a compatibility parser for historical stored results.**

- [ ] **Step 5: Update the benchmark runner to compare strict video-only against Gemini-requested pose evidence using the same raw artifact and query evaluator as production.**

- [ ] **Step 6: Run tracking and motion-evidence regression tests until GREEN.**

### Task 10: Reanalysis, deletion, security, and full verification

**Files:**
- Modify: `supabase/migrations/202607190021_gemini_requested_pose_evidence.sql`
- Modify: `supabase/functions/delete-analysis/handler.ts`
- Modify: `supabase/functions/delete-analysis/handler.test.ts`
- Modify: existing reanalysis migration/function tests as required
- Modify: `scripts/run-current-bench-analysis.mts`

- [ ] **Step 1: Add tests proving saved-video reanalysis reuses only an owned existing pose artifact and regenerates the query plan/results.**

- [ ] **Step 2: Add tests proving analysis deletion removes the entire session prefix, including `pose/landmarks-v3.json`.**

- [ ] **Step 3: Add security tests for cross-user paths, oversized artifacts, invalid JSON, unknown joints, query amplification, NaN/Infinity values, and timestamp denial-of-service cases.**

- [ ] **Step 4: Run all focused tests.**

```powershell
npx jest --runInBand src/features/tracking/pose-evidence-artifact.test.ts src/features/tracking/tracking-plan.test.ts src/features/analysis/api.test.ts src/features/capture/upload-coordinator.test.ts supabase/functions/_shared/pose-evidence-contract.test.ts supabase/functions/_shared/pose-evidence-index.test.ts supabase/functions/_shared/pose-query-planner.test.ts supabase/functions/create-analysis/handler.test.ts supabase/functions/complete-upload/handler.test.ts supabase/functions/analyze-video/handler.test.ts supabase/functions/_shared/gemini-video.test.ts supabase/functions/_shared/analysis-contract.test.ts supabase/functions/_shared/scorecard.test.ts supabase/functions/delete-analysis/handler.test.ts
```

- [ ] **Step 5: Run repository verification.**

```powershell
npx jest --runInBand
npx tsc --noEmit
npx expo lint
npx expo-doctor
git diff --check
```

Expected: all tests and static checks pass with no new warnings.

- [ ] **Step 6: Build the iOS development client because the native result interface changes.**

Verify the MediaPipe model is bundled, `FormMotionTracker.isAvailable` is true, a real saved recording produces a version-3 artifact, progress reaches completion or an honest partial state, and video-only fallback still works.

- [ ] **Step 7: Run at least thirty labeled recordings across press, pull, squat, hinge, lunge, curl, carry, core, machine, and bodyweight families in shadow mode.**

Report for video-only versus requested-pose runs:

- recognition agreement;
- complete-cycle repetition agreement;
- correction agreement;
- timestamp error;
- unsupported-claim rate;
- false-high score rate;
- query count and cited-query rate;
- pose coverage and missing-data rate;
- total latency and added planner/evaluator latency.

- [ ] **Step 8: Enable pose assistance only if the benchmark gates improve or preserve every safety/quality metric without unacceptable latency.**

If the gates fail, retain the implementation in shadow mode and report the failing recordings and exact query evidence. Do not tune exercise-specific thresholds to rescue the benchmark.

## Execution handoff

Execute inline in this session using `superpowers:executing-plans`. Start with Task 1 and follow strict RED-GREEN-REFACTOR. Do not deploy migrations or Edge Functions and do not create a git commit until the user explicitly authorizes those actions.
