# Formai Motion Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The user explicitly prohibited subagents.

**Goal:** Finish Formai's analysis, tips, results, playback, Coach, and Gemini video-detail polish while preserving the current architecture.

**Architecture:** Add small Reanimated presentation components around existing data and interaction boundaries rather than changing navigation or persistence. Keep full-video Gemini analysis authoritative, with a high-resolution primary pass and the existing focused verification pass.

**Tech Stack:** Expo SDK 54, React Native 0.81, Reanimated 4, expo-video, Jest, TypeScript, Supabase Edge Functions, Gemini GenerateContent API.

## Global Constraints

- Work inline with no subagents.
- Preserve the existing dark, restrained, gold-accented visual system.
- Do not add a worker, pose-tracking dependency, or local frame-extraction pipeline.
- Do not show fake progress percentages.
- Keep Expo Go compatibility.
- Preserve all unrelated working-tree changes.

---

### Task 1: Stage-aware analysis motion and animated tips

**Files:**
- Create: `src/components/analysis-progress-motion.tsx`
- Create: `src/components/analysis-progress-motion.test.tsx`
- Modify: `src/screens/analysis-progress/index.tsx`
- Modify: `src/screens/analysis-progress/analysis-progress.test.tsx`
- Modify: `src/screens/recording-tips/index.tsx`
- Modify: `src/screens/recording-tips/recording-tips.test.tsx`

**Interfaces:**
- Produces: `AnalysisProgressMotion({ stage }: { stage: string | null })` and stable test IDs for the active scan stage and staggered Tips checklist.

- [ ] **Step 1: Write failing motion tests**

```tsx
expect(screen.getByTestId("analysis-progress-native-motion")).toBeTruthy();
expect(screen.getByTestId("analysis-motion-coaching").props.accessibilityState).toEqual({ selected: true });
expect(screen.getAllByTestId(/recording-tip-row-/)).toHaveLength(4);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx jest --runInBand src/components/analysis-progress-motion.test.tsx src/screens/analysis-progress/analysis-progress.test.tsx src/screens/recording-tips/recording-tips.test.tsx`

Expected: FAIL because the native motion component and checklist test IDs do not exist.

- [ ] **Step 3: Implement native motion and staggered entrances**

Create a Reanimated component with one repeating scan shared value, pulsing evidence nodes, and three stage chips derived from `analysisProgress(stage)`. Mount it instead of `ProductionMotion kind="analysisProgress"`. Wrap Tips sections and checklist rows in `Animated.View` with `FadeInDown.duration(220).delay(...)` and `LinearTransition`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: all listed suites pass.

### Task 2: Animate Results evidence transitions and player markers

**Files:**
- Modify: `src/components/full-recording.tsx`
- Modify: `src/components/full-recording.test.ts`
- Modify: `src/screens/results/index.tsx`
- Modify: `src/screens/results/results.test.tsx`

**Interfaces:**
- Produces: keyed coaching-panel transitions, selected-marker state, and accessible evidence selection that remains synchronized with `FullRecording`.

- [ ] **Step 1: Write failing Results tests**

```tsx
expect(screen.getByTestId("active-coaching-panel").props.accessibilityLabel).toContain("What happened");
await fireEvent.press(screen.getByText("Why it matters"));
expect(screen.getByTestId("active-coaching-panel").props.accessibilityLabel).toContain("Why it matters");
expect(screen.getAllByTestId(/timeline-evidence-marker-/).length).toBeGreaterThan(0);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx jest --runInBand src/components/full-recording.test.ts src/screens/results/results.test.tsx`

Expected: FAIL because transition and marker test IDs are absent.

- [ ] **Step 3: Implement keyed transitions and animated markers**

Use `Animated.View` with `FadeInRight.duration(180)`, `FadeOutLeft.duration(140)`, and `LinearTransition`. Give each timeline marker a stable test ID and animate its scale using a short timing transition while preserving its `Pressable` hit target and accessibility label.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: both suites pass.

### Task 3: Finish Coach scrolling, evidence context, and message motion

**Files:**
- Modify: `src/screens/coach/index.tsx`
- Modify: `src/screens/coach/coach.test.tsx`

**Interfaces:**
- Produces: a selected-evidence context label, animated message cards, and a conversation scroll ref that moves to the latest assistant response.

- [ ] **Step 1: Write failing Coach tests**

```tsx
expect(screen.getByTestId("coach-evidence-context")).toHaveTextContent("Level the shoulders");
await fireEvent.press(screen.getByText("Send"));
await waitFor(() => expect(screen.getByTestId("coach-message-assistant")).toBeTruthy());
```

- [ ] **Step 2: Run the Coach test and verify RED**

Run: `npx jest --runInBand src/screens/coach/coach.test.tsx`

Expected: FAIL because evidence context and message IDs are absent.

- [ ] **Step 3: Implement Coach motion and scrolling**

Add a `ScrollView` ref for the conversation, call `scrollToEnd({ animated: true })` after message-count changes, render the selected timestamp/title above the composer, and wrap starters/messages with short staggered Reanimated entrances. Keep optimistic send, error retry, and draft restoration unchanged.

- [ ] **Step 4: Run the Coach test and verify GREEN**

Run the Step 2 command. Expected: the suite passes.

### Task 4: High-resolution primary Gemini pass and complete verification

**Files:**
- Modify: `supabase/functions/_shared/gemini-video.ts`
- Modify: `supabase/functions/_shared/gemini-video.test.ts`

**Interfaces:**
- Produces: primary `generateContent` requests with `generationConfig.mediaResolution = "MEDIA_RESOLUTION_HIGH"`, full-file video metadata at 18 FPS, and no primary offsets.

- [ ] **Step 1: Write a failing Gemini request test**

```ts
expect(body.contents[0].parts[0].videoMetadata).toEqual({ fps: 18 });
expect(body.generationConfig.mediaResolution).toBe("MEDIA_RESOLUTION_HIGH");
```

- [ ] **Step 2: Run the focused Gemini test and verify RED**

Run: `npx jest --runInBand supabase/functions/_shared/gemini-video.test.ts`

Expected: FAIL because the primary request does not yet set high media resolution.

- [ ] **Step 3: Add high media resolution to the primary generation config**

Add `mediaResolution: "MEDIA_RESOLUTION_HIGH"` beside `responseMimeType` and `responseJsonSchema` in `generateAnalysis`; do not add `startOffset` or `endOffset` to the primary video metadata.

- [ ] **Step 4: Run full verification**

Run:

```text
npx jest --runInBand
npx tsc --noEmit
npm run lint
npx expo-doctor
npx expo export --platform android --output-dir dist-android-final
git diff --check
npx supabase migration list --linked
```

Expected: all commands exit zero, every migration appears in both Local and Remote columns, and the Android export completes.

- [ ] **Step 5: Verify the active Expo session and clean generated exports**

Confirm `/status` returns `packager-status:running` and `/_expo/link?platform=android` redirects to the active Formai tunnel. Resolve the absolute paths of `dist-android-check` and `dist-android-final`, confirm both are inside the Formai workspace, then remove only those generated export directories.
