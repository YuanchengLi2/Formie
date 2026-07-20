# Catalog Scale and Flow Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for inline execution. `AGENTS.md` prohibits subagents.

**Goal:** Add at least 10,000 mechanically coherent exercise variations and 120,000 resolved visual criteria, make catalog lookup scale independently of Gemini prompt size, model difficult camera placements, fix evidence timestamp corruption, harden resumable analysis, deploy the changes, and measure all benchmark and flow outcomes.

**Architecture:** Keep explicit materialized variants and criteria, but generate them from constrained blueprints and retrieve a small server-side candidate set by family and equipment. Gemini indexes structured exercise and camera mechanics without seeing the full catalog; deterministic code selects an exact rubric or falls back to observation-only. The staged analyst/verifier/writer pipeline remains persisted and resumable.

**Tech Stack:** TypeScript 5.9, Jest 29, Expo 54, Supabase/Postgres/Edge Functions, Gemini structured video calls, Node migration generators, PowerShell verification.

## Global Constraints

- Final generated count is at least 10,634 variants and 120,000 resolved criteria.
- Existing IDs 1–634 and their slugs remain stable.
- No blind mechanically invalid Cartesian combinations.
- The full catalog is never embedded in a Gemini request.
- Exact resolution requires compatible equipment and an unambiguous deterministic match.
- Unknown, ambiguous, or equipment-conflicting input uses observation-only and receives no score.
- Ground/low upward and equipment-dominant views suppress perspective-sensitive or hidden criteria.
- Public findings are supported-only and capped at two corrections and three strengths.
- Every persisted evidence moment satisfies `startMs <= peakMs <= endMs`.
- No pose, tracker, 3D, worker, or hardcoded joint-angle path is reintroduced.
- Implementation and review remain inline; no subagents.

---

### Task 1: Repair verifier timestamp refinement

**Files:**
- Modify: `supabase/functions/_shared/criteria-pipeline.test.ts`
- Modify: `supabase/functions/_shared/criteria-pipeline.ts`

**Interfaces:**
- Consumes: `CandidateFindingV2`, `VerificationDecisionV2`
- Produces: `finalizeVerifiedFindings()` that never creates an invalid evidence interval

- [ ] Add a failing test where `verifiedPeakMs` is inside the verifier clip but outside every candidate evidence interval; expect the original peak to remain.
- [ ] Add a failing test where `verifiedPeakMs` belongs to the second repeated evidence interval; expect that interval to become the primary evidence with the refined peak.
- [ ] Run `npx jest --runInBand supabase/functions/_shared/criteria-pipeline.test.ts` and confirm both new tests fail for the timestamp mismatch.
- [ ] Implement a pure evidence-refinement helper that selects an interval containing the verified peak and otherwise preserves the valid evidence unchanged.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Model difficult camera geometry and filter rubrics

**Files:**
- Modify: `supabase/functions/analyze-video/criteria-runner.ts`
- Modify: `supabase/functions/_shared/criteria-contracts.ts`
- Modify: `supabase/functions/_shared/criteria-contracts.test.ts`
- Modify: `supabase/functions/_shared/criteria-prompts.ts`
- Modify: `supabase/functions/_shared/criteria-prompts.test.ts`
- Modify: `src/features/exercises/rubric-registry.ts`
- Modify: `src/features/exercises/rubric-registry.test.ts`

**Interfaces:**
- Produces: `CameraGeometryV2` with `view`, `height`, `tilt`, `distance`, `framing`, `visibleRegions`, `occlusions`, `confidence`, and `limitations`
- Produces: criterion camera constraints with `perspective`, `allowedFraming`, and `machineOcclusionSafe`

- [ ] Add parser tests for ground/upward/equipment-dominant camera output and invalid enum rejection.
- [ ] Add rubric tests proving a ground-up machine view retains robust machine-contact/handle criteria but omits perspective-sensitive symmetry/alignment criteria.
- [ ] Run focused tests and confirm failure because the new fields and filtering do not exist.
- [ ] Extend indexer schema/prompt and parsing with the closed camera taxonomy.
- [ ] Extend criterion templates with deterministic camera constraints and filter/weight criteria using direction plus geometry.
- [ ] Keep backward-compatible defaults for persisted pre-v3 index artifacts.
- [ ] Re-run focused parser, prompt, and registry tests.

### Task 3: Generate 10,000-plus coherent execution variations

**Files:**
- Create: `src/features/exercises/execution-variation-blueprints.ts`
- Create: `src/features/exercises/expanded-variant-generator.ts`
- Create: `src/features/exercises/expanded-variant-generator.test.ts`
- Modify: `src/features/exercises/rubric-registry.ts`
- Modify: `src/features/exercises/rubric-registry.test.ts`

**Interfaces:**
- Produces: `ExecutionVariationBlueprint`
- Produces: `buildExpandedVariants(baseVariants): ExerciseVariant[]`
- Produces: `compileExerciseCriteria(variant): ExerciseCriterion[]`

- [ ] Add failing tests requiring at least 10,634 total variants, at least 120,000 criteria, stable original IDs/slugs, unique slugs/mechanics keys, deterministic generation, and 8–15 criteria per variant.
- [ ] Add failing compatibility tests excluding static holds from rep-tempo styles, machine-only rules from free weights, free-weight paths from fixed machines, and unsupported alternating/unilateral styles.
- [ ] Define constrained execution styles for cadence, pauses, controlled eccentric/concentric emphasis, dead-stop, constant-tension, partial-range, and 1.5-repetition protocols with family applicability predicates.
- [ ] Generate deterministic names, aliases, mechanics `executionStyle`, and exact-style rubric criteria from every compatible base variant until the minimum count is exceeded.
- [ ] Refactor rubric resolution to compile criteria for one matched variant on demand rather than filtering a global 120,000-item array.
- [ ] Re-run focused generator and registry tests and record exact totals and generation time.

### Task 4: Replace monolithic catalog SQL with deterministic chunks

**Files:**
- Modify: `scripts/rubric-registry-generator.cjs`
- Modify: `scripts/rubric-registry-generator.test.js`
- Create: `scripts/generated-rubric-manifest.json`
- Create: `supabase/migrations/202607200026_exercise_catalog_scale_schema.sql`
- Generate: `supabase/seed/criteria-v3/*.sql`

**Interfaces:**
- Produces: `writeRubricSeedChunks(outputDirectory, chunkSize)`
- Produces: manifest with counts, SHA-256 checksums, ID bounds, and chunk order

- [ ] Add failing tests for deterministic byte-identical chunks, maximum chunk size, referential ordering, manifest checksums, and required totals.
- [ ] Run `npx jest --runInBand scripts/rubric-registry-generator.test.js` and confirm failure.
- [ ] Separate schema SQL from data, add indexed `equipment_class` and generated search fields, and stream variant/criterion upserts into bounded chunks.
- [ ] Generate chunks twice into separate temporary directories and compare manifests/checksums.
- [ ] Keep the original v2 migration immutable; deploy scale changes through the new schema migration and seed command.

### Task 5: Add scalable deterministic catalog matching

**Files:**
- Create: `supabase/functions/_shared/catalog-matcher.ts`
- Create: `supabase/functions/_shared/catalog-matcher.test.ts`
- Modify: `supabase/functions/_shared/criteria-prompts.ts`
- Modify: `supabase/functions/analyze-video/index.ts`
- Modify: `supabase/functions/analyze-video/criteria-index-wiring.test.ts`

**Interfaces:**
- Produces: `rankCatalogCandidates(indexExercise, candidates)`
- Produces: `{ resolution: "exact" | "observation_only", candidate, score, margin, reasons }`

- [ ] Add failing tests for exact canonical match, alias match, structured mechanics tie-break, incompatible-equipment rejection, ambiguous near-tie fallback, and execution-style fallback.
- [ ] Add a prompt-size test proving indexer prompt length remains bounded when supplied zero versus 10,000 catalog records.
- [ ] Implement normalized token scoring with mandatory family/equipment compatibility and mechanics bonuses; require a minimum score and runner-up margin.
- [ ] Remove the full catalog from `buildIndexerPromptV2`; give Gemini only the closed taxonomy.
- [ ] Query indexed candidates by family/equipment, rank them in server code, and fetch criteria only for the chosen ID.
- [ ] Persist match score/margin/reasons with `resolved_rubric_v2` for auditability.

### Task 6: Harden stage retry, resume, and result validation

**Files:**
- Modify: `supabase/functions/analyze-video/handler.ts`
- Modify: `supabase/functions/analyze-video/handler.test.ts`
- Modify: `supabase/functions/analyze-video/index.ts`
- Modify: `supabase/functions/analyze-video/criteria-runner.ts`
- Modify: `supabase/functions/analyze-video/criteria-runner.test.ts`
- Modify: `supabase/functions/_shared/criteria-contracts.ts`

**Interfaces:**
- Produces: at most one controlled retry for transient model-stage failures
- Produces: final server-side schema/invariant validation before persistence

- [ ] Add failing tests for first transient failure remaining resumable, second failure becoming terminal with a stable code, completed-stage idempotency, persisted frame-request replay, writer fallback, and rejection of invalid final evidence.
- [ ] Implement stage-attempt persistence and retry classification without re-uploading video or repeating completed stages.
- [ ] Validate the assembled result before `analysis_results` upsert; fall back only for writer-copy failures and never persist invalid evidence.
- [ ] Re-run handler, runner, contract, API, and result-schema tests.

### Task 7: Expand benchmark metrics and camera/flow matrices

**Files:**
- Modify: `scripts/video-benchmark-evaluator.cjs`
- Modify: `scripts/video-benchmark-evaluator.test.js`
- Modify: `scripts/run-live-video-matrix.mts`
- Create: `scripts/verify-criteria-flow-matrix.mts`
- Create: `benchmarks/video-analysis/camera-flow-matrix.json`

**Interfaces:**
- Produces: benchmark metrics for client-schema validity, rubric resolution, rep-count error, evidence validity, latency, and model failures
- Produces: deterministic flow-matrix report covering exact, observation-only, camera filtering, no findings, unable, retry, fallback, and resume

- [ ] Add failing evaluator tests for the new metrics and for schema-invalid outputs counting as incomplete.
- [ ] Add a camera matrix spanning five directions, four heights, three tilts, three framings, and machine occlusion states.
- [ ] Add flow assertions for exact score, exact no-score, unknown no-score, equipment mismatch, ground-up machine filtering, unable, verifier suppression, writer fallback, frame retry, and terminal replay.
- [ ] Run evaluator and flow-matrix unit checks.

### Task 8: Full local verification

**Files:**
- Inspect all files changed by Tasks 1–7.

- [ ] Run focused red/green tests for every task.
- [ ] Run `npm test -- --runInBand` and require all suites/tests to pass.
- [ ] Run `npx tsc --noEmit` and require exit 0.
- [ ] Run `npm run lint` and require zero errors; report any warnings exactly.
- [ ] Run deterministic catalog generation twice and verify counts/checksums.
- [ ] Run `git diff --check` and inspect the complete scoped diff for generated junk, secrets, or accidental user-file changes.

### Task 9: Deploy and verify remote state

**Files:**
- Deploy new schema and generated seed chunks.
- Deploy `analyze-video`, `analysis-status`, `complete-exact-frames`, and any changed dependent Edge Functions.

- [ ] Record pre-deploy remote counts and function versions.
- [ ] Apply schema migration and catalog seed chunks with fail-fast logging and resumable chunk bookkeeping.
- [ ] Query remote variant/criteria counts and checksum manifest; require equality with local generation.
- [ ] Deploy changed Edge Functions and confirm active versions.
- [ ] Run authenticated API smoke checks without exposing credentials.

### Task 10: Run live flows and the complete accuracy benchmark

**Files:**
- Output: `benchmarks/video-analysis/results/<timestamp>-live-matrix.json`
- Output: `benchmarks/video-analysis/results/<timestamp>-accuracy-report.json`
- Output: `benchmarks/video-analysis/results/<timestamp>-flow-audit.md`

- [ ] Run a live exact catalog video and require exact resolution, valid client schema, and valid evidence intervals.
- [ ] Run a live out-of-catalog video and require observation-only, null catalog ID, null score, and valid evidence.
- [ ] Run a blank/unusable video and require `unable`, one retry reason/instruction, and no findings or score.
- [ ] Run a low/ground-like machine fixture and inspect retained/suppressed camera criteria.
- [ ] Run all 12 paired benchmark fixtures through the deployed production path.
- [ ] Evaluate and report completion, schema validity, recognition, rep counts, false positives, bad-signal recall, score behavior, evidence validity, latency, and cost telemetry.
- [ ] Compare with prior reports only where identical fixtures and metrics exist; do not invent a universal accuracy percentage.

### Task 11: Completion audit

**Files:**
- Update: `benchmarks/video-analysis/results/<timestamp>-flow-audit.md`

- [ ] Map every objective/spec requirement to current authoritative evidence.
- [ ] Mark missing or contradicted items incomplete and continue work until resolved.
- [ ] Confirm at least 10,000 additional exercises, all criteria counts, deployment, benchmark completion, observation-only behavior, camera behavior, and flow reliability.
- [ ] Mark the persistent goal complete only after every required item is proven.
