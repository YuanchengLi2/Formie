# Reference Capture Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline. The user explicitly prohibited subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the supplied Exercise Guide and Review Recording mockup with live Formie data and behavior, matching its visual hierarchy and geometry instead of substituting a static image.

**Architecture:** Keep route/state responsibilities in the existing Expo Router files and move reusable visual behavior into three focused components: a safe-area capture header, traced reference icons, and custom video controls. The screen components remain pure presentations driven by typed props; access and capture stores remain the authoritative data sources.

**Tech Stack:** Expo SDK 54, React Native 0.81, Expo Router 6, `expo-video` 3, `react-native-svg` installed with Expo-compatible versioning, Jest, and Testing Library React Native.

## Global Constraints

- Do not use subagents.
- Preserve live exercise, tutorial, recording, and quota data; do not hardcode `Dumbbell Step Up`, `3:24`, or `9 remaining`.
- Treat `ChatGPT Image Aug 11, 2026, 12_42_57 AM.png` as the visual contract for hierarchy, proportions, copy, colors, borders, and actions.
- Keep quota mutation at the existing reservation boundary; the Review Recording balance is a non-mutating projection of the post-submit value.
- Keep every interactive element accessible by role and label.
- Use test-first changes and verify the focused suite, typecheck, and lint before completion.

## File Map

- Create `src/components/capture-screen-header.tsx`: shared custom safe-area header with centered title and circular back button.
- Create `src/components/capture-reference-icon.tsx`: named SVG icon renderer for back, play, camera, chevron, quota, full-body, side-angle, phone, lighting, check, and fullscreen glyphs traced to the mockup.
- Create `src/components/reference-video-controls.tsx`: custom `expo-video` preview and playback chrome, including time updates, seek gestures, and fullscreen.
- Create `src/components/reference-video-controls.test.tsx`: playback-state, time-format, seek, and accessibility regression coverage.
- Modify `src/screens/exercise-guide/index.tsx`: replace stacked guide sections with the reference tutorial card, segment selector, compact numbered list, camera card, stable loading/error states, and CTA.
- Modify `src/screens/exercise-guide/exercise-guide.test.tsx`: lock tab/data mapping, tutorial action, camera help, loading/error behavior, CTA copy, and reference geometry.
- Modify `src/app/exercise-guide.tsx`: pass explicit back navigation and route normal/rejected continuation directly to camera while preserving review flow behavior.
- Modify `src/features/capture/exercise-guide-route.test.tsx`: verify back behavior and the updated camera route for normal/rejected flows.
- Modify `src/screens/recording-review/index.tsx`: replace the long editorial list with the exact checklist grid, live quota card, shared header/video controls, and side-by-side actions.
- Create `src/screens/recording-review/recording-review.test.tsx`: component-level reference hierarchy, quota projection, unknown quota, and action behavior.
- Modify `src/app/analysis/review.tsx`: read `useAccess()`, pass live remaining balance, and expose the existing retake callback as visual back behavior.
- Modify `src/features/capture/post-recording-route.test.tsx`: mock live access, assert quota wiring, exact labels, and unchanged navigation/store transitions.
- Modify `src/app/_layout.tsx`: hide the native Exercise Guide header because the shared in-screen header becomes authoritative.
- Modify `package.json` and `package-lock.json`: record the Expo-compatible `react-native-svg` dependency.

---

### Task 1: Install the supported vector runtime and add reference primitives

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/capture-reference-icon.tsx`
- Create: `src/components/capture-screen-header.tsx`
- Test: `src/screens/exercise-guide/exercise-guide.test.tsx`

**Interfaces:**
- Produces: `CaptureReferenceIcon({ name, size, color })` where `name` is `"back" | "play" | "pause" | "camera" | "chevron" | "quota" | "fullBody" | "sideAngle" | "phone" | "lighting" | "check" | "fullscreen"`.
- Produces: `CaptureScreenHeader({ title, onBack, testID? })` with a 42-point back target and independently centered title.

- [ ] **Step 1: Add a failing header expectation to the Exercise Guide test**

Render the screen with `onBack={jest.fn()}` and assert that `Exercise Guide` is present, `Go back from Exercise Guide` is pressable, and the header test ID flattens to a 56-point content height with an absolutely centered title.

- [ ] **Step 2: Run the focused test and verify the new contract fails**

Run: `npx jest --runInBand src/screens/exercise-guide/exercise-guide.test.tsx`

Expected: FAIL because `onBack` and the custom header do not exist.

- [ ] **Step 3: Install the Expo-compatible SVG renderer**

Run: `npx expo install react-native-svg`

Expected: `package.json` and `package-lock.json` add the SDK-compatible version with no unrelated dependency upgrades.

- [ ] **Step 4: Implement exact reusable vector and header primitives**

In `capture-reference-icon.tsx`, use a 24-by-24 `Svg` viewBox and explicit `Path`, `Circle`, `Rect`, and `Line` geometry for every named icon. Default to `colors.gold`, `strokeLinecap="round"`, and `strokeLinejoin="round"`; do not use Unicode glyphs whose rendering changes by font.

In `capture-screen-header.tsx`, use `useSafeAreaInsets()`, a 56-point row, 20-point horizontal padding, a 42-point circular `Pressable` with `colors.surface`, and an absolute full-width title layer with `pointerEvents="none"`. Give the back button `accessibilityLabel={`Go back from ${title}`}`.

- [ ] **Step 5: Run the focused test**

Run: `npx jest --runInBand src/screens/exercise-guide/exercise-guide.test.tsx`

Expected: the new header assertions pass once Task 2 integrates the header; existing assertions may remain red until the screen rewrite is complete.

### Task 2: Rebuild Exercise Guide around the reference hierarchy

**Files:**
- Modify: `src/screens/exercise-guide/index.tsx`
- Modify: `src/screens/exercise-guide/exercise-guide.test.tsx`

**Interfaces:**
- Consumes: `CaptureScreenHeader` and `CaptureReferenceIcon` from Task 1.
- Produces: `ExerciseGuideScreen` with new required `onBack: () => void`; all existing guide, retry, tutorial, camera-help, and continue props remain.

- [ ] **Step 1: Replace broad section assertions with failing reference-layout tests**

Add tests that assert:

```tsx
expect(screen.getByText("One-Arm Dumbbell Row")).toBeTruthy();
expect(screen.getByText("Row")).toBeTruthy();
expect(screen.getByText("Setup")).toBeTruthy();
expect(screen.getByText("Form")).toBeTruthy();
expect(screen.getByText("Safety")).toBeTruthy();
expect(screen.getByText("Drive the working elbow toward your hip.")).toBeTruthy();
expect(screen.queryByText("Brace one hand on a stable bench.")).toBeNull();
expect(screen.getByText("Camera Setup")).toBeTruthy();
expect(screen.getByLabelText("Continue to Camera")).toBeTruthy();
```

Press `Setup`, assert setup replaces execution, then press `Safety` and assert safety replaces setup. Assert the numbered-list container, tutorial card, selector, camera card, and CTA test IDs have reference widths/radii/min-heights.

- [ ] **Step 2: Run the Exercise Guide test to verify failure**

Run: `npx jest --runInBand src/screens/exercise-guide/exercise-guide.test.tsx`

Expected: FAIL on missing custom header, tabs, and updated CTA.

- [ ] **Step 3: Implement the compact reference layout**

Use `useState<"setup" | "form" | "safety">("form")` and select exactly one guide array. Use `useWindowDimensions()` only to decide compact vertical spacing when `height < 760`; keep horizontal padding at 20 and content width at the viewport minus 40.

Build the tutorial card with a 16:9 thumbnail area, `CaptureReferenceIcon name="play"`, a translucent gold circular play surface, and a compact footer. Keep the whole card as the existing tutorial press target.

Build the segment control as one 40-point bordered container with three equal presses. The active segment uses `colors.gold` and black text; inactive segments remain transparent with white text.

Build the step card with 44-point minimum rows, 32-point gold-soft number circles, and one-pixel separators. Build Camera Setup as a 72-point card with the camera icon, dynamic joined placement entries, and chevron; pressing it invokes `onOpenSpaceHelp`.

Render `Continue to Camera` with the existing `FormButton`, a 62-point height, and reference radius. Keep a stable shell for loading and error states so header/CTA positions do not jump.

- [ ] **Step 4: Run Exercise Guide tests**

Run: `npx jest --runInBand src/screens/exercise-guide/exercise-guide.test.tsx`

Expected: PASS for tab switching, tutorial, retry, camera help, back, loading, and CTA behavior.

### Task 3: Wire Exercise Guide navigation to the custom header and camera

**Files:**
- Modify: `src/app/exercise-guide.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/features/capture/exercise-guide-route.test.tsx`

**Interfaces:**
- Consumes: `ExerciseGuideScreen.onBack` from Task 2.
- Produces: a header-free Stack route with explicit `router.back()` and normal/rejected continuation to `/camera`.

- [ ] **Step 1: Write failing route expectations**

Update the route mock to expose `Go back from Exercise Guide` and `Continue to Camera`. Assert back calls `router.back()`. Assert normal flow replaces `{ pathname: "/camera", params: {} }`. For rejected flow, assert coordinator reset and `discard_recording` occur before replacing camera with the preserved `previousSessionId` parameter. Keep review flow expectation at `/analysis/set-details`.

- [ ] **Step 2: Run the route test and verify failure**

Run: `npx jest --runInBand src/features/capture/exercise-guide-route.test.tsx`

Expected: FAIL because the route still targets `/recording-tips` and does not pass `onBack`.

- [ ] **Step 3: Update route ownership**

Pass `onBack={() => router.back()}`. Replace normal and rejected recording-tip destinations with `/camera`, preserving `previousSessionId` params. Do not change the review-flow destination. In `_layout.tsx`, change the `exercise-guide` declaration to `options={{ headerShown: false }}` so two headers cannot render.

- [ ] **Step 4: Run component and route tests**

Run: `npx jest --runInBand src/screens/exercise-guide/exercise-guide.test.tsx src/features/capture/exercise-guide-route.test.tsx`

Expected: PASS.

### Task 4: Build deterministic custom recording playback controls

**Files:**
- Create: `src/components/reference-video-controls.tsx`
- Create: `src/components/reference-video-controls.test.tsx`

**Interfaces:**
- Consumes: `localVideoUri: string` and icons from Task 1.
- Produces: `ReferenceVideoControls({ localVideoUri })` and exported pure `formatPlaybackTime(seconds: number): string`.

- [ ] **Step 1: Write failing pure and component tests**

Test `formatPlaybackTime(0) === "0:00"`, `formatPlaybackTime(18.9) === "0:18"`, invalid values return `"0:00"`, and 65 seconds returns `"1:05"`. Mock `useVideoPlayer` with `play`, `pause`, `currentTime`, `duration`, and `timeUpdateEventInterval`; assert the component disables native controls, exposes `Play recording`, updates to `Pause recording`, renders elapsed time, and clamps seek positions to `[0, duration]`.

- [ ] **Step 2: Run the playback-control test and verify failure**

Run: `npx jest --runInBand src/components/reference-video-controls.test.tsx`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement real player-driven controls**

Create the player with `useVideoPlayer(localVideoUri, created => { created.loop = false; created.timeUpdateEventInterval = 0.25; })`. Subscribe with Expo's `useEvent` to `playingChange`, `statusChange`, and `timeUpdate`. Render `VideoView` with `nativeControls={false}`, `contentFit="contain"`, and fullscreen enabled.

Overlay a 72-point centered play/pause button. Add a bottom row with a 24-point play/pause target, a pressable measured progress track, elapsed time, and a fullscreen button backed by a `VideoView` ref. Convert press X to `duration * clamp(x / width, 0, 1)`. On ready-state failure, keep the video frame and expose an accessible playback-unavailable message without hiding surrounding screen actions.

- [ ] **Step 4: Run playback-control tests**

Run: `npx jest --runInBand src/components/reference-video-controls.test.tsx`

Expected: PASS.

### Task 5: Rebuild Review Recording and project the live quota

**Files:**
- Modify: `src/screens/recording-review/index.tsx`
- Create: `src/screens/recording-review/recording-review.test.tsx`

**Interfaces:**
- Consumes: `CaptureScreenHeader`, `CaptureReferenceIcon`, and `ReferenceVideoControls`.
- Produces: `RecordingReviewScreen({ localVideoUri, analysisRemaining, onUseRecording, onRetake })`, where `analysisRemaining: number | null`.

- [ ] **Step 1: Write failing reference-hierarchy tests**

Render with `analysisRemaining={10}` and assert the screen shows `Review Recording`, `Before you continue`, `A clear angle gives you a more accurate analysis.`, the four checklist labels, `1 analysis will be used`, `9 remaining this month`, `Record Again`, and `Use Recording`. Render with `analysisRemaining={null}` and assert `Balance updates after submission` appears while no numeric balance is invented. Press header back and `Record Again` and assert both call `onRetake`; press `Use Recording` and assert `onUseRecording` once.

- [ ] **Step 2: Run the new Review Recording test and verify failure**

Run: `npx jest --runInBand src/screens/recording-review/recording-review.test.tsx`

Expected: FAIL because the prop, grid, exact copy, and actions do not exist.

- [ ] **Step 3: Implement the reference screen**

Replace the editorial final-check hero and four stacked prose cards. Use `CaptureScreenHeader title="Review Recording" onBack={onRetake}` followed by the video controls. Render a 2-by-2 grid with equal cells, one-pixel shared borders, 58-point traced icons, 22-point checked circles, and the exact labels.

Derive `projectedRemaining` only when the input is finite: `Math.max(0, Math.floor(analysisRemaining) - 1)`. Place it below the one-analysis headline in the bordered quota card. Build a horizontal action row whose secondary and primary buttons use equal flex values and 62-point height; labels must exactly match the reference.

- [ ] **Step 4: Run Review Recording and video-control tests**

Run: `npx jest --runInBand src/screens/recording-review/recording-review.test.tsx src/components/reference-video-controls.test.tsx`

Expected: PASS.

### Task 6: Wire authoritative access data and preserve recording lifecycle

**Files:**
- Modify: `src/app/analysis/review.tsx`
- Modify: `src/features/capture/post-recording-route.test.tsx`

**Interfaces:**
- Consumes: `useAccess().access.remaining` and the Review Recording prop from Task 5.
- Produces: real quota projection with unchanged retake and submit navigation semantics.

- [ ] **Step 1: Update the route test to fail on missing live quota**

Mock `useAccess` with `access.remaining = 10`. Assert the rendered route displays `9 remaining this month`, no longer displays `FINAL CHECK`, and uses the exact action labels. Retain assertions that `Use Recording` replaces `/analysis/set-details` without changing the recorded phase. Add an assertion that header back performs the same coordinator reset, recording discard, and route replacement as `Record Again`.

- [ ] **Step 2: Run the route test and verify failure**

Run: `npx jest --runInBand src/features/capture/post-recording-route.test.tsx`

Expected: FAIL on missing access mock/wiring and old copy.

- [ ] **Step 3: Pass the provider value into the screen**

Import `useAccess`, read `const access = useAccess()`, and pass `analysisRemaining={access.access.remaining}`. Do not call `reserve`, mutate access, or publish an access event from this route. Keep the existing `retake` callback and Android hardware-back subscription unchanged, and pass that same callback to both visual back and record-again actions.

- [ ] **Step 4: Run the capture-flow regression suite**

Run: `npx jest --runInBand src/features/capture/post-recording-route.test.tsx src/screens/recording-review/recording-review.test.tsx`

Expected: PASS.

### Task 7: Full verification and visual acceptance

**Files:**
- Verify all files listed in the File Map.

**Interfaces:**
- Consumes: completed Tasks 1-6.
- Produces: evidence that the implementation is behaviorally integrated and visually stable.

- [ ] **Step 1: Run all focused tests together**

Run:

```powershell
npx jest --runInBand src/screens/exercise-guide/exercise-guide.test.tsx src/features/capture/exercise-guide-route.test.tsx src/components/reference-video-controls.test.tsx src/screens/recording-review/recording-review.test.tsx src/features/capture/post-recording-route.test.tsx
```

Expected: all suites and tests pass with no open handles.

- [ ] **Step 2: Run static validation**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run lint`

Expected: exit code 0, allowing only previously documented unrelated warnings and no new warnings in changed files.

- [ ] **Step 3: Inspect the final diff for scope and accidental hardcoding**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `rg -n "Dumbbell Step Up|3:24|9 remaining" src`

Expected: no hardcoded mock exercise, tutorial duration, or quota value in production code; test fixtures may contain explicit values only to verify dynamic projection.

- [ ] **Step 4: Render both target viewports**

Open the app at a 390-by-844 viewport and inspect Exercise Guide with a populated dynamic guide and Review Recording with a local clip and remaining balance of 10. Compare side-by-side with the supplied PNG for header position, 20-point gutters, tutorial/video card ratio, selector/grid geometry, CTA/action-row height, and absence of overlap. Repeat at 390-by-700 and confirm scrolling exposes every action without compressing the 44-point minimum targets.

- [ ] **Step 5: Record honest acceptance status**

Report focused test totals, typecheck/lint outcomes, and whether verification was source/test-only, browser-rendered, simulator-rendered, or confirmed on a physical device. Do not describe physical-device fidelity as confirmed without an actual device observation.

