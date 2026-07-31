# Generic Tracker Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not use subagents for this repository.

**Goal:** Repair the 24 FPS generic tracking evidence path so Gemini receives complete, honestly labeled motion evidence and strict audited coaching.

**Architecture:** The native tracker remains exercise-agnostic and emits raw/generic motion evidence. Client selection produces exact semantic candidates plus phase-diverse coverage frames, while Supabase normalizes transport formats, injects preflight results, and independently verifies severe coaching claims.

**Tech Stack:** Expo 54, React Native, Swift, MediaPipe Pose Landmarker, Supabase Edge Functions, Gemini Interactions API, Jest, TypeScript.

---

### Task 1: Lock transport and schema failures into tests

**Files:**
- Modify: `supabase/functions/_shared/gemini-video.test.ts`
- Modify: `supabase/functions/analyze-video/handler.test.ts`

- [ ] Add a failing test proving QuickTime uploads and Interactions input use `video/mov`.
- [ ] Add a failing test proving the generation schema omits duplicate `videoCheck` and the validated preflight value is injected before contract validation.
- [ ] Run the focused tests and confirm the expected failures.

### Task 2: Repair Gemini transport and generation

**Files:**
- Modify: `supabase/functions/_shared/gemini-video.ts`
- Modify: `supabase/functions/analyze-video/handler.ts`
- Modify: `supabase/functions/analyze-video/index.ts`
- Create: `supabase/migrations/202607180019_tracking_benchmark_stabilization.sql`

- [ ] Normalize `video/quicktime` to `video/mov` at upload and inference boundaries.
- [ ] Generate without duplicate `videoCheck`, inject the preflight result, and validate the full contract.
- [ ] Allow private JPEG keyframes in the existing video bucket.
- [ ] Run focused tests until green.

### Task 3: Make generic keyframe evidence honest and phase-diverse

**Files:**
- Modify: `src/features/tracking/tracking-plan.test.ts`
- Modify: `src/features/tracking/tracking-plan.ts`
- Modify: `src/features/capture/analysis-upload-coordinator.ts`
- Modify: `supabase/functions/_shared/gemini-video.test.ts`
- Modify: `supabase/functions/_shared/gemini-video.ts`

- [ ] Add failing tests for coverage labels, exact-event preservation, and filling 8-12 slots from real quality-approved tracking frames.
- [ ] Represent keyframe purpose explicitly as `event`, `rep`, or `coverage`.
- [ ] Preserve exact event timestamps; omit low-quality events and use quality-approved frames only for coverage.
- [ ] Describe frames honestly in Gemini input.
- [ ] Run focused tests until green.

### Task 4: Verify severe findings and visible advice

**Files:**
- Modify: `supabase/functions/_shared/gemini-video.test.ts`
- Modify: `supabase/functions/_shared/gemini-video.ts`
- Modify: `supabase/functions/_shared/analysis-prompt.ts`

- [ ] Add a failing test that a high-severity correction is reviewed even with zero requested precision runs.
- [ ] Add prompt/verification rules rejecting hidden activation, force, pressure, pain, and intent claims.
- [ ] Ensure review can reject an incorrect semantic phase or evidence peak.
- [ ] Run focused tests until green.

### Task 5: Improve processing and evidence UI

**Files:**
- Modify: `src/features/capture/analysis-upload-coordinator.ts`
- Modify: `src/features/capture/capture-store.ts`
- Modify: `src/features/capture/capture-store.test.ts`
- Modify: `src/screens/coach/index.tsx`
- Modify: `src/screens/results/index.tsx`
- Modify: `src/screens/results/results.test.tsx`

- [ ] Add failing tests for tracker progress and tenths-second evidence timestamps.
- [ ] Surface 24 FPS movement-mapping progress during processing.
- [ ] Use precise evidence timestamps in results while preserving `peakMs` seeking.
- [ ] Run focused UI tests until green.

### Task 6: Verify and benchmark

**Files:**
- Verify all modified files and migration.

- [ ] Run focused Jest suites, the full Jest suite, TypeScript, lint, and Expo Doctor.
- [ ] Deploy the migration and affected functions with tracking still in `shadow`.
- [ ] Rerun the exact incline-bench recording through video-only and tracker-assisted analysis.
- [ ] Inspect the selected evidence frames and compare recognition, reps, top correction, and peak timestamps.
- [ ] Keep assist disabled unless the evidence demonstrates improvement without new unsupported claims.
