# Exhaustive Corrections and Multi-Chat FORM Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve up to twelve distinct visible corrections and build a reference-image-inspired, chat-first FORM Coach with server-backed multiple conversations per recording.

**Architecture:** Keep the one-pass analyst and immutable writer boundary, changing only correction inventory capacity and prompting. Make coach thread identity explicit in the database and Edge Function, resolve evidence attachments server-side, and split the Coach UI into recording picker, sidebar, and workspace units around the existing authenticated API wrapper.

**Tech Stack:** Expo SDK 54, React Native 0.81, Expo Router, TypeScript 5.9, Jest/jest-expo, Zod, Supabase/Postgres/Edge Functions, Gemini Files and Generate Content APIs.

## Global Constraints

- Do not use subagents; execute inline in the current workspace.
- Gemini remains the sole owner of recognition, score, severity, findings, evidence, and timestamps.
- Usable analyses accept one to twelve supported corrections; four is a prompt target, never a structural minimum.
- The writer cannot add, remove, merge, reorder, or alter analyst-owned fields.
- Coach remains chat-first and sends no proactive model message.
- Multiple threads may reference the same recording without deleting older threads.
- Unconfirmed inferred exercise names remain hidden from recording-picker and sidebar copy.
- Selected evidence must resolve against saved server analysis before reaching the model.
- Deleting a thread never deletes its analysis session or recording.
- Use the existing authenticated fetch wrapper and do not expose service credentials.
- Preserve the one-pass analyst/writer architecture and one Coach model call per submitted message.

---

### Task 1: Expand the immutable correction inventory

**Files:**
- Modify: `supabase/functions/_shared/single-pass-analysis.ts`
- Test: `supabase/functions/_shared/single-pass-analysis.test.ts`

**Interfaces:**
- Consumes: `parseAnalysisDecision(value, durationMs)` and `ANALYSIS_DECISION_SCHEMA`.
- Produces: `MAX_MODEL_CORRECTIONS = 12`; usable model inventory accepts one through twelve corrections while prompting for a second sweep below four.

- [ ] **Step 1: Write failing contract tests**

Add cases that construct complete decisions with 1, 9, 12, and 13 corrections:

```ts
it("accepts every supported correction through twelve", () => {
  expect(parseAnalysisDecision(decisionWithCorrections(9), 20_000).findings.filter((item) => item.kind === "correction")).toHaveLength(9);
  expect(parseAnalysisDecision(decisionWithCorrections(12), 20_000).findings.filter((item) => item.kind === "correction")).toHaveLength(12);
});

it("accepts fewer than four corrections without validator filler", () => {
  expect(parseAnalysisDecision(decisionWithCorrections(1), 20_000).findings.filter((item) => item.kind === "correction")).toHaveLength(1);
});

it("rejects a thirteenth correction", () => {
  expect(() => parseAnalysisDecision(decisionWithCorrections(13), 20_000)).toThrow(/more than twelve corrections/i);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
npx jest --runInBand supabase/functions/_shared/single-pass-analysis.test.ts
```

Expected: the 9/12 correction cases fail at the current limit of eight and the one-correction inventory fails at the current minimum of three.

- [ ] **Step 3: Implement the minimal contract and prompt changes**

Set the maximum to twelve, reduce structural minimum to one, update schema descriptions from `3 to 8` to `1 to 12`, and change prompt language to:

```text
Return every distinct visibly supported correction, up to twelve. When the first sweep finds fewer than four, perform a second phase-by-phase and dimension-by-dimension sweep. Four is a coverage target, not a minimum; never invent filler.
```

Retain score-severity calibration and immutable writer parsing.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run the same Jest command. Expected: PASS with the new boundary cases.

- [ ] **Step 5: Commit the correction contract**

```powershell
git add -- supabase/functions/_shared/single-pass-analysis.ts supabase/functions/_shared/single-pass-analysis.test.ts
git commit -m "feat: preserve up to twelve visible corrections"
```

### Task 2: Add server-backed multi-thread persistence

**Files:**
- Create: `supabase/migrations/202607220030_multi_chat_coach_threads.sql`
- Modify: `supabase/functions/_shared/coach-contract.ts`
- Test: `supabase/functions/_shared/coach-contract.test.ts`
- Modify: `supabase/functions/coach-chat/handler.ts`
- Test: `supabase/functions/coach-chat/handler.test.ts`
- Modify: `supabase/functions/coach-chat/index.ts`

**Interfaces:**
- Produces `CoachThreadSummary`, `CoachEvidenceAttachment`, and exact parsers for list/create/load/rename/delete/send operations.
- Produces handler dependencies `listThreads`, `loadThreadById`, `createThread`, `renameThread`, and `deleteThread` with user ownership enforced by every query.

- [ ] **Step 1: Write failing parser and handler tests**

Cover these behaviors:

```ts
expect(parseCoachRequest({ threadId, sessionId, message: "What changes here?", evidence: { findingId: "corr_1", peakMs: 13_333 } })).toEqual({
  threadId,
  sessionId,
  message: "What changes here?",
  evidence: { findingId: "corr_1", peakMs: 13_333 },
});
```

Add handler tests proving two threads can be created for one session, list ordering is newest first, rename/delete call only user-owned dependencies, mismatched thread/session returns `409 THREAD_SESSION_MISMATCH`, and deleting a thread does not call any session deletion dependency.

- [ ] **Step 2: Run parser and handler tests and confirm RED**

```powershell
npx jest --runInBand supabase/functions/_shared/coach-contract.test.ts supabase/functions/coach-chat/handler.test.ts
```

Expected: failures because thread actions, explicit thread IDs, and evidence attachments are not implemented.

- [ ] **Step 3: Add the forward-only migration**

Create SQL equivalent to:

```sql
alter table public.coach_threads
  drop constraint if exists coach_threads_user_id_session_id_key;

alter table public.coach_threads
  add column if not exists title text
  check (title is null or char_length(title) between 1 and 120);

create index if not exists coach_threads_user_session_updated_idx
  on public.coach_threads (user_id, session_id, updated_at desc);

grant update, delete on public.coach_threads to authenticated;
```

Do not modify historical migrations.

- [ ] **Step 4: Implement exact contracts and handler routing**

Use a single Edge Function with actions:

```ts
type CoachEvidenceAttachment = { findingId: string; peakMs: number };
type CoachSendRequest = { action: "send"; threadId: string; sessionId: string; message: string; targetIntent?: string; evidence?: CoachEvidenceAttachment };
type CoachCreateRequest = { action: "create"; sessionId: string };
type CoachRenameRequest = { action: "rename"; threadId: string; title: string };
type CoachDeleteRequest = { action: "delete"; threadId: string };
```

GET without `threadId` lists summaries; GET with `threadId` returns that thread and its messages. POST dispatches exact `action` values. Validate the loaded thread's `sessionId` before message persistence or model invocation.

- [ ] **Step 5: Update Supabase adapters**

Replace `.maybeSingle()` by session with ID-based lookups and add newest-first summary queries. Map snake_case database rows to camelCase at the Edge Function boundary. Keep Gemini file metadata per thread.

- [ ] **Step 6: Run focused server tests and confirm GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 7: Commit persistence and server routing**

```powershell
git add -- supabase/migrations/202607220030_multi_chat_coach_threads.sql supabase/functions/_shared/coach-contract.ts supabase/functions/_shared/coach-contract.test.ts supabase/functions/coach-chat/handler.ts supabase/functions/coach-chat/handler.test.ts supabase/functions/coach-chat/index.ts
git commit -m "feat: support multiple coach conversations"
```

### Task 3: Resolve evidence attachments and ground Coach replies

**Files:**
- Modify: `supabase/functions/_shared/coach-prompt.ts`
- Test: `supabase/functions/_shared/coach-prompt.test.ts`
- Modify: `supabase/functions/_shared/gemini-coach.ts`
- Test: `supabase/functions/_shared/gemini-coach.test.ts`
- Modify: `supabase/functions/coach-chat/handler.ts`
- Test: `supabase/functions/coach-chat/handler.test.ts`

**Interfaces:**
- Produces `resolveCoachEvidence(analysis, attachment)` returning the server-owned finding title, detail, peak timestamp, rep, phase, and visual evidence.
- Extends `buildCoachPrompt` with `selectedEvidence` while preserving the existing safety policy.

- [ ] **Step 1: Write failing grounding tests**

```ts
it("resolves a selected marker from immutable analysis", () => {
  expect(resolveCoachEvidence(result, { findingId: "corr_1", peakMs: 13_333 })).toMatchObject({
    findingId: "corr_1",
    peakMs: 13_333,
    repNumber: 4,
    phase: "concentric",
  });
});

it("rejects a stale or fabricated marker", () => {
  expect(() => resolveCoachEvidence(result, { findingId: "corr_1", peakMs: 99 })).toThrow(/selected evidence is unavailable/i);
});
```

Assert the prompt instructs the model to lead with a direct answer, cite timestamps only from stored evidence or visible video, and finish with one practical next-set action when appropriate.

- [ ] **Step 2: Run prompt/handler tests and confirm RED**

```powershell
npx jest --runInBand supabase/functions/_shared/coach-prompt.test.ts supabase/functions/coach-chat/handler.test.ts
```

- [ ] **Step 3: Implement server resolution and prompt focus**

Search `priorityCorrections`, `didWell`, and `coachingCues` for the matching finding ID, then require an exact evidence `peakMs`. Serialize only server values:

```ts
Selected evidence focus:
${selectedEvidence ? JSON.stringify(selectedEvidence) : "No specific evidence selected"}
```

Do not let the attachment replace the whole-video context.

- [ ] **Step 4: Keep one model call and explicit thinking configuration**

Preserve one Generate Content request per user message and the cached active Gemini file. Keep bounded output, low temperature, response error checks, and no client API key.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run the Step 2 command plus `supabase/functions/_shared/gemini-coach.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit grounding behavior**

```powershell
git add -- supabase/functions/_shared/coach-prompt.ts supabase/functions/_shared/coach-prompt.test.ts supabase/functions/_shared/gemini-coach.ts supabase/functions/_shared/gemini-coach.test.ts supabase/functions/coach-chat/handler.ts supabase/functions/coach-chat/handler.test.ts
git commit -m "feat: attach saved evidence to coach questions"
```

### Task 4: Add typed multi-chat client APIs

**Files:**
- Modify: `src/features/coach/types.ts`
- Modify: `src/features/coach/api.ts`
- Test: `src/features/coach/api.test.ts`
- Modify: `src/app/(tabs)/(coach)/index.tsx`

**Interfaces:**
- Produces `listCoachThreads`, `createCoachThread`, `getCoachConversation(threadId)`, `renameCoachThread`, `deleteCoachThread`, and `sendCoachMessage` with explicit thread and evidence fields.

- [ ] **Step 1: Write failing API tests**

Assert authenticated URLs, methods, bodies, and schemas for all operations. The send body must equal:

```ts
{
  action: "send",
  threadId,
  sessionId,
  message: "What changes here?",
  evidence: { findingId: "corr_1", peakMs: 13_333 },
}
```

- [ ] **Step 2: Run API tests and confirm RED**

```powershell
npx jest --runInBand src/features/coach/api.test.ts
```

- [ ] **Step 3: Implement Zod schemas and request functions**

Define:

```ts
export type CoachThread = {
  id: string;
  userId: string;
  sessionId: string;
  title: string | null;
  targetIntent: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CoachEvidenceAttachment = {
  findingId: string;
  peakMs: number;
  title: string;
  repNumber: number | null;
  phase: string | null;
};
```

Use existing `request()` response handling for every call.

- [ ] **Step 4: Wire route callbacks without embedding networking in the screen**

Create `useCallback` wrappers in the Coach route for list/create/load/rename/delete/send and pass them as screen props.

- [ ] **Step 5: Run API tests and confirm GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 6: Commit typed client APIs**

```powershell
git add -- src/features/coach/types.ts src/features/coach/api.ts src/features/coach/api.test.ts 'src/app/(tabs)/(coach)/index.tsx'
git commit -m "feat: add typed multi-chat coach APIs"
```

### Task 5: Build the recording picker, sidebar, and chat workspace

**Files:**
- Create: `src/screens/coach/recording-picker.tsx`
- Create: `src/screens/coach/coach-sidebar.tsx`
- Modify: `src/screens/coach/index.tsx`
- Test: `src/screens/coach/coach.test.tsx`
- Modify: `src/features/progress/group-sessions.ts` only if neutral display metadata is missing.

**Interfaces:**
- `RecordingPicker` consumes completed/partial `AnalysisHistoryItem[]`, query state, and `onChoose(sessionId)`.
- `CoachSidebar` consumes thread summaries and `onSelect`, `onNew`, `onRename`, `onDelete`, and `onClose`.
- `CoachScreen` orchestrates picker/sidebar/workspace without directly calling `fetch`.

- [ ] **Step 1: Write failing interaction tests**

Add tests for:

```ts
it("starts separate chats for the same recording", async () => {
  fireEvent.press(screen.getByLabelText("Ask FORM about analyzed set"));
  await waitFor(() => expect(createThread).toHaveBeenCalledWith(sessionId));
  fireEvent.press(screen.getByLabelText("Open conversations"));
  fireEvent.press(screen.getByText("New chat"));
  fireEvent.press(screen.getByLabelText("Ask FORM about analyzed set"));
  await waitFor(() => expect(createThread).toHaveBeenCalledTimes(2));
});
```

Also cover search, neutral labels, sidebar switching, new chat returning to picker, rename/delete success and failure, no proactive message, selected evidence attachment removal, clear-on-success, and retain-on-failure.

- [ ] **Step 2: Run the screen test and confirm RED**

```powershell
npx jest --runInBand src/screens/coach/coach.test.tsx
```

- [ ] **Step 3: Implement the reference-image recording picker**

Build a compact black/surface/gold hierarchy with `Choose a set`, search input, thumbnail when available, score, date, duration when available, short correction summary, and `Ask FORM`. Use neutral `Analyzed set` unless `correctedLabel` exists. Keep compact-phone scrolling and accessibility labels.

- [ ] **Step 4: Implement the slide-out sidebar**

Use a full-height absolute overlay and animated panel rather than adding a navigation dependency. List newest threads, expose `New chat`, and place rename/delete inside accessible row actions with delete confirmation. Closing the overlay restores the workspace without remounting video.

- [ ] **Step 5: Refactor CoachScreen into explicit states**

Track `selectedThreadId`, `selectedSessionId`, `sidebarOpen`, `selectedEvidence`, loading flags, draft, and messages. Choosing a recording must await thread creation before opening the workspace. Selecting an existing thread loads its session analysis and messages.

- [ ] **Step 6: Attach immutable evidence to send**

Map a selected review frame to `{ findingId, peakMs, title, repNumber, phase }`, render a removable composer chip, and pass only `findingId`/`peakMs` to the API. Clear after success; retain after failure.

- [ ] **Step 7: Run screen tests and confirm GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 8: Commit the Coach experience**

```powershell
git add -- src/screens/coach/recording-picker.tsx src/screens/coach/coach-sidebar.tsx src/screens/coach/index.tsx src/screens/coach/coach.test.tsx src/features/progress/group-sessions.ts
git commit -m "feat: build multi-chat FORM Coach workspace"
```

### Task 6: Verify, deploy, and run live regressions

**Files:**
- Modify only files required by discovered test failures.
- Deploy: `supabase/migrations/202607220030_multi_chat_coach_threads.sql`
- Deploy: `supabase/functions/coach-chat`
- Deploy: `supabase/functions/analyze-video` if Task 1 changes are not already deployed.

**Interfaces:**
- Produces deployed multi-chat Coach and twelve-correction analyst capacity.

- [ ] **Step 1: Run focused tests**

```powershell
npx jest --runInBand supabase/functions/_shared/single-pass-analysis.test.ts supabase/functions/_shared/coach-contract.test.ts supabase/functions/_shared/coach-prompt.test.ts supabase/functions/_shared/gemini-coach.test.ts supabase/functions/coach-chat/handler.test.ts src/features/coach/api.test.ts src/screens/coach/coach.test.tsx
```

Expected: all focused suites pass.

- [ ] **Step 2: Run full static and automated verification**

```powershell
npm test -- --runInBand
npm run typecheck
npm run lint
```

Expected: zero failures and zero TypeScript/lint errors.

- [ ] **Step 3: Deploy database and Edge Functions**

Use the configured linked Supabase project:

```powershell
npx supabase db push
npx supabase functions deploy coach-chat
npx supabase functions deploy analyze-video
```

Confirm each command exits zero and the functions report ACTIVE.

- [ ] **Step 4: Run authenticated live API smoke checks**

Create two threads for the same completed recording, list both, send a question with a valid evidence attachment, reject a fabricated attachment, rename one thread, and delete it while confirming the analysis session still exists.

- [ ] **Step 5: Run a non-persisting hard-angle video regression**

Use `scripts/run-single-pass-regression.ts` on a hard-angle row. Confirm the response can preserve more than eight corrections only when the pixels support them; do not require the model to fabricate nine findings.

- [ ] **Step 6: Final workspace audit**

```powershell
git status --short
git log -6 --oneline
```

Report deployed versions, exact test counts, live thread behavior, correction count, and any remaining accuracy limitation without altering historical results.
