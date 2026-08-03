# v49 Isolated Problem-Finder Implementation Guide

## Goal and invariant

Replace the active producer rather than modifying v48 in place. New analyses are produced only by `analyze-video-v49`; historical code is read-only and cannot be imported by the producer.

## File-by-file implementation

### Producer modules

- `supabase/functions/analyze-video-v49/config.ts`: define only v49 version/model names, movement-agnostic 4 FPS sampling, high media resolution, thinking levels, and generation deadline. Four FPS preserves brief squat, press, pull, and hinge transitions without using a movement-specific frame strategy.
- `problem-finder.ts`: define the discriminated result, simple full-video prompt, response schema, attached evidence parser, duplicate-ID/timestamp validation, and `unable` parsing. The prompt asks for at least four distinct problems when four genuine problems are visibly supported, requires continued inspection after the first issue, and explicitly permits fewer or zero rather than fabricated filler. Declaration amount/load/side/style/note are identification context and cannot be graded as video claims.
- `problem-finder.test.ts`: reject movement/body checklists, named faults, scores, muscles, strengths, phases, and rep-count work; assert the genuine-four search instruction and no-filler exception; cover zero, one, many, evidence, and unable results.
- `coaching-writer.ts`: serialize declaration, catalog context, and immutable problems; request public coaching fields; structurally validate one issue-derived score for each of the first four immutable problems, anatomy, exact IDs/order, nonempty issue regions, and set-summary shape. The writer returns no independent overall score; deterministic code averages only the grounded issue scores. Repeated muscle-map regions are display-normalized by keeping the first region entry and removing primary/secondary overlap; the raw writer output remains stored and no problem, evidence, or coaching sentence is changed.
- `coaching-writer.test.ts`: prove exact exercise/anatomy language survives and missing/extra/reordered IDs or public-shape-invalid output fails.
- `result-mapper.ts`: copy evidence from 3.6, map one correction and next-set item per ID, keep `didWell` empty, and create the existing `AnalysisCandidate` shape.
- `result-mapper.test.ts`: compare source evidence fields and parse the mapped payload with `analysisResultSchema`.
- `canonical-json.ts`: recursively sort object keys before SHA-256 hashing; preserve array order.
- `canonical-json.test.ts`: prove JSONB key reordering does not create a new stage hash and problem ordering does.
- `video-input.ts`: select only the retained complete video, encode the exact downloaded bytes for the isolated inline request, and hash those bytes for the stage input identity without importing old input logic.
- `video-input.test.ts`: cover accepted retained inputs, byte-for-byte base64/hash preparation, and rejected missing/empty input.
- `pipeline-runner.ts`: execute finder, short-circuit unable, then writer, deterministic mapper, and commit.
- `pipeline-runner.test.ts`: prove unable never calls writer/commit and complete invokes one logical call per stage.
- `handler.ts`: validate `{sessionId, runId?}`, authenticate ownership, and restrict explicit/shadow run IDs to shadow-authorized callers.
- `handler.test.ts`: cover malformed requests, ownership, primary, and shadow authorization.
- `index.ts`: orchestrate storage download, exact inline video preparation, one canonically leased `problem_finder` call, one canonically leased `coaching_writer` call, model telemetry, parsing, permanent schema failure, and atomic unable/commit. Include the selected video path, SHA-256, byte length, duration, declaration, model, FPS, and resolution in the finder hash.
- `index-wiring.test.ts`: assert model split, v49 RPCs/tables, and no legacy endpoint wiring.
- `isolation.test.ts`: recursively inspect producer imports and reject old analyzer, writer, sanitizer, adapter, and stage-runner paths.
- `v49-migration.test.ts`: verify versioned tables, unique stages, raw outputs, RLS/service role, deterministic failure behavior, shadow isolation, preservation, and stale commit fencing.

### Database

- `supabase/migrations/202608030001_problem_finder_v49_isolation.sql`: create run/stage tables; add session/telemetry run IDs; revoke client table access; add primary/shadow start, lease claim/complete/fail, unable, deterministic run failure, fenced commit, and reanalysis reset RPCs. Preserve historical rows and leave the legacy runtime intact during shadow/device rollout.
- Post-release retirement migration: create it only after querying that no legacy run is active; then drop old runtime stage RPCs/table. Keeping it separate prevents the initial v49 schema push from breaking the still-released app.

### Entry points

- `src/features/analysis/api.ts`: call `analyze-video-v49`; parse `failureReason` from status.
- `src/features/analysis/api.test.ts`: assert v49 URL and visible unable reason.
- `src/app/analysis/[session-id].tsx`: prefer Gemini's persisted unable reason over generic failure copy.
- `supabase/functions/complete-upload/handler.ts`: start one primary v49 run after retained input is confirmed.
- `supabase/functions/complete-upload/index.ts`: implement `startV49Run` with the service-role RPC, guarded by the fail-closed `ANALYSIS_V49_PRIMARY_ENABLED=true` release switch. Before cutover it leaves the session on the still-released client route and creates no v49 primary run.
- `supabase/functions/complete-upload/handler.test.ts`: prove the new run is started once in the correct order.
- `supabase/functions/reanalyze-video/index.ts`: use the replaced reset RPC; do not delete old results/telemetry.
- `supabase/functions/reanalyze-video/handler.ts` and `.test.ts`: keep request/authorization behavior and verify ready/busy/missing handling. Before the primary switch is enabled, fail with `V49_NOT_CUT_OVER` before touching the saved result.
- `supabase/functions/retry-analysis/index.ts`: select only active v49 runs/stages and invoke `analyze-video-v49` with retry identity headers. Process zero runs while the primary release switch is disabled.
- `supabase/functions/retry-analysis/index-wiring.test.ts` and `handler.test.ts`: reject legacy endpoint/stage routing and preserve retry authorization.
- `scripts/rerun-failed-analyses.ts`: reanalyze then poll only v49.
- `supabase/config.toml`: register `analyze-video-v49` with JWT verification.

### Read boundary

- `supabase/functions/_shared/result-payload.ts`: route active v49 sessions directly to strict `public_result`; send only non-v49 rows to historical decoding.
- `_shared/result-payload.test.ts`: prove direct v49 pass-through and preserved historical language.
- `supabase/functions/_historical/legacy-result-payload.ts`: retain the minimum old-row shape mapping without coaching sanitization.
- `_historical/score-calibration.ts` and `.test.ts`: keep historical score display behavior outside active shared runtime.
- `supabase/functions/analysis-status/index.ts`: fetch active v49 result/failure explicitly, surface DB errors, and never fall through to old result parsing.
- `analysis-status/v49-wiring.test.ts`: verify the explicit run query/router call.
- `supabase/functions/coach-chat/index.ts`: ground chat from the same routed displayed result.
- `coach-chat/v49-result-wiring.test.ts`: verify active v49 lookup.
- `_shared/analysis-playback-window.ts` and `.test.ts`: return full-video range for v49; use old draft only for historical sessions.
- `src/features/analysis/result-schema.test.ts`: retain exact public compatibility coverage; mapper test supplies the persisted v49 candidate.
- `scripts/verify-saved-analysis.ts`: fetch active v49 public result or historical result explicitly before client-schema parsing.

### QA scripts

- `scripts/smoke-analysis-live.ts`: create a disposable primary run, invoke v49 (optionally concurrently), inspect run/stage/telemetry rows, require exactly one 3.6 problem-finder call and one Flash-Lite writer call for a completed run, validate evidence/client schema, then repeat via saved-video reanalysis.
- `scripts/smoke-analysis-live.test.ts`: reject legacy endpoint/table assumptions.
- `scripts/compare-v49-analysis.ts`: create shadow runs with service authorization, snapshot old routing before/after, and report semantic coverage, unrelated findings, specificity, call counts, schema validity, and generic wording.
- `scripts/compare-v49-analysis.test.ts`: prove evaluator concepts stay out of the finder prompt and all report dimensions are calculated.
- `scripts/fixtures/v49-quality-benchmark.json`: store incline-row expected concepts and evaluator-only generic phrase patterns.
- `package.json`: make `test:analysis` run v49 and retained generic/public integration tests only.

### Rollout boundary

- `supabase/functions/_shared/v49-primary-rollout.ts`: interpret only the exact string `true` as permission to create or resume primary v49 work. This module is used by upload/reanalysis/retry entrypoints and is never imported by the isolated analyzer.
- `_shared/v49-primary-rollout.test.ts`: prove missing, misspelled, mixed-case, and truthy-looking values fail closed.
- Shadow runs do not use this switch; they remain available through the separate shadow authorization secret and never alter `active_v49_run_id`.
- Set the production switch only immediately before releasing the matching app. Keep it false while semantic shadow acceptance is incomplete.

### Deleted active files

Delete every file under `supabase/functions/analyze-video/` and delete `_shared/boundary-free-analysis*`, `_shared/coaching-contract*`, `_shared/legacy-result-adapter.ts`, and active `_shared/score-calibration*`. Do not create forwarding code.

## Verification commands

```powershell
npm run test:analysis
npm run typecheck
npm run lint
git diff --check
```

Then apply/deploy in the order described by the design document, run the selected shadow benchmark, run an unusable-video check, and verify real fresh plus saved-video flows before deleting the deployed legacy function.
