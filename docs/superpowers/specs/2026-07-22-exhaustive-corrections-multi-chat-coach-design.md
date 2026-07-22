# Exhaustive Corrections and Multi-Chat FORM Coach

## Goal

Increase useful correction coverage without inventing filler, and reshape FORM Coach around a chat-first, recording-grounded experience. Users enter through the existing Coach tab, choose a recording, ask questions, preserve multiple conversations, and can start another conversation about the same recording without losing history.

## Product behavior

### Analysis corrections

- Gemini remains the sole owner of recognition, findings, evidence, severity, rationale, and score.
- A usable or partially usable analysis returns every distinct visible and actionable correction it can support, including note-level opportunities.
- The output may contain one to twelve corrections. Twelve is a response-size safety bound, not a target.
- The prompt asks for a second phase-by-phase and dimension-by-dimension sweep whenever fewer than four corrections are found.
- The validator requires at least one correction for a usable analysis but never forces filler to reach four.
- Separate problems remain separate. Repeated appearances of the same problem remain one finding with multiple evidence moments.
- Hidden mechanics, inferred pain, muscle activation, and unsupported exercise rules remain excluded.
- More corrections do not automatically lower the score. Score calibration continues to depend on severity, confidence, and recurrence.
- The writer may rewrite every returned correction but cannot add, remove, merge, reorder, or change analyst-owned fields.

### Recording picker

The initial Coach screen follows the supplied reference image:

- Header: `FORM COACH` and `Choose a set`.
- Search filters recordings using date and user-safe display text. Inferred exercise identity remains hidden unless a user-corrected label exists; otherwise cards use neutral labels such as `Analyzed set`.
- Cards contain an available recording thumbnail, date, set position where known, duration, score, a short analysis summary, and `Ask FORM`.
- The selected card uses FORM's gold accent. The layout remains scrollable on compact phones.
- Selecting a card opens a new, empty chat attached to that recording. Existing conversations are opened from the sidebar instead.

### Chat workspace

The chat remains user-initiated. Opening it does not generate a proactive AI message.

- A compact recording card appears above the conversation with thumbnail, date, duration, score, and a link back to the full analysis.
- Suggested questions populate the composer but do not send until the user submits.
- The existing original-video playback and evidence markers remain available without dominating the conversation.
- Selecting a coaching moment attaches its finding ID, evidence peak timestamp, repetition number, phase, and title to the next message.
- The attachment is visible near the composer and can be removed before sending.
- After a successful send, the attachment clears. A failed send preserves the message and attachment for retry.
- Coach answers should lead with a direct answer, cite relevant timestamps when referring to video evidence, and finish with one practical next-set action when appropriate.
- The model receives the saved analysis, selected evidence context, recent conversation history, and the cached original video. It does not rerun or overwrite analysis.
- When evidence is insufficient, the Coach says what the camera cannot show rather than filling the gap with generic certainty.

### Chat sidebar

A ChatGPT-style slide-out sidebar is available from the Coach workspace.

- It lists the user's conversations newest first with a concise title, recording date, and last-updated time.
- `New chat` closes the current thread state and opens the recording picker.
- Users may create multiple independent conversations for the same recording.
- Selecting a conversation restores its recording, messages, target intent, and current thread ID.
- Users can rename or delete a conversation. Deletion requires confirmation and deletes only that thread and its messages, never the recording or analysis.
- An empty state explains that starting a chat begins by choosing a recording.

## Architecture

### Database

Add a forward-only migration that:

- Removes the existing unique constraint on `(user_id, session_id)` from `coach_threads`.
- Adds a non-unique lookup index on `(user_id, session_id, updated_at desc)`.
- Adds a nullable user-visible `title` column.
- Preserves existing threads and messages.
- Leaves row-level ownership policies intact.

Existing reanalysis/reset behavior must not delete every historical conversation simply because a result is regenerated. A thread can remain readable from its saved messages, while new questions use the current saved analysis for that recording.

### Coach API

Thread identity becomes explicit:

- `GET /coach-chat` lists thread summaries for the authenticated user, or loads one thread when `threadId` is supplied.
- `POST /coach-chat/threads` creates a new thread for a completed or partial recording.
- `PATCH /coach-chat/threads/:threadId` renames a user-owned thread.
- `DELETE /coach-chat/threads/:threadId` deletes only that thread.
- Sending a message requires both `threadId` and `sessionId`; the server verifies that the thread belongs to that session and user.
- The optional evidence attachment is validated against an existing finding and evidence moment in the saved analysis. Client-supplied titles or timestamps cannot replace server-owned evidence.

The implementation may keep these operations inside the existing Supabase Edge Function using method and query/action routing rather than creating several deployed functions, provided the public client functions remain typed and independently testable.

### Model request

The Coach keeps one model call per submitted user message. It reuses the thread's active Gemini file when possible. The prompt contains:

- the immutable saved analysis;
- the server-resolved selected evidence attachment, if present;
- at most the latest twenty stored messages;
- the current user question and optional target intent;
- the existing visibility and medical-safety boundaries.

The selected evidence is a focus hint, not permission to ignore other relevant parts of the set.

### Client state

The Coach screen owns four explicit states:

1. recording picker;
2. thread workspace;
3. sidebar open;
4. loading or error state for the current operation.

Thread list fetching and mutations use the existing authenticated request wrapper. Optimistic message insertion remains, while thread creation, rename, and deletion reconcile from server responses. Requests surface HTTP errors and never store service credentials in the client.

## Failure behavior

- Failure to load thread history leaves the recording picker or current cached workspace usable and shows a retry action.
- Failure to create a thread does not navigate into a fake local conversation.
- Failure to send restores the draft and selected evidence attachment.
- Failure to rename leaves the old title.
- Failure to delete leaves the thread visible.
- A missing or stale evidence attachment returns a clear validation error and does not send a model request.
- A deleted recording cannot start a new chat, but deleting a chat never deletes its recording.

## Testing

### Analysis contract

- A usable result can contain more than eight corrections and up to twelve.
- Thirteen corrections are rejected structurally.
- One to three supported corrections remain valid; the validator does not manufacture or require filler.
- Writer output preserves the complete analyst correction inventory and ownership boundaries.
- Score and severity remain independent of correction count.

### API and persistence

- Multiple threads can be created for one recording.
- Thread listing, loading, renaming, and deletion enforce user ownership.
- Sending rejects mismatched thread and recording IDs.
- Evidence attachments resolve only to stored finding/evidence IDs and server timestamps.
- The selected evidence reaches the Coach prompt.
- Failed sends do not persist an assistant message.
- Legacy single-thread records remain readable after migration.

### Client

- The picker matches the intended content hierarchy and remains usable on compact phones.
- Search filters the recording list without exposing an unconfirmed inferred exercise name.
- Selecting a recording creates a separate thread.
- Sidebar switching restores the correct recording and messages.
- New chat returns to the picker.
- Rename and delete success and failure paths behave correctly.
- Selected evidence is displayed, sent, cleared on success, and retained on failure.
- No proactive Coach message appears before a user sends one.

### Live verification

- Run the existing focused Jest suites, full Jest suite, TypeScript, and lint.
- Deploy the migration and Coach Edge Function.
- Verify two independent chats on the same recording, thread switching, selected-evidence questions, deletion isolation, and a hard-angle row analysis returning more than eight corrections when the video genuinely supports them.
- Do not claim universal coaching accuracy from contract or UI tests; retain the non-persisting video benchmark boundary.

## Out of scope

- Voice input or speech output.
- Proactive or background Coach messages.
- Cross-recording comparison inside one thread.
- Sharing chats with other users.
- Replacing the one-pass analyst/writer architecture.
- App Store or TestFlight submission.
