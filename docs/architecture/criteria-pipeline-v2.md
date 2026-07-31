# FORM criteria pipeline v3 / catalog v5

## Outcome

FORM uploads the original recording once, maps it with a low-cost indexer, resolves an exact exercise-and-equipment rubric, analyzes the active set at 12 FPS, independently verifies each candidate finding, and writes coaching only from findings that survive both evidence gates.

The retired pose, 3D, body-packet, joint-angle, overlay, and broad single-pass paths are not part of the active decision path.

## Criteria catalog

The source registry is `src/features/exercises/rubric-registry.ts`. The deterministic generator in `scripts/rubric-registry-generator.cjs` materializes it as migration `202607190024_exercise_rubric_registry_v2.sql`.

Current deployed compiled coverage:

- 634 original variants with stable IDs
- 12,283 total exact exercise and execution-style variants
- 159,372 visual criteria
- 77 checksum-tracked SQL deployment chunks

Each variant has a mechanical identity including its family, equipment class, support style, resistance path, limb mode, body orientation, and implement path. Incline barbell, dumbbell, Smith, selectorized, plate-loaded, iso-lateral, machine-fly, and cable-fly variations therefore resolve independently.

Resolution is deliberately strict:

1. Accept a catalog candidate only when family, equipment class, explicit laterality, and execution style match the indexed mechanics.
2. Rank the primary visible label and confidence-weighted visible alternatives, so a generic primary label cannot override a specific unilateral alternative.
3. Load only that exact variant's compiled criteria.
4. Remove criteria hidden from the detected camera view.
5. If the exact variant does not exist, use a small equipment-neutral observation rubric.
6. Observation-only analysis may describe clear visible repetition and control, but cannot borrow a nearby rubric or produce a score.

This prevents free-weight rules from being applied to a machine, and prevents one machine design from inheriting another machine's assumptions.

Overhead triceps variants also include explicit side-view elbow-to-head and torso-to-floor landmark criteria. These compare matching bottom, transition, and top phases without requiring pose estimation or hidden joint measurements.

## Controlled stages

The server advances at most one durable stage per request:

```text
uploading
  -> video_processing
  -> indexing
  -> rubric_ready
  -> analyzing
  -> verifying findings and the full active rubric independently
  -> extracting_display_frames
  -> scoring
  -> writing_coaching
  -> complete | partial | unable | failed
```

Completed artifacts are stored on the analysis session. `analysis_stage_runs` adds a pipeline version and input checksum. `model_call_telemetry` records the role, model, requested FPS, clip range, token usage, latency, and outcome. A resumed request starts from the first missing artifact instead of repeating earlier calls.

## Model boundaries

The roles are separately configurable with `GEMINI_INDEXER_MODEL`, `GEMINI_ANALYST_MODEL`, `GEMINI_VERIFIER_MODEL`, and `GEMINI_WRITER_MODEL`; `GEMINI_MODEL` remains a compatibility fallback.

- Indexer: full recording at requested 4 FPS and minimal thinking. It may return only identity, equipment class, camera, active-set bounds, rep intervals, visibility, and usability.
- Analyst: active-set clip at requested 12 FPS and high thinking. It receives the exact visible rubric and returns literal evidence-backed candidates and criterion assessments.
- Verifier: one short evidence clip per candidate at requested 12 FPS and high thinking. It sees the literal claim and relevant rubric question, but not analyst confidence, proposed coaching, or score.
- Criterion verifier: the full active set at requested 12 FPS and high thinking. It independently assesses every selected visible criterion without seeing first-pass outcomes or a proposed score.
- Writer: text only and minimal thinking. It receives only public supported finding IDs and cannot introduce a new finding.

All model JSON passes allow-listed schemas. Timestamps and confidences are bounded, invented criterion IDs are discarded, unsupported writer IDs fail validation, and medical or hidden-physiology claims are rejected.

## Review policy

Internal decisions are `supported`, `contradicted`, or `insufficient`; these rows are never exposed as customer cards.

A normal finding becomes public only when both analyst and verifier reach at least 0.75 confidence. Novel visible findings and isolated major claims require at least 0.80 from both. Contradicted, insufficient, and borderline findings are silently suppressed.

The public result is capped at two corrections and three strengths. When no correction clears the gates, the user sees one calm message: “No clear correction was established from this camera view.” The result is never filled with unknown or uncertain review rows.

## Scoring

The model does not choose the final number. Server code scores only independently supported assessments from an exact rubric. It requires at least 60% observable rubric weight, three represented domains, and public evidence across three domains; otherwise no score is shown. Observation-only fallback never produces a score.

Supported good criteria contribute 100. Repeated issues contribute 80 for minor, 55 for important, and 25 for major severity. An isolated issue receives half the corresponding penalty. A separately verified public correction overrides a conflicting batch-good assessment. Public minor, important, and major corrections cap the final score at 89, 74, and 49 respectively, and a final invariant rejects any contradictory score. Contradicted and insufficient assessments neither lower the score nor count as good evidence.

## Evidence and user experience

Only supported public findings request exact display frames. The app extracts images nearest the verified peak timestamp and uploads them to preallocated private session paths. The original private recording remains the source for full playback and finding-level seeking.

Evidence windows are normalized to a local two-second interval around the visible event. A verifier timestamp is promoted only when it lies inside one evidence interval and away from that interval's edges. Supabase 429/5xx/546 resource responses are retried on the same session; durable artifacts allow the next request to resume at the first missing stage.

Progress is intentionally simple: securing the recording, mapping the recording, checking the exact movement, preparing evidence frames, and building coaching. It does not expose model names or internal review queues.

## Release gates

1. Verify registry cardinality, uniqueness, camera filtering, and strict fallback.
2. Verify prompt isolation, contracts, resumability, thresholds, scoring, upload, and result schemas.
3. Regenerate the registry migration deterministically.
4. Pass TypeScript, lint, and full Jest checks.
5. Apply migrations and deploy the Edge Functions.
6. Run the matched video benchmark for recognition, rep accuracy, issue precision/recall, good-form false positives, evidence timing, completion, latency, and cost.

Deployment alone does not establish coaching accuracy. Paid-launch claims require the live labeled-video benchmark to pass its thresholds.
