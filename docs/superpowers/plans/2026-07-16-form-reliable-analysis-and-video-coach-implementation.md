# FORM Reliable Analysis and Video Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Repository instructions prohibit subagents, so all execution and review stays inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make recording-to-analysis reliable, redesign only the Coach/results experience around an evidence-frame carousel, and add a private AI Coach tab that requires the user to choose a saved video before chatting.

**Architecture:** Capture ends by transferring the saved local recording to a dedicated upload route backed by a deduplicating upload coordinator. Native analysis progress renders persisted stages, results derive purpose-specific review frames from existing evidence, and a new owner-scoped Coach service re-uploads the selected private video to Gemini for a bounded persisted conversation.

**Tech Stack:** Expo SDK 54, React Native 0.81, Expo Router 6, expo-camera, expo-video, React Native Gesture Handler, Reanimated 4, Zustand 5, TanStack Query 5, Zod 4, Supabase Auth/Postgres/Storage/Edge Functions, Gemini Files and generateContent APIs, Jest 29, React Native Testing Library.

## Global Constraints

- Recording never requires exercise selection.
- Stop recording must replace the camera with analysis UI immediately after a local file URI exists.
- The only supported requested analysis rate is exactly `12` FPS in TypeScript and Postgres.
- Preserve the local recording across upload failure and retry.
- Native auth auto-refresh runs only while the app is active; web keeps visibility-aware refresh behavior.
- Enlarge Home only after history has resolved empty. Preserve populated Home, Progress, and Profile UI.
- Apply the broad less-vertical redesign only to Coach/results.
- Purpose tabs are exactly `What happened`, `Why it matters`, and `What to do next`.
- Purpose carousels support multiple frames and use frames from the user's own video.
- Coaching dots retain a 14-point visible mark inside a minimum 44 by 44 point touch target.
- AI focus uses confidence `>= 0.8`, zoom `1.7`, and the existing circle/arrow overlay.
- Manual pinch zoom stays clamped to `1` through `2.5` and does not clear selected review content.
- Coach opened from its tab requires explicit video selection. Result-level Ask Coach may preselect that result.
- Coach may discuss visible mechanics and likely exercise emphasis but must never claim measured muscle activation, diagnose pain/injury, or provide medical conclusions.
- Videos, Gemini keys, and service-role credentials remain private and server-only.
- Preserve unrelated user changes in the dirty worktree. Stage and commit only files belonging to the current task.
- Use test-first red-green-refactor for every production behavior.
- Do not use subagents.

---

### Task 1: Unify the 12 FPS upload contract

**Files:**
- Create: `supabase/functions/_shared/analysis-settings.ts`
- Create: `supabase/migrations/202607160010_analysis_sampling_rate.sql`
- Modify: `supabase/functions/complete-upload/handler.test.ts`
- Modify: `supabase/functions/complete-upload/handler.ts`
- Modify: `supabase/functions/complete-upload/index.ts`
- Modify: `supabase/functions/analyze-video/handler.ts`
- Modify: `supabase/functions/analyze-video/handler.test.ts`
- Modify: `supabase/functions/analyze-video/index.ts`
- Modify: `supabase/tests/rls.sql`

**Interfaces:**
- Produces: `REQUESTED_ANALYSIS_FPS = 12` and `uploadedVideoIsVisible(path, videoExists, wait): Promise<boolean>`.
- Consumed by: `complete-upload`, `analyze-video`, Postgres constraint tests, and Task 2's upload coordinator.

- [ ] **Step 1: Write failing handler tests for the shared rate and bounded object visibility**

Add a test whose `videoExists` dependency returns `false`, `false`, then `true`, and assert completion succeeds only after three checks. Update every expected `requestedFps` to import and use the shared constant.

```ts
import { REQUESTED_ANALYSIS_FPS } from "../_shared/analysis-settings";

it("waits for the signed upload to become visible before completing", async () => {
  const videoExists = jest
    .fn<Promise<boolean>, [string]>()
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  const deps = dependencies({ videoExists });
  const response = await completeUploadHandler(
    request({ sessionId: "session-1", durationMs: 18_500 }),
    deps,
  );
  expect(response.status).toBe(200);
  expect(videoExists).toHaveBeenCalledTimes(3);
  expect(deps.markProcessing).toHaveBeenCalledWith(expect.objectContaining({
    requestedFps: REQUESTED_ANALYSIS_FPS,
  }));
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- --runInBand supabase/functions/complete-upload/handler.test.ts supabase/functions/analyze-video/handler.test.ts`

Expected: FAIL because the shared constant and visibility retry behavior do not exist.

- [ ] **Step 3: Add the shared setting and condition-based visibility wait**

Create:

```ts
export const REQUESTED_ANALYSIS_FPS = 12 as const;
```

Change the complete-upload dependency contract to:

```ts
videoExists: (path: string) => Promise<boolean>;
wait: (milliseconds: number) => Promise<void>;
```

Implement a bounded check in the handler:

```ts
async function uploadedVideoIsVisible(
  path: string,
  videoExists: (path: string) => Promise<boolean>,
  wait: (milliseconds: number) => Promise<void>,
): Promise<boolean> {
  for (const delayMs of [0, 150, 350, 750]) {
    if (delayMs > 0) await wait(delayMs);
    if (await videoExists(path)) return true;
  }
  return false;
}
```

The Edge Function index supplies `wait: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))`. Both Edge Functions import the shared constant instead of declaring literal `12` types.

- [ ] **Step 4: Add the forward-only database migration**

Create:

```sql
alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_requested_fps_check;

alter table public.analysis_sessions
  alter column requested_fps set default 12;

update public.analysis_sessions
set requested_fps = 12
where requested_fps <> 12;

alter table public.analysis_sessions
  add constraint analysis_sessions_requested_fps_check
  check (requested_fps = 12);
```

Append pgTAP assertions that inspect the default and check constraint:

```sql
select is(
  (select pg_get_expr(adbin, adrelid)
   from pg_attrdef
   where adrelid = 'public.analysis_sessions'::regclass
     and adnum = (select attnum from pg_attribute where attrelid = 'public.analysis_sessions'::regclass and attname = 'requested_fps')),
  '12',
  'requested_fps defaults to 12'
);

select like(
  (select pg_get_constraintdef(oid)
   from pg_constraint
   where conrelid = 'public.analysis_sessions'::regclass
     and conname = 'analysis_sessions_requested_fps_check'),
  '%requested_fps = 12%',
  'requested_fps only accepts 12'
);
```

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- --runInBand supabase/functions/complete-upload/handler.test.ts supabase/functions/analyze-video/handler.test.ts`

Run: `npx supabase db reset --no-seed=false`

Run: `npx supabase test db`

Expected: handler suites and pgTAP pass; completion records `requested_fps = 12`.

- [ ] **Step 6: Commit only Task 1 files**

```powershell
git add -- supabase/functions/_shared/analysis-settings.ts supabase/functions/complete-upload supabase/functions/analyze-video supabase/migrations/202607160010_analysis_sampling_rate.sql supabase/tests/rls.sql
git commit -m "fix: align analysis upload sampling rate"
```

---

### Task 2: Transfer uploads from Camera to an immediate analysis route

**Files:**
- Create: `src/features/auth/access-token.ts`
- Create: `src/features/capture/upload-coordinator.test.ts`
- Create: `src/features/capture/upload-coordinator.ts`
- Create: `src/app/analysis/upload.tsx`
- Modify: `src/features/capture/types.ts`
- Modify: `src/features/capture/capture-store.test.ts`
- Modify: `src/features/capture/capture-store.ts`
- Modify: `src/screens/camera/index.tsx`
- Modify: `src/screens/analysis-progress/index.tsx`
- Modify: `src/screens/analysis-progress/analysis-progress.test.tsx`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Produces: `analysisUploadCoordinator.prepare(previousSessionId?)`, `analysisUploadCoordinator.run(recording, previousSessionId?)`, and `/analysis/upload`.
- Consumes: Task 1's stable complete-upload contract and existing capture reducer events.
- Produces for Task 4: progress stage `uploading` and retry callbacks.

- [ ] **Step 1: Write failing coordinator tests**

Cover prepared-target reuse, deduplication, fallback session creation, ordered upload/completion, typed failure, reset, and retry.

```ts
it("reuses the preparation promise and completes one upload", async () => {
  const deps = fakeDependencies();
  const coordinator = createUploadCoordinator(deps);
  const prepared = coordinator.prepare("previous-1");
  const result = await coordinator.run(
    { localUri: "file:///set.mp4", durationMs: 18_000, mimeType: "video/mp4" },
    "previous-1",
  );
  expect(await prepared).toEqual(expect.objectContaining({ sessionId: "session-1" }));
  expect(result).toEqual({ sessionId: "session-1" });
  expect(deps.createSession).toHaveBeenCalledTimes(1);
  expect(deps.uploadVideo.mock.invocationCallOrder[0]).toBeLessThan(
    deps.completeUpload.mock.invocationCallOrder[0],
  );
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- --runInBand src/features/capture/upload-coordinator.test.ts src/features/capture/capture-store.test.ts`

Expected: FAIL because the coordinator and upload-route transitions do not exist.

- [ ] **Step 3: Centralize access-token acquisition and implement the coordinator**

`access-token.ts` exports one function used by upload, analysis polling, and Coach API:

```ts
export async function getAccessToken(): Promise<string> {
  const existing = await supabase.auth.getSession();
  if (existing.data.session?.access_token) return existing.data.session.access_token;
  const created = await supabase.auth.signInAnonymously();
  if (created.error || !created.data.session?.access_token) {
    throw new Error(created.error?.message ?? "A private session could not be created");
  }
  return created.data.session.access_token;
}
```

`createUploadCoordinator(dependencies)` owns one preparation promise. `run` awaits it, creates a target only when it resolved null, uploads, completes, and returns `{ sessionId }`. `reset` clears the promise only after success or explicit discard.

- [ ] **Step 4: Make Camera capture-only and navigate immediately**

After `recordAsync` returns a URI:

```ts
const saved: RecordedSet = {
  localUri: result.uri,
  durationMs: normalizeRecordedDuration(Date.now() - actualStart),
  mimeType: "video/mp4",
};
dispatch({ type: "recording_finished", recording: saved });
dispatch({ type: "upload_started" });
router.replace("/analysis/upload");
```

Keep `analysisUploadCoordinator.prepare(previousSessionId)` during countdown. Remove storage upload, completion, and upload-error rendering from Camera.

- [ ] **Step 5: Implement `/analysis/upload` as the upload owner**

The route reads `recording`, `previousSessionId`, `phase`, and `error` from Zustand. Its effect calls `analysisUploadCoordinator.run`, dispatches `processing`, then replaces with the real session route. Retry dispatches `retry_upload`; discard resets coordinator/store and routes to Recording Tips.

```ts
useEffect(() => {
  if (phase !== "uploading" || !recording) return;
  let active = true;
  void analysisUploadCoordinator.run(recording, previousSessionId ?? undefined)
    .then(({ sessionId }) => {
      if (!active) return;
      dispatch({ type: "processing", sessionId });
      router.replace({ pathname: "/analysis/[session-id]", params: { "session-id": sessionId } });
    })
    .catch((error) => {
      if (active) dispatch({ type: "upload_failed", message: uploadErrorMessage(error) });
    });
  return () => { active = false; };
}, [dispatch, phase, previousSessionId, recording, router]);
```

Do not abort the coordinator promise during route cleanup; cleanup only prevents stale navigation.

- [ ] **Step 6: Add route and retry UI tests**

Extend `AnalysisProgressScreen` with `onRetryUpload?: () => void` and label the primary action `Retry Upload` when supplied. Register `analysis/upload` in the root stack with `gestureEnabled: false`.

Run: `npm test -- --runInBand src/features/capture/upload-coordinator.test.ts src/features/capture/capture-store.test.ts src/screens/analysis-progress/analysis-progress.test.tsx`

Expected: all pass; retry preserves `recording.localUri`.

- [ ] **Step 7: Typecheck and commit**

Run: `npm run typecheck`

```powershell
git add -- src/features/auth/access-token.ts src/features/capture src/app/analysis/upload.tsx src/screens/camera/index.tsx src/screens/analysis-progress src/app/_layout.tsx
git commit -m "fix: open analysis immediately after recording"
```

---

### Task 3: Gate native Supabase refresh by app activity

**Files:**
- Create: `src/lib/auth-refresh-lifecycle.test.ts`
- Create: `src/lib/auth-refresh-lifecycle.ts`
- Modify: `src/lib/supabase.ts`
- Modify: `src/components/app-providers.tsx`

**Interfaces:**
- Produces: `bindAuthRefreshLifecycle({ platform, currentState, addListener, start, stop }): () => void`.
- Consumed by: `AppProviders` exactly once.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
it("runs native refresh only while active", () => {
  const start = jest.fn();
  const stop = jest.fn();
  let listener: (state: string) => void = () => undefined;
  const remove = jest.fn();
  const cleanup = bindAuthRefreshLifecycle({
    platform: "ios",
    currentState: "active",
    start,
    stop,
    addListener: (next) => { listener = next; return { remove }; },
  });
  expect(start).toHaveBeenCalledTimes(1);
  listener("background");
  expect(stop).toHaveBeenCalledTimes(1);
  listener("active");
  expect(start).toHaveBeenCalledTimes(2);
  cleanup();
  expect(remove).toHaveBeenCalledTimes(1);
});
```

Add a web case proving no custom listener or stop call is installed.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --runInBand src/lib/auth-refresh-lifecycle.test.ts`

Expected: FAIL because the lifecycle helper does not exist.

- [ ] **Step 3: Implement and register the lifecycle**

Set native initialization to `autoRefreshToken: process.env.EXPO_OS === "web"` so the ticker is not always-running before React mounts. In `AppProviders`, register one effect using `AppState.currentState`, `AppState.addEventListener`, `supabase.auth.startAutoRefresh`, and `supabase.auth.stopAutoRefresh`.

The cleanup removes the listener and stops native refresh.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- --runInBand src/lib/auth-refresh-lifecycle.test.ts`

Run: `npm run typecheck`

```powershell
git add -- src/lib/auth-refresh-lifecycle.ts src/lib/auth-refresh-lifecycle.test.ts src/lib/supabase.ts src/components/app-providers.tsx
git commit -m "fix: scope auth refresh to active app state"
```

---

### Task 4: Replace the prerecorded progress screen with real native stages

**Files:**
- Create: `src/features/analysis/progress-stages.test.ts`
- Create: `src/features/analysis/progress-stages.ts`
- Modify: `src/screens/analysis-progress/analysis-progress.test.tsx`
- Modify: `src/screens/analysis-progress/index.tsx`
- Modify: `src/components/production-motion.tsx`

**Interfaces:**
- Produces: `analysisProgress(stage): { activeIndex: number; items: ProgressItem[] }`.
- Consumes: `uploading`, `video_check`, `video_processing`, `technique_review`, and `coaching`.

- [ ] **Step 1: Write failing stage-mapping and screen tests**

```ts
expect(analysisProgress("technique_review")).toMatchObject({
  activeIndex: 3,
  items: [
    { key: "uploading", state: "complete" },
    { key: "video_check", state: "complete" },
    { key: "video_processing", state: "complete" },
    { key: "technique_review", state: "active" },
    { key: "coaching", state: "pending" },
  ],
});
```

Screen tests assert visible real labels, the active accessibility state, the production analysis figure, and absence of the `FORM analysis progress animation` MP4 label.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --runInBand src/features/analysis/progress-stages.test.ts src/screens/analysis-progress/analysis-progress.test.tsx`

Expected: FAIL because progress is one full-screen video.

- [ ] **Step 3: Implement native progress composition**

Render `FormWordmark`, title, subtitle, `assets/production/analysis-figure.png`, and a five-row progress list. Use Reanimated only for a restrained active-line opacity pulse and slight figure scale between `1` and `1.015`. Respect reduced motion by rendering the active state statically.

Remove `analysisProgress` from `ProductionMotion` sources. Keep `cameraSetup` only if another screen still consumes it; delete the component if no usages remain.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- --runInBand src/features/analysis/progress-stages.test.ts src/screens/analysis-progress/analysis-progress.test.tsx`

Run: `npm run typecheck`

```powershell
git add -- src/features/analysis/progress-stages.ts src/features/analysis/progress-stages.test.ts src/screens/analysis-progress src/components/production-motion.tsx
git commit -m "fix: render persisted analysis progress natively"
```

---

### Task 5: Enlarge only true-empty Home and improve Recording Tips

**Files:**
- Modify: `src/screens/home/home.test.tsx`
- Modify: `src/screens/home/index.tsx`
- Modify: `src/app/(tabs)/(home)/index.tsx`
- Modify: `src/screens/recording-tips/recording-tips.test.tsx`
- Modify: `src/screens/recording-tips/index.tsx`

**Interfaces:**
- Home consumes: `historyResolved: boolean` and `recentAnalyses`.
- Recording Tips produces: one additional capture-quality checklist item.

- [ ] **Step 1: Write failing empty/populated/loading tests**

```tsx
const empty = render(<HomeScreen onRecord={jest.fn()} historyResolved recentAnalyses={[]} />);
expect(empty.getByTestId("empty-home-hero")).toHaveStyle({ flex: 1 });
expect(empty.queryByText("Your latest coaching will appear here")).toBeNull();

const populated = render(<HomeScreen onRecord={jest.fn()} historyResolved recentAnalyses={[analysis]} />);
expect(populated.getByText("Recent")).toBeTruthy();
expect(populated.getByText(analysis.label)).toBeTruthy();
```

Add a loading case that does not render `empty-home-hero` before the query resolves.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --runInBand src/screens/home/home.test.tsx src/screens/recording-tips/recording-tips.test.tsx`

Expected: FAIL because Home has no resolved-state distinction and the new tip is absent.

- [ ] **Step 3: Implement conditional Home composition**

When `historyResolved && recentAnalyses.length === 0`, render a root `View` with header, flex hero copy, and a record card that grows to available height. Keep the existing populated `ScrollView` branch structurally and visually unchanged.

Pass `historyResolved={!history.isLoading}` from the route.

- [ ] **Step 4: Add the exact framing guidance**

Add this checklist item:

```ts
"Frame as much of your body—or the area you’re training—as possible"
```

Keep the guidance permissive and do not add an exercise-selection gate.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --runInBand src/screens/home/home.test.tsx src/screens/recording-tips/recording-tips.test.tsx`

Run: `npm run typecheck`

```powershell
git add -- src/screens/home src/app/'(tabs)'/'(home)'/index.tsx src/screens/recording-tips
git commit -m "feat: strengthen empty home and recording guidance"
```

---

### Task 6: Build purpose-specific review frames and preserve player focus state

**Files:**
- Create: `src/features/analysis/review-frames.test.ts`
- Create: `src/features/analysis/review-frames.ts`
- Modify: `src/components/full-recording.test.ts`
- Modify: `src/components/full-recording.tsx`
- Modify: `src/components/evidence-focus-overlay.tsx`

**Interfaces:**
- Produces: `ReviewPurpose`, `ReviewFrame`, `buildReviewFrames(result)`, player `focusMode`, and controlled `FullRecording` props `reviewFrames`, `selectedReviewFrame`, and `onSelectReviewFrame`.
- Consumed by: Task 7's Coach/results carousel.

- [ ] **Step 1: Write failing review-frame tests**

Use one finding with two evidence moments and one related next-set action. Assert two observed frames, two why frames, and two next frames with unique IDs and preserved evidence.

```ts
const groups = buildReviewFrames(resultWithTwoMoments());
expect(groups.observed).toHaveLength(2);
expect(groups.why.map((frame) => frame.body)).toEqual([
  "Uneven shoulders reduce repeatability.",
  "Uneven shoulders reduce repeatability.",
]);
expect(groups.next.map((frame) => frame.title)).toEqual([
  "Square your shoulders before each pull",
  "Square your shoulders before each pull",
]);
```

- [ ] **Step 2: Write failing player-state tests**

Add pure helpers for `nextFrameIndex`, `reviewPurposeLabel`, and `focusPresentation`. Assert:

```ts
expect(nextFrameIndex(1, 3, 1)).toBe(2);
expect(nextFrameIndex(2, 3, 1)).toBe(0);
expect(focusPresentation(highConfidenceFocus, "auto")).toEqual(expect.objectContaining({ zoom: 1.7, showCircle: true }));
expect(focusPresentation(highConfidenceFocus, "manual", 2.2)).toEqual(expect.objectContaining({ zoom: 2.2, showCircle: true }));
expect(clampPlaybackZoom(4)).toBe(2.5);
```

- [ ] **Step 3: Verify RED**

Run: `npm test -- --runInBand src/features/analysis/review-frames.test.ts src/components/full-recording.test.ts`

Expected: FAIL because purpose frames and independent focus mode do not exist.

- [ ] **Step 4: Implement frame derivation**

Define:

```ts
export type ReviewPurpose = "observed" | "why" | "next";

export type ReviewFrame = {
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

Build `observed` from `priorityCorrections` plus `coachingCues`, `why` from the same evidence with `whyItMatters`, and `next` by joining each `nextSetPlan.relatedFindingId` to all evidence on that finding. Omit a next-set item that has no related finding because it has no honest video frame.

- [ ] **Step 5: Refactor player focus without regressing circle or zoom**

Replace the coupling where pinch sets `selectedMoment` to null. Track:

```ts
type FocusMode = "auto" | "manual" | "full";
const [selectedFrame, setSelectedFrame] = useState<ReviewFrame | null>(null);
const [focusMode, setFocusMode] = useState<FocusMode>("full");
const [manualZoom, setManualZoom] = useState(1);
```

Frame selection pauses/seeks and chooses `auto` only for confidence `>= 0.8`. Pinch changes to `manual` but keeps `selectedFrame`. Full Frame uses `full`; Restore AI Focus uses `auto`. Render the focus circle in all selected modes when a valid focus exists; transform its coordinates with `zoomedFocusRegion` only in auto/manual zoom modes.

Expose the controlled player boundary explicitly:

```ts
type FullRecordingProps = {
  videoUrl: string;
  reps: RepTimelineItem[];
  durationMs: number;
  reviewFrames?: ReviewFrame[];
  selectedReviewFrame?: ReviewFrame | null;
  onSelectReviewFrame?: (frame: ReviewFrame) => void;
  onOpenFinding?: (finding: CoachingFinding) => void;
};
```

An effect watches `selectedReviewFrame?.id`, pauses and seeks to its `timeMs`, and preserves the selected explanation while zoom state changes. Timeline markers are built only from the observed-purpose frames passed through `reviewFrames`, preventing duplicate dots for the why/next copies of the same evidence.

- [ ] **Step 6: Enlarge invisible timeline targets**

Render each marker as a 44-point Pressable with a nested 14-point visual dot:

```tsx
<Pressable
  accessibilityLabel={`Coaching point: ${frame.title} at ${formatPlaybackTime(frame.timeMs)}`}
  hitSlop={4}
  onPress={() => selectReviewFrame(frame)}
  style={{ position: "absolute", left: `${percent}%`, top, width: 44, height: 44, marginLeft: -22, alignItems: "center", justifyContent: "center" }}
>
  <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.background, backgroundColor: selected ? colors.text : colors.gold }} />
</Pressable>
```

- [ ] **Step 7: Verify and commit**

Run: `npm test -- --runInBand src/features/analysis/review-frames.test.ts src/components/full-recording.test.ts`

Run: `npm run typecheck`

```powershell
git add -- src/features/analysis/review-frames.ts src/features/analysis/review-frames.test.ts src/components/full-recording.tsx src/components/full-recording.test.ts src/components/evidence-focus-overlay.tsx
git commit -m "feat: add evidence frame review modes"
```

---

### Task 7: Redesign only Coach/results around the review carousel

**Files:**
- Create: `src/components/coaching-review-carousel.test.tsx`
- Create: `src/components/coaching-review-carousel.tsx`
- Modify: `src/screens/results/results.test.tsx`
- Modify: `src/screens/results/index.tsx`
- Modify: `src/app/results/[session-id].tsx`

**Interfaces:**
- Consumes: Task 6 `ReviewFrame` groups and `FullRecording` frame-selection API.
- Produces: compact premium badge, horizontal secondary cards, and `onAskCoach(sessionId)` entry for Task 10.

- [ ] **Step 1: Write failing carousel interaction tests**

Render groups containing two observed, one why, and two next frames. Assert purpose buttons, count text, wraparound arrows, direct frame selection, and minimum target sizes.

```tsx
expect(screen.getByText("What happened")).toBeTruthy();
await fireEvent.press(screen.getByText("What to do next"));
expect(screen.getByText("1 of 2")).toBeTruthy();
await fireEvent.press(screen.getByLabelText("Next review frame"));
expect(onSelectFrame).toHaveBeenCalledWith(nextFrames[1]);
expect(screen.getByLabelText("Previous review frame")).toHaveStyle({ minWidth: 48, minHeight: 48 });
```

- [ ] **Step 2: Write failing results-layout tests**

Replace the old premium receipt assertions with:

```tsx
expect(screen.getByText("2 premium runs")).toBeTruthy();
expect(screen.queryByText(/tokens/)).toBeNull();
expect(screen.getByLabelText("Coach summary cards")).toBeTruthy();
expect(screen.getByText("Ask AI Coach about this video")).toBeTruthy();
```

Keep all current assertions for score, evidence, findings, next-set plan, and Record Another Set.

- [ ] **Step 3: Verify RED**

Run: `npm test -- --runInBand src/components/coaching-review-carousel.test.tsx src/screens/results/results.test.tsx`

Expected: FAIL because the carousel and compact layout are absent.

- [ ] **Step 4: Implement the carousel**

Render only non-empty purposes. Maintain an index per purpose:

```ts
const [purpose, setPurpose] = useState<ReviewPurpose>(firstAvailablePurpose(groups));
const [indices, setIndices] = useState<Record<ReviewPurpose, number>>({ observed: 0, why: 0, next: 0 });
```

Purpose buttons use 44-point height. Previous/next use 48-point controls. The horizontal frame rail renders title plus timestamp and calls `onSelectFrame(frame)`. Selecting a purpose immediately selects its remembered frame in the player.

- [ ] **Step 5: Recompose Coach/results without changing other tabs**

Use `useWindowDimensions`:

- under 720 points, Coach's Verdict and compact premium badge share a wrapping row; What Worked and Next Set Plan render in a horizontal `ScrollView` with cards at `Math.min(width - 48, 330)`;
- at 720 points or wider, use two columns;
- keep the player and carousel full width;
- keep finding detail and record-another navigation unchanged.

Replace `PremiumReviewReceipt` with:

```tsx
function PremiumRunsBadge({ review }: { review: PrecisionReview }) {
  return (
    <View accessibilityLabel="Premium review usage" style={{ minWidth: 112, padding: spacing.sm, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <Text style={[typography.heading, { color: colors.gold }]}>{review.runsUsed}</Text>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{review.runsUsed === 1 ? "premium run" : "premium runs"}</Text>
    </View>
  );
}
```

Add `onAskCoach` and a button after the review carousel.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- --runInBand src/components/coaching-review-carousel.test.tsx src/screens/results/results.test.tsx src/components/full-recording.test.ts`

Run: `npm run typecheck`

```powershell
git add -- src/components/coaching-review-carousel.tsx src/components/coaching-review-carousel.test.tsx src/screens/results src/app/results/'[session-id].tsx'
git commit -m "feat: redesign coach results around video frames"
```

---

### Task 8: Add private, owner-scoped Coach persistence

**Files:**
- Create: `supabase/migrations/202607160011_video_coach_threads.sql`
- Modify: `supabase/tests/rls.sql`

**Interfaces:**
- Produces: `coach_threads` and `coach_messages` tables with owner-only RLS.
- Consumed by: Task 9 Edge Function and Task 10 client.

- [ ] **Step 1: Add failing pgTAP assertions**

Assert both tables and required columns exist, one thread is unique per user/session, foreign keys cascade appropriately, and an authenticated test user cannot read another user's rows.

```sql
select has_table('public', 'coach_threads');
select has_table('public', 'coach_messages');
select has_column('public', 'coach_threads', 'session_id');
select has_column('public', 'coach_threads', 'gemini_file_name');
select has_column('public', 'coach_messages', 'role');
```

- [ ] **Step 2: Verify RED**

Run: `npx supabase test db`

Expected: FAIL because Coach tables do not exist.

- [ ] **Step 3: Create the migration**

```sql
create table public.coach_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.analysis_sessions(id) on delete cascade,
  target_intent text check (target_intent is null or char_length(target_intent) between 1 and 240),
  gemini_file_name text,
  gemini_file_uri text,
  gemini_file_state text check (gemini_file_state in ('PROCESSING', 'ACTIVE', 'FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_id)
);

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.coach_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  created_at timestamptz not null default now()
);
```

Enable RLS. Add owner-select policies for both tables and an owner-insert policy for `coach_threads`. Client message insertion is not granted; the service-role Edge Function writes both roles after validation. Grant authenticated users `select, insert` on `coach_threads` and `select` on `coach_messages`.

- [ ] **Step 4: Verify GREEN and commit**

Run: `npx supabase db reset --no-seed=false`

Run: `npx supabase test db`

```powershell
git add -- supabase/migrations/202607160011_video_coach_threads.sql supabase/tests/rls.sql
git commit -m "feat: add private video coach conversations"
```

---

### Task 9: Implement the video-aware Coach Edge Function

**Files:**
- Create: `supabase/functions/_shared/coach-contract.test.ts`
- Create: `supabase/functions/_shared/coach-contract.ts`
- Create: `supabase/functions/_shared/coach-prompt.test.ts`
- Create: `supabase/functions/_shared/coach-prompt.ts`
- Create: `supabase/functions/_shared/gemini-coach.test.ts`
- Create: `supabase/functions/_shared/gemini-coach.ts`
- Create: `supabase/functions/coach-chat/handler.test.ts`
- Create: `supabase/functions/coach-chat/handler.ts`
- Create: `supabase/functions/coach-chat/index.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- POST `/coach-chat` consumes `{ sessionId: string, message: string, targetIntent?: string }`.
- GET `/coach-chat?sessionId=...` returns `{ thread, messages }` or `{ thread: null, messages: [] }`.
- POST returns `{ threadId, userMessage, assistantMessage }`.

- [ ] **Step 1: Write failing request/response contract tests**

Reject invalid UUIDs, blank or over-2000-character user messages, over-240-character target intent, arbitrary video paths, and extra keys. Parse saved assistant messages with role exactly `assistant`.

```ts
expect(() => parseCoachRequest({
  sessionId: "not-a-uuid",
  message: "Check my shoulder position",
})).toThrow("A valid sessionId is required");
```

- [ ] **Step 2: Write failing prompt safety tests**

Assert the prompt includes the selected analysis result, timestamped evidence, optional target intent, and bounded conversation messages. Assert it contains explicit prohibitions on measured muscle activation, medical diagnosis, and unsupported visibility claims.

- [ ] **Step 3: Write failing Gemini client tests**

Mock `generateContent` and assert the request contains both:

```ts
{ fileData: { fileUri: activeFile.uri, mimeType: "video/mp4" } }
{ text: expect.stringContaining("Selected analysis") }
```

Reject missing candidates, empty text, non-active file state, and non-2xx responses.

- [ ] **Step 4: Write failing handler tests**

Cover unauthorized request, unowned session, non-terminal session, missing stored video, create-or-resume thread, file upload only when needed, last 20 messages in chronological order, persisted user/assistant messages, GET history, and model failure without a fake assistant message.

```ts
expect(deps.generateReply).toHaveBeenCalledWith(expect.objectContaining({
  videoFile: expect.objectContaining({ state: "ACTIVE" }),
  history: expect.arrayContaining([expect.objectContaining({ role: "user" })]),
  analysis: ownedSession.result,
}));
```

- [ ] **Step 5: Verify RED**

Run: `npm test -- --runInBand supabase/functions/_shared/coach-contract.test.ts supabase/functions/_shared/coach-prompt.test.ts supabase/functions/_shared/gemini-coach.test.ts supabase/functions/coach-chat/handler.test.ts`

Expected: FAIL because Coach backend files do not exist.

- [ ] **Step 6: Implement contract, prompt, and Gemini client**

Use plain-text model output limited to 4000 characters. Build one request from the active Gemini file, server-loaded analysis, optional target intent, and at most 20 saved messages. Never accept analysis JSON, signed URLs, or file identifiers from the client.

The system instruction includes:

```text
Discuss only mechanics visible in the selected recording and the supplied verified analysis.
You may explain how visible setup can bias an exercise toward a target muscle, but never claim measured muscle activation.
Do not diagnose pain, injury, disease, or joint loading. If the question needs evidence the video does not show, say that clearly.
Use timestamps when referring to a specific visible moment. Give one practical next-set action at a time.
```

- [ ] **Step 7: Implement the handler and Edge Function wiring**

The index authenticates with `requireUserId`, loads the owned terminal session and result, downloads `session.video_path` from private storage, uploads it to Gemini when the thread has no reusable ACTIVE file, and polls PROCESSING with delays `[500, 1000, 2000, 4000, 8000]`. Persist file metadata on the thread.

On POST, persist the user message before generation and persist assistant output only after a valid response. On GET, return only the owned thread/messages. Add the function to `supabase/config.toml` with JWT verification enabled.

- [ ] **Step 8: Verify and commit**

Run: `npm test -- --runInBand supabase/functions/_shared/coach-contract.test.ts supabase/functions/_shared/coach-prompt.test.ts supabase/functions/_shared/gemini-coach.test.ts supabase/functions/coach-chat/handler.test.ts`

Run: `npm run typecheck`

```powershell
git add -- supabase/functions/_shared/coach-contract.ts supabase/functions/_shared/coach-contract.test.ts supabase/functions/_shared/coach-prompt.ts supabase/functions/_shared/coach-prompt.test.ts supabase/functions/_shared/gemini-coach.ts supabase/functions/_shared/gemini-coach.test.ts supabase/functions/coach-chat supabase/config.toml
git commit -m "feat: add video-aware coach backend"
```

---

### Task 10: Add the Coach tab, required video picker, and result handoff

**Files:**
- Create: `src/features/coach/types.ts`
- Create: `src/features/coach/api.test.ts`
- Create: `src/features/coach/api.ts`
- Create: `src/screens/coach/coach.test.tsx`
- Create: `src/screens/coach/index.tsx`
- Create: `src/components/coach-tab-icon.tsx`
- Create: `src/app/(tabs)/(coach)/_layout.tsx`
- Create: `src/app/(tabs)/(coach)/index.tsx`
- Modify: `src/app/(tabs)/_layout.tsx`
- Modify: `src/screens/results/results.test.tsx`
- Modify: `src/screens/results/index.tsx`
- Modify: `src/app/results/[session-id].tsx`

**Interfaces:**
- Produces: `getCoachConversation(sessionId)`, `sendCoachMessage(input)`, and `CoachScreen`.
- Consumes: `useAnalysisHistory`, Task 9 API, and result-level optional `sessionId` route param.

- [ ] **Step 1: Write failing Coach API tests**

Assert bearer auth, GET query encoding, POST body, Zod parsing, and typed server errors.

```ts
await sendCoachMessage({
  accessToken: "user-jwt",
  sessionId: "11111111-1111-4111-8111-111111111111",
  message: "Am I keeping my shoulders level?",
  targetIntent: "upper back",
  baseUrl,
  fetcher,
});
expect(fetcher).toHaveBeenCalledWith(
  `${baseUrl}/coach-chat`,
  expect.objectContaining({
    method: "POST",
    body: JSON.stringify({
      sessionId: "11111111-1111-4111-8111-111111111111",
      message: "Am I keeping my shoulders level?",
      targetIntent: "upper back",
    }),
  }),
);
```

- [ ] **Step 2: Write failing screen tests**

Cover:

- tab entry with no param shows `Choose a video to ask your coach` and no composer;
- only terminal history rows appear;
- selecting a video opens its conversation and composer;
- result preselection skips the picker but Change Video remains available;
- optional target intent can be added or skipped;
- sending shows the user's message immediately, then the saved assistant response;
- failure keeps the draft and offers Retry;
- messages are not rendered as HTML.

- [ ] **Step 3: Verify RED**

Run: `npm test -- --runInBand src/features/coach/api.test.ts src/screens/coach/coach.test.tsx src/screens/results/results.test.tsx`

Expected: FAIL because Coach client/UI does not exist.

- [ ] **Step 4: Implement API and route adapter**

Use the centralized `getAccessToken`. The tab route reads optional `sessionId` from `useLocalSearchParams`, filters `useAnalysisHistory()` to terminal rows, and passes them to `CoachScreen`.

Result handoff uses:

```ts
router.push({
  pathname: "/(tabs)/(coach)",
  params: { sessionId },
});
```

Opening the tab normally supplies no param and therefore always starts at the picker.

- [ ] **Step 5: Implement Coach screen states**

The picker uses exercise-family icon, label, date, score, and status in 56-point rows. Conversation header shows selected video and Change Video. Use a keyboard-safe scroll view plus bottom composer. Disable Send only for blank text or an active request. Keep target intent behind a compact optional control labeled `What are you trying to target?`.

Use optimistic local user-message rendering, then replace from the server response. On retry, resend the retained draft exactly once.

- [ ] **Step 6: Add the fourth tab icon and result action**

`CoachTabIcon` renders a native line chat bubble using bordered `View` elements so no new raster asset is required. Use the exact bottom-tab order Home, Coach, Progress, Profile, with a 30-point icon and existing tab colors.

Results receives `onAskCoach` and displays `Ask AI Coach about this video` directly after the evidence carousel.

- [ ] **Step 7: Verify and commit**

Run: `npm test -- --runInBand src/features/coach/api.test.ts src/screens/coach/coach.test.tsx src/screens/results/results.test.tsx`

Run: `npm run typecheck`

```powershell
git add -- src/features/coach src/screens/coach src/components/coach-tab-icon.tsx src/app/'(tabs)'/'(coach)' src/app/'(tabs)'/_layout.tsx src/screens/results src/app/results/'[session-id].tsx'
git commit -m "feat: add private video coach tab"
```

---

### Task 11: Run full verification and validate the real mobile flow

**Files:**
- Modify only if verification exposes a regression in files already listed above.

**Interfaces:**
- Verifies every interface produced by Tasks 1 through 10.

- [ ] **Step 1: Run all focused regression suites together**

Run:

```powershell
npm test -- --runInBand src/features/capture/upload-coordinator.test.ts src/features/capture/capture-store.test.ts src/lib/auth-refresh-lifecycle.test.ts src/features/analysis/progress-stages.test.ts src/features/analysis/review-frames.test.ts src/components/full-recording.test.ts src/components/coaching-review-carousel.test.tsx src/screens/analysis-progress/analysis-progress.test.tsx src/screens/home/home.test.tsx src/screens/recording-tips/recording-tips.test.tsx src/screens/results/results.test.tsx src/features/coach/api.test.ts src/screens/coach/coach.test.tsx supabase/functions/complete-upload/handler.test.ts supabase/functions/analyze-video/handler.test.ts supabase/functions/_shared/coach-contract.test.ts supabase/functions/_shared/coach-prompt.test.ts supabase/functions/_shared/gemini-coach.test.ts supabase/functions/coach-chat/handler.test.ts
```

Expected: all focused suites pass with no console errors or unhandled promise rejections.

- [ ] **Step 2: Run repository-wide static and unit verification**

Run: `npm test -- --runInBand`

Run: `npm run typecheck`

Run: `npm run lint`

Expected: all tests, TypeScript, and Expo lint pass.

- [ ] **Step 3: Verify database migrations locally**

Run: `npx supabase db reset --no-seed=false`

Run: `npx supabase test db`

Expected: 12 FPS constraint, Coach tables, and RLS assertions pass.

- [ ] **Step 4: Verify exportability**

Run: `npx expo export --platform android --output-dir dist-android-final`

Expected: Android export completes and includes the new Coach route without bundling server secrets.

- [ ] **Step 5: Verify mobile behavior on a real recording**

Use one Android or iOS device and confirm in order:

1. Empty Home fills the available tab content.
2. Recording Tips shows the body/target-area guidance.
3. Camera records without exercise selection.
4. Stop switches to analysis UI immediately.
5. Upload proceeds on analysis UI and can be retried with airplane mode interruption.
6. Background/foreground produces no auto-refresh tick warning.
7. Native stage rows advance from upload through coaching.
8. Results shows compact premium runs and horizontal supporting cards.
9. Every timeline dot is easy to press.
10. Each purpose tab rotates through multiple real frames.
11. High-confidence frames show circle/arrow and 1.7x focus.
12. Pinch zoom, Show Full Frame, and Restore AI Focus work without losing selected explanation.
13. Coach tab requires choosing a video.
14. Ask Coach from Results preselects the correct video.
15. Coach cites visible timestamps and refuses unsupported activation/medical claims.

- [ ] **Step 6: Deploy only after local verification is green**

Run:

```powershell
npx supabase db push
npx supabase functions deploy complete-upload
npx supabase functions deploy analyze-video
npx supabase functions deploy coach-chat
```

Smoke-test the live 12 FPS completion function and one owner-scoped Coach message before calling deployment complete.

- [ ] **Step 7: Record final evidence**

Save exact test counts, export result, migration result, deployed function versions, and the device flow outcome in the final handoff. Do not claim the video upload or Coach is fixed based only on unit tests.

---

## Plan Self-Review

- Every confirmed design requirement maps to a task: upload mismatch (1), immediate transition (2), refresh warning (3), progress motion (4), empty Home/tip (5), frame carousel and focus controls (6-7), Coach persistence/backend/client (8-10), and full/live verification (11).
- Interfaces use consistent names: `REQUESTED_ANALYSIS_FPS`, `createUploadCoordinator`, `ReviewPurpose`, `ReviewFrame`, `buildReviewFrames`, `getCoachConversation`, and `sendCoachMessage`.
- No task changes Progress or Profile UI.
- No task introduces generated exercise pictures; all carousel visuals come from selected evidence frames.
- No task uses subagents.
