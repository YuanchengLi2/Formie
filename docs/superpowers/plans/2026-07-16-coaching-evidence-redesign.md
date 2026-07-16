# Coaching Evidence Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the supplied Coach and Coaching Review designs, improve Gemini's coaching-point and peak-frame selection, and mount the supplied recording animation without changing Analysis Progress.

**Architecture:** Keep analysis truth in the existing structured result contract. Add one deterministic top-correction precision target before premium review, then render all supported correction/cue evidence through one synchronized review model. Load the selected analysis into Coach so its signed video and evidence remain visible beside the conversation.

**Tech Stack:** Expo Router, React Native, expo-video, React Native Gesture Handler, Jest/RNTL, Supabase Edge Functions, Gemini video structured output.

---

### Task 1: Evidence selection and precision verification

**Files:**
- Modify: `supabase/functions/_shared/analysis-prompt.ts`
- Modify: `supabase/functions/_shared/gemini-video.ts`
- Test: `supabase/functions/_shared/analysis-prompt.test.ts`
- Test: `supabase/functions/_shared/gemini-video.test.ts`

- [ ] Add failing tests requiring exhaustive phase/rep scanning and a high-resolution top-correction timestamp/focus review target.
- [ ] Run `npx jest supabase/functions/_shared/analysis-prompt.test.ts supabase/functions/_shared/gemini-video.test.ts --runInBand` and confirm the new expectations fail.
- [ ] Add a bounded helper that inserts one technique target for the first priority correction unless that finding already has a timestamp/technique target.
- [ ] Strengthen the prompt to seek all distinct material corrections while explicitly forbidding invented filler and to choose the frame where the claimed displacement is maximal.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Synchronized Coaching Review UI

**Files:**
- Modify: `src/features/analysis/review-frames.ts`
- Modify: `src/features/analysis/review-frames.test.ts`
- Modify: `src/screens/results/index.tsx`
- Modify: `src/screens/results/results.test.tsx`
- Modify: `src/components/full-recording.tsx`
- Test: `src/components/full-recording.test.ts`

- [ ] Add failing tests showing all supported corrections and cues become selectable coaching points and each purpose stays attached to the selected evidence timestamp.
- [ ] Run the focused review/results tests and confirm the new expectations fail.
- [ ] Replace the duplicated results sections with the supplied Coaching Review hierarchy: title/score/count, player, point navigation, three-purpose panel, compact summary, remember cue, Coach/example actions, visibility note, and Record Another Set.
- [ ] Keep timeline dots, AI focus circle, fullscreen, playback, and finding deep dives wired to the selected verified evidence.
- [ ] Update the player hint to explain outward zoom and inward return to full frame.
- [ ] Run the focused review/results tests and confirm they pass.

### Task 3: Video-aware Coach workspace

**Files:**
- Modify: `src/app/(tabs)/(coach)/index.tsx`
- Modify: `src/screens/coach/index.tsx`
- Modify: `src/screens/coach/coach.test.tsx`

- [ ] Add failing tests for horizontal video selection, selected analysis/video context, quick prompts, target context, and anchored send/retry behavior.
- [ ] Run `npx jest src/screens/coach/coach.test.tsx --runInBand` and confirm the new expectations fail.
- [ ] Load the selected session through `getAnalysisStatus` and render its signed recording plus evidence context above the conversation on phones and beside it on wide layouts.
- [ ] Implement the supplied Coach header, recording selector, analysis-context chips, starter prompt grid, message cards, and persistent composer.
- [ ] Run the focused Coach tests and confirm they pass.

### Task 4: Supplied Recording Tips motion

**Files:**
- Modify: `src/screens/recording-tips/index.tsx`
- Modify: `src/screens/recording-tips/recording-tips.test.tsx`
- Modify: `src/components/production-motion.tsx`

- [ ] Add a failing test expecting the camera setup animation rather than the legacy static PNG.
- [ ] Run `npx jest src/screens/recording-tips/recording-tips.test.tsx --runInBand` and confirm it fails.
- [ ] Mount `ProductionMotion kind="cameraSetup"` with contained framing; the project asset hash already matches the supplied ZIP MP4.
- [ ] Run the focused Tips test and confirm it passes.

### Task 5: Verification and live function update

**Files:**
- Verify all modified files.

- [ ] Run focused client and edge-function tests.
- [ ] Run `npm test -- --runInBand`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run lint`.
- [ ] Run the Android export command used by this repository.
- [ ] Deploy only the changed `analyze-video` function after local verification, then inspect its live version/status.
- [ ] Review `git diff --check` and the final status without staging unrelated user changes.
