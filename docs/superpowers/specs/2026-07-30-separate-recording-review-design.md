# Separate Recording Review

## Goal

Replace the combined clip-review and Set Details screen with two distinct pages. The user, rather than an automated camera check, decides whether the recording is worth submitting.

## Flow

1. Camera completion routes to `/analysis/review`.
2. `/analysis/review` displays only the retained clip and recording-quality guidance.
3. `Use This Recording` navigates to `/analysis/set-details` without uploading or spending an analysis.
4. `/analysis/set-details` collects the existing exercise, amount, load, side, and focus fields.
5. `Submit for Analysis` starts the existing upload flow and spends one analysis.
6. `Retake` discards the retained clip and returns to Recording Tips.

Saved-video reanalysis follows the same review-to-details path so no retained recording can be rejected by the removed automatic preflight.

## Clip Review Page

The page uses the existing dark Formie palette with deliberate text hierarchy:

- Gold uppercase eyebrow: `FINAL CHECK`
- Large white headline: `Is this recording ready?`
- Muted supporting copy explaining that the clip should be watched before continuing
- Native playable video with controls
- Four compact quality checks with gold numbered markers:
  - Choose a side or 45-degree angle
  - Keep the full movement visible
  - Keep the phone level and stable
  - Make important details easy to see
- Muted disclaimer explaining that framing, angle distortion, and movement visibility affect feedback quality
- Gold warning card: `Submitting this recording will use 1 analysis. Make it count.`
- Primary action: `Use This Recording`
- Secondary action: `Retake`

The warning describes the consequence of continuing through the flow, but no analysis is consumed until the later submit action.

## Set Details Page

The page contains the existing authoritative set fields and no clip preview, camera tips, disclaimer, or duplicate review warning. Its title returns to `Tell Formie what you did`, and its primary action remains `Submit for Analysis`.

## Navigation and State

Both routes read the retained recording and declaration from the existing capture store. If the recording is missing or the capture phase is invalid, either route redirects to the camera. Android hardware back remains consumed while a retained recording is owned by this flow, preventing accidental loss. Retake resets the upload coordinator, discards the recording, and returns to Recording Tips.

## Verification

Tests must prove:

- Camera completion still enters `/analysis/review`.
- Clip Review renders the video, styled guidance, warning, and both actions.
- `Use This Recording` navigates to `/analysis/set-details` without starting upload.
- Set Details contains the form without duplicate clip-review content.
- `Submit for Analysis` dispatches the declaration and upload events.
- Retake discards the recording.
- Fresh and recovered recordings bypass automatic recording preflight.
- TypeScript, lint, focused route/UI suites, LAN Metro status, and a cold iOS bundle pass.
