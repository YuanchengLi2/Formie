# FORM Reliable Analysis and Video Coach Design

## Goal

Make FORM a reliable record-any-exercise coach: the user records a set, reaches analysis immediately, receives evidence-backed technique feedback, reviews multiple purpose-specific frames without losing focus-circle or zoom controls, and can start a separate AI Coach conversation by choosing one saved video.

## Product Promise

FORM is for someone trying an exercise and wanting to know what their visible technique suggests they should keep or change. It identifies the movement, rates the attempt only when the recording supports a trustworthy score, explains improvements for the next set, and lets the user consult a video-aware coach afterward.

FORM may explain whether visible setup and mechanics are consistent with emphasizing a target muscle. It must never claim that video proves muscle activation, joint loading, injury risk, pain cause, or a medical diagnosis.

## Confirmed Scope

- Recording remains exercise-selection-free.
- The empty Home state becomes a full-height recording invitation. Home with existing analyses remains visually unchanged.
- Recording Tips adds guidance to capture most of the body or the area being trained.
- Stopping a recording opens analysis immediately. Upload and completion continue on the analysis surface with retry support.
- The database and Edge Function agree on a 12 FPS requested analysis rate.
- Supabase Auth refresh runs only while the native app is active.
- The prerecorded full-screen analysis video is replaced by native, persisted-stage-driven progress UI.
- Only the Coach/results experience receives the less-vertical redesign. Progress and Profile remain unchanged.
- Premium runs appear as a compact receipt badge, not a full-width vertical card.
- Coaching timeline controls meet a minimum 44 by 44 point touch target.
- The results player adds a purpose carousel with multiple frames per purpose while preserving focus circles and pinch zoom.
- A dedicated AI Coach tab asks the user to choose a completed video before a conversation begins.
- A result screen also provides an Ask Coach action that preselects that result's video, while the dedicated tab never silently chooses a video.

## Rejected Approaches

### Constraint-only upload patch

Changing 12 back to 24 would stop the current database error, but the camera would still remain blocked during upload and the user would still see a generic failure surface. FORM needs a single upload contract and a dedicated upload/analysis handoff.

### Generic chatbot

A coach with no selected video would give generic fitness advice and could not ground responses in the user's recording. Every new conversation must be tied to one owned, completed analysis session.

### Generated example artwork

AI-generated exercise pictures could conflict with what the user actually did. The carousel instead uses timestamped frames from the user's recording, with the existing focus metadata, so every visual explanation remains evidence-grounded.

## Navigation and Screen Behavior

### Home

When analysis history has resolved and contains no sessions, Home renders a non-scrolling, full-height hero. The wordmark and profile button stay at the top; the record card consumes the remaining space and includes a visible Record an Exercise action. The empty Recent placeholder is removed.

When history contains sessions, the existing Home layout and recent-analysis rows remain unchanged. Loading history must not flash the enlarged empty state before saved sessions arrive.

### Recording Tips

The checklist includes: keep the important movement visible, frame as much of the body or target area as possible, stabilize the phone, and use 0.5x when space is limited. These are capture-quality hints, not exercise-selection requirements.

### Camera to Analysis

The camera owns capture only. When recording stops and a local file URI exists, it stores the recording, starts the upload state, and immediately replaces the camera route with `/analysis/upload`.

`/analysis/upload` owns session creation, signed upload, storage upload, and upload completion. It can reuse the session prepared during countdown. On success it replaces itself with `/analysis/[session-id]`. On failure it keeps the local URI, shows the actual typed error, and offers Retry Upload or Discard and Record Again.

This route boundary prevents camera unmounting from orphaning an in-flight upload and guarantees that post-recording UI always becomes analysis UI.

### Analysis Progress

Analysis Progress renders native components driven by persisted stages:

1. `uploading` - Securing your recording
2. `video_check` - Checking your recording
3. `video_processing` - Preparing the full video
4. `technique_review` - Reviewing visible technique
5. `coaching` - Preparing your coaching

The active row receives a restrained gold pulse and progress line. Completed rows show checks. The existing analysis figure remains centered and may use a subtle opacity/scale loop; a prerecorded full-screen UI movie is not rendered. A hidden text node continues exposing the raw stage for tests and accessibility diagnostics.

### Coach/results

The top result summary remains recognizable, but supporting information is reorganized horizontally:

- Exercise, score, and status stay in one compact header row.
- Coach's verdict and the compact premium-run badge share a summary row when space allows.
- The full recording and review carousel are the main content.
- Secondary material such as What Worked and Next Set Plan uses horizontally scrollable cards on phones and a two-column grid on wider screens.
- The existing detailed finding route remains available.

The premium badge shows `0`, `1`, or `N premium runs` plus a concise status. It does not list token counts or every pass in the primary results flow.

## Evidence Frame Carousel

The player presents three purpose tabs:

- **What happened** - timestamped visible evidence from priority corrections and coaching cues.
- **Why it matters** - the same grounded moments paired with each finding's `whyItMatters` explanation.
- **What to do next** - next-set actions linked through `relatedFindingId`; the linked finding's evidence provides the illustrative frames.

Each purpose may contain multiple items. Selecting a purpose preserves its last selected item. Previous and next buttons rotate within the active purpose, and a horizontal frame rail allows direct selection. Empty purposes are hidden rather than rendered disabled.

```ts
type ReviewPurpose = "observed" | "why" | "next";

type ReviewFrame = {
  id: string;
  purpose: ReviewPurpose;
  title: string;
  body: string;
  findingId: string;
  finding: CoachingFinding;
  evidence: EvidenceMoment;
  timeMs: number;
};
```

`buildReviewFrames(result)` is a pure function. It keeps every evidence moment, so one finding may contribute several frames. Duplicate frames are allowed across purposes because the explanation changes, but duplicate IDs within a purpose are not.

### Player interaction contract

- Selecting a frame pauses and seeks the player to `timeMs`.
- A focus region with confidence of at least `0.8` enables AI focus mode: 1.7x zoom, circle, arrow, and LOOK HERE label.
- Timeline markers retain a 14-point visual dot but receive a 44-point transparent Pressable target.
- Pinching changes to manual zoom without clearing the selected frame or its text.
- Manual zoom remains clamped between 1x and 2.5x.
- Show Full Frame removes auto zoom while keeping the selected frame and a correctly positioned focus circle.
- Restore AI Focus reapplies the 1.7x focus transformation.
- Reset from an unselected moment returns to 1x.
- Frame changes, timeline-dot presses, rep presses, play/pause, focus mode, and manual zoom all update one player state instead of competing states.

## AI Coach

### Entry behavior

The bottom navigation adds Coach as a fourth tab. Opening it starts at a video picker listing only owned analyses in `complete`, `partial`, or `unable` states. Each row shows exercise label, date, score when available, and analysis status. The user must choose a video before typing.

Ask Coach on a result routes to the Coach tab with that `sessionId` preselected. This is the only preselection path.

### Conversation behavior

Choosing a video creates or resumes a thread scoped to that analysis session. The header always shows which video is in context and provides Change Video. The composer supports text only in this version. Target muscle or training intent may be supplied as optional context and may be asked conversationally, but never blocks the first question.

The coach receives:

- the selected private video through Gemini Files,
- the structured analysis result,
- exercise recognition and uncertainty,
- timestamped evidence and focus metadata,
- the next-set plan,
- the bounded message history for this thread.

The coach answers with concise, video-specific pointers and references timestamps when discussing visible mechanics. If the video does not support a claim, it says so. It may explain how a visible change can bias an exercise toward or away from a target muscle, but it cannot claim measured activation.

### Persistence

`coach_threads` stores the owner, selected session, Gemini file metadata, optional target intent, and timestamps. `coach_messages` stores ordered user/assistant messages. Row-level security permits users to read and create only their own threads and messages. The service role performs model-file metadata updates.

```ts
type CoachMessage = {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};
```

The `coach-chat` Edge Function validates ownership, uploads the private video to Gemini when the thread has no active file, sends bounded conversation context plus the selected video and result, persists the response, and returns the saved assistant message. It never accepts arbitrary storage paths or client-supplied analysis content.

## Authentication Refresh

On web, Supabase keeps its normal visibility-aware refresh behavior. On iOS and Android, `AppProviders` registers one `AppState` listener. Active starts auth refresh; inactive and background stop it. The listener is removed on provider cleanup. Native client initialization does not leave an always-running ticker before the listener takes control.

## Upload Contract and Error Handling

The database migration drops the old `requested_fps = 24` constraint, sets the default to `12`, normalizes existing rows, and adds a `requested_fps = 12` constraint. Both complete-upload and analyze-video use the same exported constant.

Typed upload errors retain their code and message:

- local video unreadable,
- storage upload rejected,
- uploaded object not yet visible,
- authentication expired,
- completion update failed.

The completion function retries object visibility with bounded condition-based polling before returning `VIDEO_NOT_FOUND`. Database errors are logged server-side with session and error code but are not exposed verbatim to the client.

## Security and Privacy

- Videos remain in the private `analysis-videos` bucket.
- Coach endpoints derive user identity from the bearer token and verify session/thread ownership.
- Gemini and service-role keys remain server-only.
- Coach messages never accept HTML rendering.
- Model prompts include no raw secrets or signed URLs.
- A coach thread cannot switch its underlying session; Change Video creates or resumes a different thread.
- Pain, injury, neurological, or medical questions receive a scope boundary and professional-care guidance.

## Testing and Acceptance

### Automated

- Database tests enforce 12 FPS and owner-scoped coach tables.
- Upload coordinator tests cover prepared target reuse, session creation fallback, success, typed error, and retry.
- Camera tests prove stop navigates to `/analysis/upload` before any network completion.
- Auth lifecycle tests prove active starts and background stops refresh exactly once.
- Progress tests cover each real stage and prove no full-screen progress movie is rendered.
- Home tests distinguish loading, true empty, and populated states.
- Recording Tips tests cover the new body/target-area guidance.
- Review-frame tests cover all purposes, multiple evidence frames, and related next-set actions.
- Player tests cover 44-point targets, seek/pause, purpose rotation, focus circle, manual pinch zoom, full frame, and restored AI focus.
- Results tests cover the compact premium badge and horizontal secondary sections.
- Coach handler tests cover ownership, video context, bounded history, persistence, unsupported claims, and model failure.
- Coach screen tests cover required video selection, video switching, sending, retry, and result preselection.

### End-to-end acceptance

1. A user records without selecting an exercise.
2. Stop immediately opens the native analysis surface.
3. The upload completes without the 12-versus-24 constraint failure.
4. A temporary network failure can be retried without losing the local video.
5. Native backgrounding does not emit an auto-refresh tick failure.
6. Persisted analysis stages advance the native progress UI.
7. Empty Home fills the available screen; populated Home is unchanged.
8. Coach/results is materially less vertically stacked.
9. Premium runs appear in one compact badge.
10. Every coaching dot is easy to press.
11. Purpose tabs rotate through multiple real frames and update their explanations.
12. AI focus circle and 1.7x zoom appear when supported; pinch zoom and focus restoration still work.
13. Coach requires video selection when opened from its tab.
14. Ask Coach from a result preselects that result.
15. Coach answers about the selected video and does not claim measured muscle activation.

## Confirmed Decisions

- Only Coach/results receives the broad less-vertical redesign.
- Home changes only in its true empty state.
- Progress and Profile remain visually unchanged.
- Coach opened from its tab asks the user to choose a video first.
- The carousel uses real frames from the user's video, not generated exercise artwork.
- What happened, Why it matters, and What to do next are the review purposes.
- Multiple frames per purpose are supported.
- Focus circles, automatic focus zoom, manual pinch zoom, and reset/restore controls remain supported.
- Implementation and review remain single-agent; no subagents are used.
