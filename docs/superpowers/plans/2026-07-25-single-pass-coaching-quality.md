# Analyst-Coach Quality Implementation Plan

> **For this workspace:** Execute inline in the current session. `AGENTS.md` forbids subagents.

**Goal:** Use one full-video Gemini 3.6 Flash analyst to identify the exercise and issues, use a text-only coach to write concise feedback, and limit each issue to three or four total sentences.

**Architecture:** The backend analyst owns all facts. The coaching writer may change wording only. The client deterministically budgets sentences across the existing three coaching tabs.

**Tech Stack:** TypeScript, Deno/Supabase Edge Functions, Gemini GenerateContent API, React Native, Jest.

## Global Constraints

- Analyst model: `gemini-3.6-flash`.
- Requested video sampling: 12 FPS.
- Media resolution: `MEDIA_RESOLUTION_HIGH`.
- Thinking level: high.
- Video request: complete uploaded analysis input with no start or end offset.
- Source artifact: `analysis_sessions.video_path`; never `analysis_video_path`.
- No ranking, primary-correction, verifier, rubric, pose, or exact-frame decision flow.
- Maximum four total sentences for each displayed issue.

---

### Task 1: Separate analyst facts from coaching copy

**Files:**
- Modify: `supabase/functions/analyze-video/single-pass-runner.test.ts`
- Modify: `supabase/functions/analyze-video/single-pass-runner.ts`
- Modify: `supabase/functions/analyze-video/single-pass-index-wiring.test.ts`
- Modify: `supabase/functions/analyze-video/index.ts`

**Interfaces:**
- `advanceSinglePassPipeline(session, dependencies)` persists both analyst and writer results for safe resumption.
- `assembleResult(decision, writerCopy)` combines immutable facts with concise copy.

- [x] Write failing runner and wiring tests for one video analyst and one text-only writer.
- [ ] Add a failing wiring assertion that rejects the preprocessed analysis path.
- [ ] Run the focused tests and confirm they fail because the writer is still wired.
- [x] Always upload `video_path`, persist analyst facts, then run the text-only coaching writer.
- [x] Run the focused tests and confirm they pass.

### Task 2: Remove correction ranking

**Files:**
- Modify: `supabase/functions/_shared/single-pass-analysis.test.ts`
- Modify: `supabase/functions/_shared/single-pass-analysis.ts`

**Interfaces:**
- `AnalysisDecision` contains the complete supported correction inventory without a primary ID.

- [x] Add a failing contract test proving multiple corrections need no ranking.
- [x] Remove ranking fields, parser validation, and ranking prompt instructions.
- [x] Run the contract test and confirm it passes.

### Task 3: Enforce the four-sentence UI budget

**Files:**
- Modify: `src/features/analysis/review-frames.test.ts`
- Modify: `src/features/analysis/review-frames.ts`

**Interfaces:**
- `buildCoachingReviewPoints(result)` continues returning observed, why, and next frames.
- The three frame bodies contain at most four sentences in total for each point.

- [ ] Add a failing test using deliberately verbose historical `expandedCoaching`.
- [ ] Run the focused test and confirm it fails because expanded copy is displayed.
- [ ] Prefer analyst fields, ignore expanded writer paragraphs, and budget one observed, one why, and up to two next-step sentences.
- [ ] Run the focused test and confirm it passes.

### Task 4: Verify and deploy

**Files:**
- Verify all modified files.
- Deploy: `supabase/functions/analyze-video`.

- [ ] Run the focused backend and client tests.
- [ ] Run TypeScript checking.
- [ ] Run the complete Jest suite.
- [ ] Deploy `analyze-video` and download the deployed source to confirm it matches local.
- [x] Reanalyze the latest row video and inspect exercise recognition, findings, analyst telemetry, writer telemetry, and sentence counts.
