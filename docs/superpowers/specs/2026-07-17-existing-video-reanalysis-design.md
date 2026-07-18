# Existing Video Reanalysis Design

## Goal

Give developers testing Formai in Expo Go or another development build a fast way to rerun an existing saved recording through the current analysis pipeline without recording or uploading the video again.

## User Experience

In development only, the results screen for every saved analysis with a retained video shows a clearly labeled `Debug: Reanalyze Video` action near the existing `Record Another Set` action. Production bundles do not render the action.

Tapping the action immediately replaces the existing result. While the request starts, the action is disabled and shows `Resetting analysis…`. After the backend accepts the request, the app navigates to the existing analysis-progress screen for the same session. The normal progress stages run, and completion returns the developer to the refreshed results screen.

If the request fails before reanalysis starts, the current result remains visible and the screen shows an actionable error. Repeated taps cannot start concurrent reanalyses.

## Backend Flow

A new authenticated `reanalyze-video` Edge Function accepts only `{ sessionId }`.

The function:

1. Confirms the session belongs to the authenticated user.
2. Confirms the original `video_path` and duration still exist.
3. Clears the previous analysis result and derived session fields while preserving the session ID, original video path, duration, creation time, pin state, and previous-session relationship.
4. Clears stale Gemini file references, preflight data, draft analysis, tutorial selection, failure state, recognition fields, and completion time.
5. Deletes the session's stale coaching thread so future chat is grounded in the refreshed result.
6. Sets the session to the beginning of the existing analysis pipeline.

The existing `analyze-video` function then uploads the retained video to Gemini and progresses normally. No video object is copied, downloaded to the phone, or uploaded by the user again.

## App Architecture

- Add a typed `reanalyzeAnalysis` request to the existing analysis API module, using the current authenticated request/error-handling path.
- Add a React Query mutation at the results route. On success, remove stale analysis queries, invalidate history, and replace the route with `/analysis/[session-id]`.
- Add `onReanalyze`, `reanalyzing`, and optional error props to `ResultsScreen`, and gate the control with a `showDebugReanalysis` prop supplied from `__DEV__` at the route boundary.
- Keep presentation styling consistent with the current gold/charcoal visual system while making the debug status unmistakable. `Record Another Set` remains the primary action.

## Error Handling

- `401`: ask the user to sign in again through the existing API error messaging.
- `404`: the analysis does not exist or is not owned by the user.
- `409`: the original video is no longer available or the session is already being reanalyzed.
- `500`: preserve the current result when the reset cannot be completed.

The reset operation must be atomic so a partial database update cannot leave the session without either its old result or a valid queued reanalysis state.

## Data Integrity

A database function performs the session reset, result removal, and coaching-thread removal in one transaction. It verifies ownership using the authenticated user ID passed by the Edge Function. Storage is untouched.

## Testing

- Edge handler tests cover authorization, ownership, missing video, concurrent reanalysis, success, and backend failure.
- Database reset behavior is represented by the handler dependency contract and verified after migration deployment.
- Client API tests cover request shape, response parsing, and server errors.
- Results-screen tests cover development-only visibility, the callback, loading state, and error state.
- Route tests cover mutation success navigation and query/history invalidation where practical.
- Full Jest, TypeScript, and live Edge Function checks run before QR delivery.

## Out of Scope

- Preserving old analysis revisions.
- Copying the source video into a second storage object.
- Reanalysis from history cards without first opening the result.
- A production-visible reanalysis feature.
- Changing Gemini models, pricing, or the analysis prompt as part of this feature.
