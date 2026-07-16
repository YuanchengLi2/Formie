# Coach Workspace, Tips Motion, and Zoom Design

## Scope

Redesign only the Coach tab. Home, Progress, and Profile keep their current layouts. Replace the Recording Tips hero's static mockup with the supplied camera setup loop, and make the review player's pinch behavior clearly work in both directions.

## Coach workspace

The selected recording remains visible while the user talks to FORM Coach. On phones, the screen uses a compact video/context panel above a flexible conversation region. On wider layouts, video context and conversation become two columns. The composer remains anchored above the safe area and keyboard.

The header identifies the selected exercise and exposes one clear Change video action. Video selection uses horizontally scrollable, generous cards instead of a tall divider list. A selected-video context card contains the playable recording when a URL is available, the exercise name, date, score or limited-analysis state, and an optional target-area control.

An empty conversation shows concise horizontal starter prompts: check form, target-muscle fit, and next-set changes. Messages use readable coach cards rather than many narrow bubbles. User messages remain visually distinct. Loading, send failure, retry, and draft preservation continue to work.

## Recording Tips motion

The Tips hero mounts `ProductionMotion` with the `cameraSetup` source. That source is the byte-identical `animations/camera-setup-loop.mp4` from `FORM_VISUAL_ASSET_PACK (2).zip`. The animation loops silently, has no controls, and uses a contained fit so the supplied framing is not cropped.

## Review-player zoom

Pinching outward zooms toward the existing 2.5x maximum. Pinching inward returns smoothly toward the fitted 1x full-frame view; it does not shrink the video below its fitted size. The copy explicitly says `pinch in to return to full frame`, and the existing Full Frame control remains as an accessible reset. AI focus circles and manual zoom continue to use the current focus transformation path.

## Verification

Tests cover horizontal video selection, persistent selected-video context, starter prompts, target-area disclosure, send/retry behavior, the Tips motion source, and inward zoom clamping to 1x. Verification includes focused Jest tests, the full Jest suite, TypeScript, lint, and Android export.
