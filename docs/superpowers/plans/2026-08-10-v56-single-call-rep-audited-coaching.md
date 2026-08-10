# V56 Single-Call Rep-Audited Coaching Implementation Plan

> **For this implementation:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` inline. The repository owner prohibits subagents, so every task is executed and reviewed by the primary agent in this session.

**Goal:** Ship a v56 video-analysis pipeline that performs one Gemini call, audits every repetition, returns exactly four evidence-backed issues, and renders bold lead sentences with normal supporting copy.

**Architecture:** The provider call and local interpretation become separate durable boundaries. The `analyzing` lease stores raw Gemini JSON immediately after the one successful call; parsing, evidence validation, mapping, and persistence are local operations that may replay the stored JSON without another model call. The analysis contract replaces arbitrary video-third checkpoints with a sequential audit of every visible repetition and adds separate lead/detail coaching fields.

**Tech Stack:** Expo/React Native, TypeScript, Jest, Deno Supabase Edge Functions, Supabase Postgres/JSONB, Gemini structured output.

## Global Constraints

- Use no subagents.
- Preserve all unrelated dirty worktree changes.
- Return exactly four coaching issues for every usable visually analyzed set.
- Invoke Gemini at most once per analysis or reanalysis attempt.
- Never use a second model call for formatting, coaching writing, validation, rechecking, or finalization.
- Audit every visible repetition and require evidence for every repetition a finding claims.
- `What happened` and `Why it matters` each render one bold sentence followed by one to three normal sentences.
- `What to do next` retains its bold instruction plus normal success check.
- Deploy only functions changed by this plan and verify their remote versions and live behavior.

---

## File map

- `supabase/functions/_shared/boundary-free-analysis.ts`: model JSON contract, parser, rep-evidence invariants, coaching prompt, and public-result mapper.
- `supabase/functions/_shared/boundary-free-analysis.test.ts`: parser/prompt/mapping regression coverage.
- `supabase/functions/_shared/analysis-contract.ts`: shared public coaching shape.
- `supabase/functions/_shared/result-payload.ts`: active whole-video pipeline recognition.
- `supabase/functions/analyze-video/index.ts`: v56 stage ordering, raw-output durability, terminal single-call failure behavior, and telemetry.
- `supabase/functions/analyze-video/whole-video-runner.ts`: explicit raw-provider-output to local-finalization flow.
- `supabase/functions/analyze-video/whole-video-runner.test.ts`: durable replay tests.
- `supabase/functions/analyze-video/whole-video-handler.ts`: terminal-versus-retry decision for v56 failures.
- `supabase/functions/analyze-video/whole-video-handler.test.ts`: no `retry_wait` contract/provider regression.
- `supabase/functions/analyze-video/writer-fallback-wiring.test.ts`: one-call/no-writer source wiring.
- `supabase/functions/retry-analysis/index.ts`: exclude v56 sessions from cron reinvocation.
- `supabase/functions/retry-analysis/handler.ts`: carry pipeline version in retry candidates where required by tests.
- `supabase/functions/retry-analysis/handler.test.ts`: ensure v56 candidates are not invoked.
- `supabase/functions/reanalyze-video/v48-rollback-wiring.test.ts`: assert reanalysis targets active v56 `analyze-video`.
- `src/features/analysis/result-schema.ts`: mobile parsing for lead/detail fields.
- `src/features/analysis/result-schema.test.ts`: compatibility tests.
- `src/features/analysis/review-frames.ts`: transport lead and detail separately to the UI.
- `src/features/analysis/review-frames.test.ts`: review-point copy tests.
- `src/screens/results/index.tsx`: requested text hierarchy.
- `src/screens/results/results.test.tsx`: rendering and style tests.

No migration is planned. Stage outputs and analysis results already use JSONB, and the retry exclusion is enforced in deployed function code.

### Task 1: Define the v56 rep-audited coaching contract

**Files:**
- Modify: `supabase/functions/_shared/boundary-free-analysis.test.ts`
- Modify: `supabase/functions/_shared/boundary-free-analysis.ts`
- Modify: `supabase/functions/_shared/analysis-contract.ts`
- Modify: `supabase/functions/_shared/result-payload.ts`

**Interfaces:**
- Produce `RepAuditItem = { repNumber: number; startMs: number; peakMs: number; endMs: number; visualSummary: string }`.
- Change `BoundaryFreeAnalysis.videoUnderstanding.coverageCheckpoints` to `repAudit: RepAuditItem[]`.
- Change each raw coaching item to contain `observation`, `observationDetails`, `whyItMatters`, `whyDetails`, `correctionDirection`, and `affectedRepNumbers`.
- Add optional `whatHappenedDetail` and `whyItMattersDetail` fields to `CoachingFinding.expandedCoaching`.

- [ ] **Step 1: Write failing parser tests**

Add fixtures with three sequential repetitions and exactly four coaching items. Assert that parsing fails when rep 2 is missing from `repAudit`, when `observedRepCount` differs from `repAudit.length`, when a finding claims rep 3 without rep-3 evidence, when there are fewer or more than four items, when a lead has more than one sentence, or when a detail has zero or more than three sentences.

- [ ] **Step 2: Run the parser tests and confirm RED**

Run:

```powershell
npx jest supabase/functions/_shared/boundary-free-analysis.test.ts --runInBand
```

Expected: failures because `repAudit`, detail fields, exact-four enforcement, and affected-repetition checks do not exist.

- [ ] **Step 3: Implement the parser and schema**

Replace the checkpoint type and parser with a sequential rep audit. Validate `startMs < peakMs < endMs`, timestamps within the recording, strictly increasing repetition numbers from one, and equality with `observedRepCount`. Change the JSON schema so structured output requires all new fields and exactly four coaching items. Require `affectedRepNumbers` to contain unique positive integers.

After evidence selections are attached, compare each coaching item's affected repetition set against its evidence repetition set. Every claimed repetition must be cited; extra evidence is allowed only when it supports the same visible relationship.

- [ ] **Step 4: Implement prompt rules and safe coaching language**

Require the model to enumerate every repetition before selecting four issues. Explicitly prohibit treating knees crossing toes, gaze direction, or above-parallel depth as errors without a visible recorded consequence or declared constraint. Prohibit claims about activation, tissue, internal forces, injury prevention, mobility gains, or guaranteed outcomes. Require exactly four distinct visible relationships; the fourth may be a small visible optimization but must still have its own evidence.

- [ ] **Step 5: Implement public-result mapping**

Map `observation` to bold `whatHappened`, `observationDetails` to normal `whatHappenedDetail`, `whyItMatters` to bold `whyItMatters`, and `whyDetails` to normal `whyItMattersDetail`. Keep legacy `detail` and `whyItMatters` populated with combined readable text for older consumers. Generate the public `repTimeline` directly from `repAudit` so the audit survives beyond the private draft.

- [ ] **Step 6: Run the parser tests and confirm GREEN**

Run the same focused Jest command. Expected: all boundary-free tests pass with zero failures.

### Task 2: Make the provider call durably single-use

**Files:**
- Modify: `supabase/functions/analyze-video/whole-video-runner.test.ts`
- Modify: `supabase/functions/analyze-video/whole-video-runner.ts`
- Modify: `supabase/functions/analyze-video/whole-video-handler.test.ts`
- Modify: `supabase/functions/analyze-video/whole-video-handler.ts`
- Modify: `supabase/functions/analyze-video/index.ts`
- Modify: `supabase/functions/analyze-video/writer-fallback-wiring.test.ts`

**Interfaces:**
- `analyzeWholeVideo` returns durable raw provider JSON, not an already-parsed decision.
- A local `finalizeAnalysis(rawOutput)` dependency parses and maps without network access.
- `PIPELINE_VERSION` becomes `gemini-whole-video-v56-single-call-rep-audit`.
- V56 failures return terminal `failed` rather than `retry_wait`.

- [ ] **Step 1: Write failing one-call durability tests**

Test that the provider result is completed into the `analyzing` stage before the parser is called. Simulate parser failure, re-enter the runner with the successful stage output, and assert the provider mock remains at one call. Test that contract/provider failure produces a terminal failed payload and never schedules `analysis_next_retry_at`.

- [ ] **Step 2: Run focused runner/handler tests and confirm RED**

```powershell
npx jest supabase/functions/analyze-video/whole-video-runner.test.ts supabase/functions/analyze-video/whole-video-handler.test.ts supabase/functions/analyze-video/writer-fallback-wiring.test.ts --runInBand
```

Expected: failures because v55 parses inside the provider lease and maps all failures to `retry_wait`.

- [ ] **Step 3: Reorder the production stage**

Inside `index.ts`, let `runStage(..., "analyzing", ...)` wrap only `generate(...)` and return its raw JSON. Once `runStage` has successfully persisted that raw output, call `parseBoundaryFreeAnalysis(raw, durationMs)` locally. Do not place parsing inside the provider `work` callback. Keep `parseWholeVideoWriting(null, analysis)` local and keep `finalizing` limited to database persistence.

- [ ] **Step 4: Remove automatic retry behavior for v56**

Change the handler/dependency contract so v56 calls a terminal failure persistence path. Persist `status="failed"`, `stage="failed"`, the normalized failure code, clear `analysis_next_retry_at`, release/cancel the reserved analysis credit using the repository's existing failed-attempt path, and clean up the Gemini file. Do not invoke declaration-only coaching after repeated attempts because repeated attempts no longer exist.

- [ ] **Step 5: Add source-wiring assertions**

Assert one video `generate` path, no `runShortClipRechecks`, no writer model constant, no text-generation request in finalization, v56 pipeline recognition, and raw-output parsing after the durable stage call.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run the Task 2 test command. Expected: all suites pass and provider invocation count remains one during replay.

### Task 3: Prevent cron rewatch and preserve explicit reanalysis

**Files:**
- Modify: `supabase/functions/retry-analysis/handler.test.ts`
- Modify: `supabase/functions/retry-analysis/handler.ts` if the candidate type needs `pipelineVersion`
- Modify: `supabase/functions/retry-analysis/index.ts`
- Modify: `supabase/functions/reanalyze-video/v48-rollback-wiring.test.ts`

**Interfaces:**
- Retry candidates include `pipeline_version` where necessary.
- The retry query excludes `gemini-whole-video-v56-single-call-rep-audit`.
- An explicit user `reanalyze-video` request still resets the session and invokes active `analyze-video` once.

- [ ] **Step 1: Write failing retry exclusion tests**

Assert that a due v56 session is not passed to `invokeAnalysis`, while a legacy retryable session remains eligible. Update the reanalysis wiring expectation from v55 to v56.

- [ ] **Step 2: Run tests and confirm RED**

```powershell
npx jest supabase/functions/retry-analysis/handler.test.ts supabase/functions/reanalyze-video/v48-rollback-wiring.test.ts --runInBand
```

- [ ] **Step 3: Implement the v56 exclusion**

Filter v56 out at the database query, not only inside the handler loop, so cron cannot call the function for these sessions. Preserve legacy processing for pre-v56 rows and preserve the explicit reanalysis endpoint.

- [ ] **Step 4: Run tests and confirm GREEN**

Run the same command and require zero failures.

### Task 4: Carry bold lead and normal supporting copy through the app

**Files:**
- Modify: `src/features/analysis/result-schema.test.ts`
- Modify: `src/features/analysis/result-schema.ts`
- Modify: `src/features/analysis/review-frames.test.ts`
- Modify: `src/features/analysis/review-frames.ts`
- Modify: `src/screens/results/results.test.tsx`
- Modify: `src/screens/results/index.tsx`

**Interfaces:**
- `expandedCoaching.whatHappenedDetail?: string`.
- `expandedCoaching.whyItMattersDetail?: string`.
- `ReviewFrame` gains optional `detail?: string` so the renderer never has to split sentences heuristically.

- [ ] **Step 1: Write failing schema and review-point tests**

Add a v56 result fixture and assert that the mobile parser retains both detail fields. Assert observed and why review frames expose separate lead/detail values. Retain a historical fixture without details and assert it still parses and renders the old field as the lead.

- [ ] **Step 2: Write failing screen tests**

On the What happened tab, assert one bold text node contains the lead and one normal text node contains the one-to-three-sentence detail. Repeat for Why it matters. Assert What to do next still renders the instruction and success check using its existing hierarchy.

- [ ] **Step 3: Run mobile tests and confirm RED**

```powershell
npx jest src/features/analysis/result-schema.test.ts src/features/analysis/review-frames.test.ts src/screens/results/results.test.tsx --runInBand
```

- [ ] **Step 4: Implement schema and review-frame transport**

Add optional detail fields to Zod and TypeScript. Update `frameFor`/`buildCoachingReviewPoints` to fill `body` with the bold lead and `detail` with normal supporting copy. Use existing legacy fallbacks only when the new fields are absent.

- [ ] **Step 5: Implement screen rendering**

Render the lead in a dedicated white `Text` node with `fontWeight: "700"`. Render supporting detail in a second `Text` node with normal weight, secondary text color, and the existing readable line height. For What to do next, render the existing instruction and success check without changing their semantics.

- [ ] **Step 6: Run mobile tests and confirm GREEN**

Run the Task 4 test command and require zero failures.

### Task 5: Full verification and dirty-tree review

**Files:**
- Review every file listed above.
- Do not stage or modify unrelated billing, authentication, onboarding, assets, or website files.

- [ ] **Step 1: Run all focused analysis and UI tests**

```powershell
npx jest supabase/functions/_shared/boundary-free-analysis.test.ts supabase/functions/analyze-video/whole-video-runner.test.ts supabase/functions/analyze-video/whole-video-handler.test.ts supabase/functions/analyze-video/writer-fallback-wiring.test.ts supabase/functions/retry-analysis/handler.test.ts supabase/functions/reanalyze-video/v48-rollback-wiring.test.ts src/features/analysis/result-schema.test.ts src/features/analysis/review-frames.test.ts src/screens/results/results.test.tsx --runInBand
```

- [ ] **Step 2: Run TypeScript and lint**

```powershell
npx tsc --noEmit
npm run lint
```

Report existing unrelated warnings separately; require zero new errors.

- [ ] **Step 3: Inspect the exact diff**

Use `git diff --` with only the planned files. Confirm no unrelated user changes are included and no provider keys or secrets appear.

### Task 6: Deploy and prove production behavior

**Files/functions:**
- Deploy: `analyze-video`
- Deploy: `retry-analysis`
- Verify only: `reanalyze-video`, `analysis-status`

- [ ] **Step 1: Deploy the exact changed functions**

```powershell
npx supabase functions deploy analyze-video --project-ref jnprpjnnjyrhvfeflpju --no-verify-jwt
npx supabase functions deploy retry-analysis --project-ref jnprpjnnjyrhvfeflpju --no-verify-jwt
```

- [ ] **Step 2: Verify remote versions and digests**

Run `npx supabase functions list --project-ref jnprpjnnjyrhvfeflpju --output json`. Record the new versions, ACTIVE status, timestamps, and SHA-256 digests for both deployed functions. Confirm unrelated function versions did not change.

- [ ] **Step 3: Run one real analysis acceptance test**

Use a newly recorded or explicitly reanalyzed exercise through the app. Query `analysis_sessions`, `analysis_stage_runs`, `model_call_telemetry`, and `analysis_results` for that session without exposing user identifiers or credentials.

Require:

- one and only one `model_call_telemetry` row;
- `analysis_stage_runs.attempt = 0`;
- no `retry_wait` transition;
- `pipeline_version = gemini-whole-video-v56-single-call-rep-audit`;
- exactly four priority corrections;
- `repAudit.length = observedRepCount` with sequential repetition numbers and valid timestamps;
- every `affectedRepNumbers` entry matched by evidence;
- persisted bold lead and supporting detail fields for both explanatory tabs.

- [ ] **Step 4: Verify device rendering**

Open the result in the running development client. Confirm What happened and Why it matters each show one bold white sentence and one to three normal sentences, and What to do next remains unchanged.

- [ ] **Step 5: Commit and push only the repair**

Stage only the spec, plan, and planned source/test files. Create a scoped commit and push the existing `codex/ios-3d-tracking-scoring` branch. Do not include unrelated dirty files.
