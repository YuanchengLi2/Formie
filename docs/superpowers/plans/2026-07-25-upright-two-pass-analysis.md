# Upright Two-Pass Analysis Implementation Plan

> **For this workspace:** `AGENTS.md` forbids subagents. Execute this plan inline in the current session with test-first checkpoints.

**Goal:** Preserve the complete recording, make its visual orientation unambiguous, let Gemini 3.6 Flash independently recheck the exercise and movement path, and display four concise coaching sentences together for every issue.

**Architecture:** A local Expo module exports the full video with its preferred transform baked into upright pixels and no trim or crop. The canonical backend runs two full-video Gemini 3.6 Flash analyst calls at requested 12 FPS, high media resolution, and high thinking: a provisional whole-movement read followed by a final issue-discovery pass that owns recognition, corrections, and score. Gemini 3.1 Flash Lite remains text-only and may change wording only.

**Tech Stack:** Expo 54, Expo Modules API, Swift/AVFoundation, Kotlin/Media3, TypeScript, Supabase Edge Functions, Gemini GenerateContent API, Jest.

## Global Constraints

- Preserve the complete source duration; never trim or crop the analysis input.
- Bake the preferred display transform into the uploaded analysis artifact so model pixels are upright.
- Both video calls use `gemini-3.6-flash`, requested 12 FPS, `MEDIA_RESOLUTION_HIGH`, and high thinking.
- The final analyst pass must rewatch the complete video and may correct the provisional exercise name, findings, praise, and score.
- For every exact exercise, compare the observed implement and working-elbow endpoints with the mechanically appropriate body landmarks; a controlled but incorrect path is still a correction.
- Do not hardcode “elbow toward hip” as the answer for a named exercise.
- Do not rank corrections or select a primary correction.
- The writer uses `gemini-3.1-flash-lite`, receives no video, and cannot add, remove, merge, or contradict issues.
- Display observation, visible effect, action, and success check together as one three-or-four-sentence paragraph.

---

### Task 1: Full-length upright analysis artifact

**Files:**
- Create: `modules/form-video-normalizer/expo-module.config.json`
- Create: `modules/form-video-normalizer/src/FormVideoNormalizer.ts`
- Create: `modules/form-video-normalizer/ios/FormVideoNormalizerModule.swift`
- Create: `modules/form-video-normalizer/android/src/main/java/app/form/coach/videonormalizer/FormVideoNormalizerModule.kt`
- Create: `src/features/capture/video-normalizer.ts`
- Create: `src/features/capture/video-normalizer.test.ts`
- Modify: `src/features/analysis/api.ts`
- Modify: `src/features/capture/types.ts`
- Modify: `src/features/capture/upload-coordinator.ts`
- Modify: `src/features/capture/analysis-upload-coordinator.ts`

**Interfaces:**
- `normalizeVideoForAnalysis(localUri: string): Promise<{ uri: string; durationPreserved: true }>`
- `UploadTarget.analysisInput: UploadArtifactTarget`
- `completeAnalysisUpload(..., analysisInput: { durationPreserved: true })`

- [ ] Write a failing coordinator test proving both the original and normalized full-length artifact are uploaded before completion.
- [ ] Run the focused capture tests and confirm the missing normalized upload fails.
- [ ] Scaffold the local native module and implement full-duration preferred-transform export on Apple and Android.
- [ ] Wire the normalized artifact to `analysis-input.mp4` and send non-trimming metadata.
- [ ] Run the focused capture tests and confirm they pass.

### Task 2: Two full-video Gemini analyst passes

**Files:**
- Modify: `supabase/functions/analyze-video/single-pass-runner.ts`
- Modify: `supabase/functions/analyze-video/single-pass-runner.test.ts`
- Modify: `supabase/functions/analyze-video/index.ts`
- Modify: `supabase/functions/analyze-video/single-pass-index-wiring.test.ts`
- Modify: `supabase/functions/_shared/single-pass-analysis.ts`
- Modify: `supabase/functions/_shared/single-pass-analysis.test.ts`

**Interfaces:**
- `advanceAnalystCoachPipeline` persists `provisionalDecision`, `analysisDecision`, and `writerCopy`.
- `buildFinalAnalysisPrompt(durationMs, provisionalDecision)` asks Gemini to independently rewatch and replace the provisional decision.

- [ ] Write failing runner and wiring tests requiring two Gemini 3.6 full-video calls and one text-only writer call.
- [ ] Write a failing prompt test requiring independent endpoint checks for the implement and working elbow relative to body landmarks.
- [ ] Run the focused backend tests and confirm failures are caused by the one-pass pipeline.
- [ ] Persist the provisional read in `video_index_v2`, persist the final read in `analysis_draft`, and resume safely from either stage.
- [ ] Make the final pass reject unsupported praise and inspect controlled-but-wrong movement paths.
- [ ] Run focused backend tests and confirm they pass.

### Task 3: One visible four-sentence coaching paragraph

**Files:**
- Modify: `src/features/analysis/review-frames.ts`
- Modify: `src/features/analysis/review-frames.test.ts`
- Modify: `src/screens/results/index.tsx`
- Modify: `src/screens/results/results.test.tsx`

**Interfaces:**
- `CoachingReviewPoint.paragraph` contains observation, visible effect, action, and optional success check.

- [ ] Write a failing presentation test requiring all four sentence roles in one paragraph.
- [ ] Write a failing screen test proving no coaching tabs hide the paragraph.
- [ ] Run the focused client tests and confirm the current tabbed UI fails.
- [ ] Build the deterministic paragraph from writer-owned sentence fields and render it in one card.
- [ ] Run focused client tests and confirm they pass.

### Task 4: Verify, deploy, and live-check the missed path

**Files:**
- Verify all modified files.
- Deploy: `supabase/functions/analyze-video`

- [ ] Run focused backend, capture, and result-screen tests.
- [ ] Run TypeScript checking.
- [ ] Run the complete Jest suite.
- [ ] Deploy `analyze-video` and confirm the downloaded deployed source matches the checkout.
- [ ] Reanalyze the saved row video and verify recognition, elbow/implement path findings, score, telemetry, and the four-sentence paragraph.
- [ ] Restart the app and provide the current QR code.
