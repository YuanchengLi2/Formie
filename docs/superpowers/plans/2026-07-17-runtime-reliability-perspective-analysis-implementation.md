# Formai Runtime Reliability and Perspective Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship reliable long-set recording, observable analysis progress, perspective-aware full-video coaching, distinct detail pages, smooth playback, and a generated movement-analysis animation.

**Architecture:** Preserve the Gemini-only pipeline and single primary full-video request. Make backend progress a resumable persisted state machine, strengthen the existing structured-output contract, and repair client presentation and playback at their current boundaries.

**Tech Stack:** Expo SDK 54, React Native, Expo Router, Expo Camera, Expo Video, Reanimated, React Query, Supabase Edge Functions/Postgres, Gemini Files and Generate Content APIs, Jest.

---

### Task 1: Align long-set recording limits

**Files:**
- Modify: `src/features/capture/video-settings.ts`
- Modify: `src/features/capture/countdown.ts`
- Modify: `supabase/functions/complete-upload/handler.ts`
- Create: `supabase/migrations/202607170015_long_set_and_analysis_draft.sql`
- Test: `src/features/capture/video-settings.test.ts`
- Test: `src/features/capture/countdown.test.ts`
- Test: `supabase/functions/complete-upload/handler.test.ts`

- [ ] Write tests expecting a 90-second camera maximum, 90-second normalized metadata, and acceptance of `90_000` by `complete-upload`.
- [ ] Run the focused tests and confirm they fail on the current 30/60-second limits.
- [ ] Update the shared limits and replace the database `duration_ms` constraint with `3000..90000`.
- [ ] Add nullable `analysis_sessions.analysis_draft jsonb` in the same migration.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Persist every real analysis stage

**Files:**
- Modify: `supabase/functions/analyze-video/handler.ts`
- Modify: `supabase/functions/analyze-video/index.ts`
- Test: `supabase/functions/analyze-video/handler.test.ts`

- [ ] Add failing handler tests proving preflight returns at `video_processing`, the next request returns at `technique_review`, generation saves a draft and returns at `coaching`, and the next request resumes verification from that draft.
- [ ] Run the handler suite and confirm the stage assertions fail.
- [ ] Add `analysisDraft`, `saveDraft`, and `clearDraft` boundaries and implement one durable transition per invocation.
- [ ] Clear the draft in final result persistence and preserve retry behavior for interrupted sessions.
- [ ] Re-run the handler suite and confirm it passes.

### Task 3: Enforce whole-set and perspective-aware output

**Files:**
- Modify: `supabase/functions/_shared/analysis-prompt.ts`
- Modify: `supabase/functions/_shared/analysis-contract.ts`
- Modify: `supabase/functions/analyze-video/index.ts`
- Test: `supabase/functions/_shared/analysis-prompt.test.ts`
- Test: `supabase/functions/_shared/analysis-contract.test.ts`
- Test: `supabase/functions/_shared/gemini-video.test.ts`

- [ ] Add failing prompt tests for camera direction, foreshortening, perspective distortion, overlap, apparent scale, same-phase comparison, and visible-reference limits.
- [ ] Add failing contract tests for duplicate finding/action IDs and rep-total/timeline mismatches.
- [ ] Confirm the primary Gemini request still contains the whole file at 18 FPS, high resolution, and no offsets.
- [ ] Implement prompt and contract validation without adding a routine model request.
- [ ] Bump the stored analysis version and re-run the focused suites.

### Task 4: Show every supported coaching point and distinct detail context

**Files:**
- Modify: `src/features/analysis/review-frames.ts`
- Modify: `src/features/analysis/result-store.ts`
- Modify: `src/screens/results/index.tsx`
- Modify: `src/screens/finding-detail/index.tsx`
- Modify: `src/app/results/[session-id]/finding/[finding-id].tsx`
- Test: `src/features/analysis/review-frames.test.ts`
- Test: `src/features/analysis/result-store.test.ts`
- Test: `src/screens/results/results.test.tsx`
- Test: `src/screens/finding-detail/finding-detail.test.tsx`

- [ ] Add failing tests showing strengths, corrections, cues, and all next-set actions remain reachable.
- [ ] Add failing tests for section-aware lookup and issue-specific detail context including affected reps and recurring/isolated state.
- [ ] Implement the smallest presentation changes that satisfy those tests.
- [ ] Re-run the focused UI and analysis suites.

### Task 5: Stabilize tap and drag playback

**Files:**
- Modify: `src/components/full-recording.tsx`
- Test: `src/components/full-recording.test.ts`

- [ ] Add failing tests for local-coordinate tap seeking, page-coordinate drag seeking, and movement-threshold classification.
- [ ] Replace interval polling with Expo Video `timeUpdate` and `playingChange` subscriptions.
- [ ] Separate Pressable taps from thresholded PanResponder drags and commit one seek on release.
- [ ] Re-run the playback and Results/Detail suites.

### Task 6: Generate and integrate the analysis animation

**Files:**
- Create: `assets/production/analysis-movement-sprite.png`
- Modify: `src/components/analysis-progress-motion.tsx`
- Modify: `src/screens/analysis-progress/analysis-progress.test.tsx`

- [ ] Generate a four-panel project-bound sprite sheet with the built-in image generation tool using the approved current style.
- [ ] Inspect the generated image for consistent subject, equal panels, no text, and no watermark; save it in the project.
- [ ] Add a failing component test expecting the generated movement sprite.
- [ ] Implement frame cropping and stage-aware native transitions with a reduced-motion-safe still state.
- [ ] Re-run the animation and progress suites.

### Task 7: Verify, deploy, and hand off

**Files:**
- Modify only files required by verification failures.

- [ ] Run all 55+ Jest suites and confirm zero failures.
- [ ] Run `npx tsc --noEmit`, `npm run lint`, and `npx expo-doctor`.
- [ ] Export Android with `npx expo export --platform android --output-dir dist-android-runtime-repair`.
- [ ] Apply the linked migration and deploy `analyze-video`, `complete-upload`, `analysis-status`, and `coach-chat` if shared contracts changed.
- [ ] Verify deployed migration/function versions.
- [ ] Start or reuse one confirmed Expo tunnel, verify local and external `/status`, regenerate and decode `form-expo-qr.png`, and return the exact link.

