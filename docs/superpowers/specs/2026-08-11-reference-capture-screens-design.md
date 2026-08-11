# Reference Capture Screens Design

**Date:** 2026-08-11

## Objective

Rebuild the Exercise Guide and Review Recording screens to match `ChatGPT Image Aug 11, 2026, 12_42_57 AM.png` as the visual contract while preserving live exercise, tutorial, recording, navigation, and subscription-quota data. The implementation must not flatten either screen into a screenshot or hardcode the example Dumbbell Step Up content.

## Visual Contract

Both screens use a pure-black background, white primary copy, muted gray supporting copy, thin dark-gray borders, and the existing Formie gold. Their content is anchored to a 390-point-wide phone viewport and adapts by reducing gaps and allowing vertical scrolling on shorter devices; it does not independently stretch individual elements.

The shared header sits below the safe area, uses a 42-point circular dark back control, and centers a gold title independently of the back control. Both screens own this header rather than mixing a native navigation header on one screen with an in-content header on the other.

### Exercise Guide

The screen renders, in order:

1. `Exercise Guide` header.
2. Dynamic canonical exercise name and dynamic formatted exercise family.
3. Dynamic tutorial card with 16:9 thumbnail, centered gold play button, tutorial title, and channel. The card remains pressable and opens the trusted tutorial URL.
4. A three-segment `Setup / Form / Safety` selector. `Setup` maps to `guide.setup`, `Form` maps to `guide.execution`, and `Safety` maps to `guide.safety`. The selected segment uses the reference gold fill.
5. One compact numbered list containing only the selected segment's steps.
6. A Camera Setup card using the first three nonempty `guide.cameraPlacement` entries, joined with centered dots. The card retains the existing phone-placement help action.
7. A full-width `Continue to Camera` button. Because the guide already contains camera setup guidance, the normal and rejected-recording flows proceed directly to `/camera`; the review flow continues to `/analysis/set-details` as it does today.

Loading keeps the header, exercise identity, tab shell, camera card shell, and CTA stable while showing a centered progress indicator in the tutorial/content region. Failure keeps the same structure, explains that the exercise-specific guide is unavailable, and exposes retry without preventing continuation.

### Review Recording

The screen renders, in order:

1. `Review Recording` header whose back action is the existing retake/discard behavior.
2. The real local recording in a bordered, rounded 16:10 preview.
3. Custom playback chrome matching the reference: centered play/pause control, lower play/pause control, gold elapsed track, elapsed time, and fullscreen control. Native controls are disabled so iOS cannot replace the specified geometry. Playback state comes from `expo-video` status, playing, and time-update events; seeking clamps to the real duration.
4. `Before you continue` and the exact supporting sentence from the reference.
5. A 2-by-2 checklist grid for Full body visible, Side angle, Phone level, and Good lighting. Each cell has a traced gold line icon and a gold checked indicator.
6. A gold-bordered quota card stating `1 analysis will be used` and the real balance after submission. If the current authoritative remaining value is `N`, the preview displays `max(0, N - 1) remaining this month`. Unknown balance displays `Balance updates after submission` and never invents a number.
7. Side-by-side `Record Again` and `Use Recording` actions. The first invokes the existing discard/retake path; the second retains the existing `/analysis/set-details` path.

## Component Boundaries

`CaptureScreenHeader` owns safe-area header geometry and back accessibility. `CaptureReferenceIcon` owns the traced vector paths and exposes only named variants and size/color. `ReferenceVideoControls` owns `expo-video` event subscriptions, time formatting, playback, seeking, and fullscreen presentation. The two screen components own layout and copy but do not fetch or mutate route data.

The app routes continue to own navigation, capture-store mutation, and access-provider reads. `AnalysisReviewRoute` passes the live remaining count into the presentation component. `ExerciseGuideRoute` continues to own guide loading/caching and supplies explicit back/continue callbacks.

## Data and Error Behavior

- No example content from the mockup is hardcoded except fixed interface copy.
- Tutorial presses continue to open `tutorial.url` externally.
- The review quota is derived from `AccessProvider`; it is informational only and does not reserve or decrement quota early.
- The actual quota decrement remains authoritative at the existing analysis reservation boundary.
- Video loading or playback failure leaves retake and use-recording actions available and announces a concise accessible error.
- Android hardware back on Review Recording retains the current discard-and-retake behavior.

## Verification

Jest component tests lock the reference hierarchy, copy, tab mapping, button actions, quota derivation, playback control accessibility, and critical geometry. Route tests lock live access wiring and navigation behavior. TypeScript and Expo lint verify integration. A deterministic 390-by-844 render is used for visual inspection, followed by a short-height render to prove that content remains reachable without overlapping the action row.

