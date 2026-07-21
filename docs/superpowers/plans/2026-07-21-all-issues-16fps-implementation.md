# All-Issues 16 FPS Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not use subagents in this repository. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the single Gemini analyst retain every distinct visible issue, request the original video at 16 FPS with high thinking, and display every returned issue once on Results while keeping repeated evidence in More Details.

**Architecture:** `gemini-3.6-flash` remains the only video analyst. Its five-dimension audit explicitly labels whether each dimension contains an issue; every issue-labelled dimension must reference an existing correction finding. The client renders all correction findings as a visible list, while `buildCoachingReviewPoints` continues using one representative frame per finding and the finding-detail screen keeps every evidence moment.

**Tech Stack:** TypeScript, Supabase Edge Functions, Gemini Files/generateContent APIs, Expo React Native, Jest, Zod.

## Global Constraints

- Exactly one video-analysis call using `gemini-3.6-flash`.
- Request exactly 16 FPS, `MEDIA_RESOLUTION_HIGH`, and `thinkingLevel: "high"`.
- The Lite writer is text-only and cannot change findings, score, severity, evidence, or timestamps.
- Report every distinct clearly visible issue, including note-level issues; never force an arbitrary correction count or infer hidden mechanics.
- Render every issue once on Results. Keep additional evidence moments in More Details.
- Do not query exercise criteria, catalogs, rubrics, verifiers, pose data, or trackers.
- Preserve historical result compatibility.
- Do not stage overlapping implementation files from the dirty checkout without reviewing their complete diff.

---

### Task 1: Centralize and verify 16 FPS video analysis

**Files:**
- Modify: `supabase/functions/_shared/analysis-settings.ts`
- Modify: `supabase/functions/_shared/analysis-settings.test.ts`
- Modify: `supabase/functions/analyze-video/index.ts`
- Modify: `supabase/functions/analyze-video/single-pass-index-wiring.test.ts`

**Interfaces:**
- Produces: `REQUESTED_ANALYSIS_FPS = 16 as const`.
- Consumes: `buildVideoGenerateContentRequest({ fps: REQUESTED_ANALYSIS_FPS, thinkingLevel: "high" })`.

- [ ] **Step 1: Write the failing FPS wiring tests**

Update the settings expectation to `16` and assert `index.ts` imports and passes `REQUESTED_ANALYSIS_FPS` instead of declaring a second numeric FPS constant.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npx jest --runInBand supabase/functions/_shared/analysis-settings.test.ts supabase/functions/analyze-video/single-pass-index-wiring.test.ts`

Expected: FAIL because the shared value is `18` and the analyzer still declares `ANALYSIS_FPS = 12`.

- [ ] **Step 3: Implement the single 16 FPS source of truth**

Set `REQUESTED_ANALYSIS_FPS` to `16`, import it in `analyze-video/index.ts`, and use it for both the request's `videoMetadata.fps` and telemetry's `requested_fps`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the command from Step 2. Expected: both suites PASS.

### Task 2: Make the five-dimension audit retain minor issues

**Files:**
- Modify: `supabase/functions/_shared/single-pass-analysis.ts`
- Modify: `supabase/functions/_shared/single-pass-analysis.test.ts`

**Interfaces:**
- Produces internally validated score rationale items with `assessment: "strong" | "issue" | "limited"`.
- Produces public `AnalysisCandidate.scoreRationale` without changing its saved compatibility shape.

- [ ] **Step 1: Write failing contract tests**

Add tests proving:

```ts
const issueWithoutCorrection = decision();
issueWithoutCorrection.scoreRationale[1] = {
  criterion: "path_alignment",
  assessment: "issue",
  observed: "The working shoulder rises at the top.",
  impact: 10,
  confidence: 0.85,
  evidenceIds: [],
};
expect(() => parseAnalysisDecision(issueWithoutCorrection, 25_020))
  .toThrow(/issue.*correction/i);
```

Also assert the prompt contains `final small-issue sweep`, `retain note-level deviations`, and `do not stop after the main correction`.

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npx jest --runInBand supabase/functions/_shared/single-pass-analysis.test.ts`

Expected: FAIL because `assessment` is not accepted or required and the prompt lacks the exact exhaustive sweep language.

- [ ] **Step 3: Implement internal audit assessment validation**

Extend the analyst JSON schema and parser so each score rationale item requires `assessment`. For analyzed recordings, reject an `issue` assessment unless `evidenceIds` contains at least one ID belonging to a correction finding. Keep `strong` and `limited` dimensions from forcing findings. Strip the internal `assessment` property when `mergeWriterCopy` builds the public result.

Strengthen the prompt with a final pass that examines setup/stability, path/alignment, range/positions, control/tempo, and consistency for small visible deviations. Explicitly keep a related issue separate only when it is visually distinct; repeated instances of one problem remain one finding.

- [ ] **Step 4: Run the contract test and verify GREEN**

Run the command from Step 2. Expected: all single-pass contract tests PASS.

### Task 3: Display every issue once on Results

**Files:**
- Modify: `src/screens/results/index.tsx`
- Modify: `src/screens/results/results.test.tsx`
- Verify: `src/screens/finding-detail/index.tsx`

**Interfaces:**
- Consumes: `buildCoachingReviewPoints(result): CoachingReviewPoint[]`, one point per finding using its first evidence moment.
- Produces: an `all-issues-list` that selects a point by index and opens its existing finding detail.

- [ ] **Step 1: Write the failing Results tests**

Using the existing result fixture with four corrections, assert:

```ts
expect(screen.getByTestId("all-issues-list")).toBeTruthy();
for (let index = 1; index <= 4; index += 1) {
  expect(screen.getByText(`Priority ${index}`)).toBeTruthy();
}
expect(screen.getAllByLabelText(/^Open issue details:/)).toHaveLength(4);
```

Assert the two evidence moments in each fixture do not create duplicate issue rows. Add a new single-pass `scoreRationale` fixture and assert `Why this score` renders its five `observed` strings without requiring `scorecard`.

- [ ] **Step 2: Run the Results test and verify RED**

Run: `npx jest --runInBand src/screens/results/results.test.tsx`

Expected: FAIL because only the selected priority appears in the summary and new score rationale is not rendered.

- [ ] **Step 3: Implement the all-issues list and score explanation**

Render `points.map(...)` in an `all-issues-list`. Each row displays severity, title, and concise correction; pressing the row selects its representative frame, and a clearly labelled More Details action calls `onFindingPress`. Do not flatten `finding.evidence` in this list.

When `result.scorecard` is absent and `result.scoreRationale` contains five entries, render a catalog-free `Why this score` section using `SCORE_LABELS`, `observed`, and confidence. Preserve the existing legacy scorecard block for historical results.

- [ ] **Step 4: Run Results and finding-detail tests and verify GREEN**

Run: `npx jest --runInBand src/screens/results/results.test.tsx src/screens/finding-detail/finding-detail.test.tsx src/features/analysis/review-frames.test.ts`

Expected: all suites PASS, and finding detail still exposes every evidence moment.

### Task 4: Verify the integrated pipeline

**Files:**
- Verify only: all files changed in Tasks 1-3.

- [ ] **Step 1: Run focused pipeline tests**

Run: `npx jest --runInBand supabase/functions/_shared/analysis-settings.test.ts supabase/functions/_shared/gemini-generate.test.ts supabase/functions/_shared/single-pass-analysis.test.ts supabase/functions/analyze-video/single-pass-index-wiring.test.ts supabase/functions/analyze-video/single-pass-runner.test.ts src/screens/results/results.test.tsx src/screens/finding-detail/finding-detail.test.tsx src/features/analysis/review-frames.test.ts`

Expected: every suite PASS.

- [ ] **Step 2: Run full static and unit verification**

Run: `npm test -- --runInBand`, `npm run typecheck`, and `npm run lint`.

Expected: all commands exit `0`.

- [ ] **Step 3: Run the same row video non-persistingly**

Upload `%TEMP%\FormaiPlanInspect\latest.mp4` to Gemini Files, make one `gemini-3.6-flash` request using the production prompt/schema at 16 FPS and high thinking, then optionally make the text-only Lite writer request. Print the score, all correction titles/severities, evidence peaks, and telemetry. Delete the temporary Gemini file.

Expected: telemetry shows one 16 FPS/high-thinking video call; every returned issue passes the contract and appears once in the Results fixture behavior. Rep-count variance is informational, not an acceptance blocker.

- [ ] **Step 4: Deploy only the affected function after verification**

Run: `npx supabase functions deploy analyze-video --project-ref jnprpjnnjyrhvfeflpju`.

Expected: deployment succeeds. Do not deploy if focused/full tests fail or the live call violates the correction contract.
