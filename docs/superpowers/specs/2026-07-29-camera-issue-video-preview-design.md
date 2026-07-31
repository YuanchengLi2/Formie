# Camera Issue Video Preview Design

## Goal

Show the actual device-local recording on the rejected camera-readiness screen so the user can compare the visible clip with Formie's rejection reason and personalized camera guidance.

## Scope

- Show the video only when the camera-readiness result is `rerecord`.
- Keep `checking` and `unavailable` screens focused on their existing jobs.
- Do not upload, copy, or persist another version of the recording.
- Do not add a bypass that lets a rejected recording continue to analysis.

## Experience

The rejected screen becomes vertically scrollable. Its content order is:

1. Recording warning and rejection title.
2. An inline player containing the complete recorded clip.
3. The evidence-based rejection reason.
4. Camera placement, camera angle, and framing guidance.
5. The existing `Re-record this set` action.

The player uses the existing device-local URI, fills the available card width, keeps a stable widescreen presentation, and has native play, pause, and scrubbing controls. It starts muted and loops so users can repeatedly inspect the framing problem without replaying manually.

## Component Boundaries

`AnalysisReviewRoute` owns the retained recording and passes `recording.localUri` to `RecordingPreflightScreen` for the rejected state.

`RecordingPreflightScreen` owns only presentation. A small video-preview component encapsulates Expo Video lifecycle and keeps playback behavior out of the rejection copy.

## Failure Handling

If the local player cannot load, the rejection reason, guidance, and re-record action remain usable. Playback failure must not allow the rejected recording to continue.

## Verification

- A screen test proves the rejected state renders the provided local video URI with controls and still shows all guidance.
- A route test proves the current recording URI is passed to the rejected screen.
- Existing tests continue to prove there is no `Use recording anyway` bypass.
- TypeScript, lint, focused tests, and the full Jest suite must pass.
