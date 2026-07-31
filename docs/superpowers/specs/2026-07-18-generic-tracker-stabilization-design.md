# Generic Tracker Stabilization Design

## Goal

Make the iOS tracker reliably improve Gemini's evidence without allowing local code to make exercise-specific technique judgments. The tracker records generic motion at 24 FPS; Gemini remains the only semantic interpreter.

## Boundaries

- Analyze the entire saved iOS recording at a requested 24 FPS and return partial evidence honestly when the deadline or pose visibility prevents full coverage.
- Preserve normalized landmarks, estimated world landmarks, visibility, generic joint series, generic motion events, and hand-proxy equipment paths.
- Do not derive grip-width faults, bar-angle faults, exercise-specific range rules, or coaching conclusions locally.
- Send Gemini the original video, the validated tracker packet, and 8-12 source-resolution frames when enough valid frames exist.
- Distinguish coverage frames from generic motion-event and rep-candidate frames. Never describe a coverage frame as an exact event peak.
- Gemini owns exercise recognition, rep interpretation, visible technique findings, and advice. Local/server code owns validation, score arithmetic, audit reconciliation, evidence confidence gates, and unsupported-claim rejection.

## Data Flow

The native module scans the recording at 24 FPS and returns generic tracking evidence. The client builds candidates from generic events and rep candidates, then fills remaining keyframe slots from quality-approved tracked frames distributed across the actual visible portion of the set. Event timestamps remain exact; a poor event frame is omitted rather than silently shifted. Coverage frames may use the nearest valid tracked frame and are labeled only as coverage.

The upload coordinator sends video, tracker summary, and JPEG keyframes concurrently. Supabase accepts the JPEG artifacts. Gemini uploads normalize Apple's `video/quicktime` value to Gemini's supported `video/mov`. The Interactions generation schema omits the duplicate preflight `videoCheck`; the server injects the already-validated preflight value before validating the complete analysis contract.

Gemini receives honest text labels for each keyframe and a compact generic tracker packet. High-severity findings are automatically sent through a review slot even when the primary response does not request review. Review rejects or revises findings whose visible evidence, semantic phase, timestamp, or advice is unsupported. Internal claims about activation, pressure, force, pain, or intent are not accepted as visible evidence.

## UI

During native tracking, processing shows progress as movement mapping rather than appearing stalled during video upload. Evidence timestamps display tenths of a second so the selected moment is inspectable. Playback continues to seek to `peakMs`; overlays appear only at validated evidence moments and remain labeled `Estimated tracking`.

## Rollout and Verification

Tracking stays in `shadow` while repairs are tested. Unit and contract tests cover MIME normalization, generation-schema injection, honest keyframe labels, phase-diverse coverage, exact event preservation, high-severity review, advice filtering, progress copy, and timestamp precision. After local verification and deployment, the same incline-bench recording is rerun through strict video-only and tracker-assisted paths. Assist remains disabled until tracker assistance improves or preserves recognition, rep interpretation, correction quality, and evidence timing without introducing unsupported findings.
