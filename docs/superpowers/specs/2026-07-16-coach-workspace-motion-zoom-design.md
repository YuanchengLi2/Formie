# Coach Workspace, Coaching Review, Evidence, Tips Motion, and Zoom Design

## Scope

Redesign the Coach tab and the post-analysis Coaching Review page from the two supplied mockups. Home, Progress, Profile, and Analysis Progress keep their current layouts. Replace the Recording Tips hero's static mockup with the supplied camera setup loop, and make the review player's pinch behavior clearly work in both directions.

## Coach workspace

The selected recording remains visible while the user talks to FORM Coach. On phones, the screen uses a compact video/context panel above a flexible conversation region. On wider layouts, video context and conversation become two columns. The composer remains anchored above the safe area and keyboard.

The header identifies the selected exercise and exposes one clear Change video action. Video selection uses horizontally scrollable, generous cards instead of a tall divider list. A selected-video context card contains the playable recording when a URL is available, the exercise name, date, score or limited-analysis state, and an optional target-area control.

An empty conversation shows concise horizontal starter prompts: check form, target-muscle fit, and next-set changes. Messages use readable coach cards rather than many narrow bubbles. User messages remain visually distinct. Loading, send failure, retry, and draft preservation continue to work.

## Post-analysis Coaching Review

The result becomes a single focused review loop: exercise and score, playable recording with coaching markers, previous/next coaching-point controls, and three purpose tabs for What happened, Why it matters, and What to do next. The selected tab and point always seek the player to their own supporting peak timestamp. A compact set summary, memorable cue, Coach action, example action, camera-visibility disclosure, and Record Another Set action follow without duplicating the same correction in multiple vertical cards.

The point count includes every supported correction and coaching cue rather than only the priority-correction array. Multiple distinct evidence moments remain independently selectable. Controls use at least 44-by-44 touch targets.

## Evidence quality

Gemini must scan setup plus early, middle, and late repetitions and return every distinct material improvement it can support, up to the existing safe limit, instead of defaulting to two generic findings. It must not invent extra issues merely to reach a number.

The primary correction receives a focused high-resolution verification pass even when the first pass reports high confidence. That pass must re-check the exact peak frame, evidence interval, point location, and point-specific advice against the original video. Revised evidence replaces the first-pass evidence; unsupported findings are rejected. The UI always seeks to the verified `peakMs` and uses the verified source-frame focus coordinates.

## Recording Tips motion

The Tips hero mounts `ProductionMotion` with the `cameraSetup` source. That source is the byte-identical `animations/camera-setup-loop.mp4` from `FORM_VISUAL_ASSET_PACK (2).zip`. The animation loops silently, has no controls, and uses a contained fit so the supplied framing is not cropped.

## Review-player zoom

Pinching outward zooms toward the existing 2.5x maximum. Pinching inward returns smoothly toward the fitted 1x full-frame view; it does not shrink the video below its fitted size. The copy explicitly says `pinch in to return to full frame`, and the existing Full Frame control remains as an accessible reset. AI focus circles and manual zoom continue to use the current focus transformation path.

## Verification

Tests cover horizontal video selection, persistent selected-video context, starter prompts, target-area disclosure, send/retry behavior, Coaching Review point coverage and purpose navigation, top-correction precision targeting, the Tips motion source, and inward zoom clamping to 1x. Verification includes focused Jest tests, edge-function tests, the full Jest suite, TypeScript, lint, and Android export.
