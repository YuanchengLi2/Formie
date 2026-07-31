# Staged Generic Evidence Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repository instructions prohibit subagents.

**Goal:** Replace the monolithic Gemini analysis path with compact generic evidence, independent foundation consensus, exact-frame continuation, retried audits, and verified-only scoring.

**Architecture:** The native tracker preserves generic 24 FPS evidence while a shared compiler caps model input. Two independent foundation passes resolve identity and repetitions before coaching generation. Candidate findings request exact native frames and only verified evidence reaches server score arithmetic.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, Swift/AVFoundation, MediaPipe Pose Landmarker Heavy, Supabase Edge Functions/Postgres/Storage, Gemini Interactions API, Jest.

## Global Constraints

- No exercise-specific native or server coaching rules.
- No separate worker and no custom equipment model.
- iOS tracking remains 24 FPS with honest partial results.
- Existing video-only clients and historical results remain compatible.
- Existing uncommitted user changes are preserved; no commits are created without explicit authorization.

---

### Task 1: Shared evidence compiler

**Files:**
- Create: `supabase/functions/_shared/motion-evidence.ts`
- Create: `supabase/functions/_shared/motion-evidence.test.ts`
- Modify: `supabase/functions/analyze-video/index.ts`
- Modify: `scripts/run-current-bench-analysis.mts`

**Interfaces:**
- Produces `compactMotionEvidence(summary: Record<string, unknown> | null): Record<string, unknown> | null`.
- Enforces removal of `overlayFrames`, deterministic limits of 16 events, 16 event frames, 120 points per equipment path, and a 24 KB JSON ceiling.

- [ ] Write tests proving UI overlay frames are removed, ordering is deterministic, equipment paths are sampled across their full duration, and oversized summaries remain under 24 KB.
- [ ] Run `npx jest --runInBand supabase/functions/_shared/motion-evidence.test.ts` and verify failure because the module is missing.
- [ ] Implement `compactMotionEvidence` with immutable input handling and confidence-preserving deterministic sampling.
- [ ] Route both production evidence loading and the benchmark runner through the compiler.
- [ ] Re-run the focused test and `npx tsc --noEmit`.

### Task 2: Foundation consensus

**Files:**
- Create: `supabase/functions/_shared/analysis-foundation.ts`
- Create: `supabase/functions/_shared/analysis-foundation.test.ts`
- Modify: `supabase/functions/_shared/gemini-video.ts`
- Modify: `supabase/functions/_shared/gemini-video.test.ts`

**Interfaces:**
- Produces `AnalysisFoundation` containing recognition, set context, repetition timeline, confidence, and audit status.
- Produces `reconcileFoundations(primary, audit, adjudication)` which never trusts confidence alone.

- [ ] Write failing tests for matching foundations, high-confidence identity disagreement, repetition disagreement, successful adjudication, and unavailable adjudication.
- [ ] Run the focused tests and verify missing exports fail.
- [ ] Implement foundation schemas, parsers, normalized identity comparison, and conservative reconciliation.
- [ ] Add two independent foundation interactions, optional adjudication, and low-variance generation configuration.
- [ ] Pin the resolved foundation into coaching generation before full contract validation.
- [ ] Re-run foundation and Gemini video tests.

### Task 3: Exact-frame request contract

**Files:**
- Create: `src/features/analysis/exact-frame-requests.ts`
- Create: `src/features/analysis/exact-frame-requests.test.ts`
- Modify: `src/features/analysis/api.ts`
- Modify: `src/features/capture/types.ts`
- Modify: `supabase/functions/create-analysis/handler.ts`
- Modify: `supabase/functions/create-analysis/handler.test.ts`
- Create: `supabase/migrations/202607190020_staged_exact_frame_evidence.sql`

**Interfaces:**
- Produces `ExactFrameRequest { requestId, findingId, peakMs, timestampsMs }` with five source-frame timestamps clamped to video duration.
- Adds fifteen `exactFrameUploads` to create-analysis responses.

- [ ] Write failing request-generation and API-schema tests.
- [ ] Verify failures for missing request generator and response fields.
- [ ] Implement generic five-frame windows at `peakMs + [-2,-1,0,1,2] * 1000/24`.
- [ ] Preallocate fifteen private JPEG upload paths and add persistence columns.
- [ ] Re-run focused tests.

### Task 4: Exact-frame upload and resume

**Files:**
- Create: `supabase/functions/complete-exact-frames/handler.ts`
- Create: `supabase/functions/complete-exact-frames/handler.test.ts`
- Create: `supabase/functions/complete-exact-frames/index.ts`
- Modify: `supabase/functions/analyze-video/handler.ts`
- Modify: `supabase/functions/analyze-video/handler.test.ts`
- Modify: `supabase/functions/analyze-video/index.ts`
- Modify: `supabase/functions/analysis-status/index.ts`
- Modify: `src/app/analysis/[session-id].tsx`
- Create: `src/features/capture/exact-frame-upload.ts`
- Create: `src/features/capture/exact-frame-upload.test.ts`

**Interfaces:**
- Produces `uploadRequestedExactFrames(recording, requests, targets)` with request-ID deduplication and cleanup.
- `analyze-video` returns pending requests at `exact_frame_review`; `complete-exact-frames` persists only paths owned by the session user.

- [ ] Write failing handler and client tests for pause, upload, deduplication, cleanup, resume, and 20-second fallback.
- [ ] Implement request persistence after candidate findings and status payload fields.
- [ ] Implement native extraction/upload using the existing generic `extractKeyframes` API.
- [ ] Implement authenticated completion and resume polling.
- [ ] Re-run focused server/client tests.

### Task 5: Retried audits and exact evidence gating

**Files:**
- Modify: `supabase/functions/_shared/gemini-video.ts`
- Modify: `supabase/functions/_shared/gemini-video.test.ts`
- Modify: `supabase/functions/_shared/scorecard.ts`
- Modify: `supabase/functions/_shared/scorecard.test.ts`

**Interfaces:**
- Audit interactions retry once with parser feedback.
- Findings lacking an exact-frame window cannot independently support a score criterion above 0.74 confidence.

- [ ] Write failing tests for malformed-first-valid-second audit, two malformed audits, exact-frame confirmation, and unsupported-score evidence removal.
- [ ] Implement a two-attempt structured audit helper without changing score arithmetic.
- [ ] Require exact frame windows in the coaching-evidence review input when available and record missing windows explicitly.
- [ ] Re-run Gemini and scorecard tests.

### Task 6: Status UI, compatibility, and verification

**Files:**
- Modify: `src/features/analysis/api.test.ts`
- Modify: `src/features/analysis/progress-stages.ts`
- Modify: `src/screens/analysis-progress/analysis-progress.test.tsx`
- Modify: `src/screens/analysis-progress/index.tsx`
- Modify: `src/features/analysis/result-schema.ts`
- Modify: `supabase/functions/_shared/result-payload.ts`

**Interfaces:**
- Adds the `exact_frame_review` progress stage and optional pending request fields without breaking old responses.

- [ ] Write failing API and UI tests for exact-frame status and historical responses.
- [ ] Implement compatible schemas and progress copy.
- [ ] Run all focused tests, then `npx jest --runInBand`, `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor`, and `git diff --check`.
- [ ] Build the iOS development client and verify the artifact only if native Swift or module interfaces changed.
- [ ] Deploy migrations and changed Edge Functions only after all local verification passes.
- [ ] Run the same bench recording through the shared benchmark runner and report recognition stability, rep consensus, retained findings, exact timestamps, score status, latency, and remaining failures.
