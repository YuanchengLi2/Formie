# Catalog Scale and Flow Verification Design

## Objective

Expand FORM from 634 exercise variants and 7,608 resolved visual criteria to at least 10,634 exercise variants and at least 120,000 resolved criteria without reducing recognition accuracy, overflowing Gemini context, borrowing criteria across incompatible equipment, or weakening the observation-only fallback. Fix the verified-evidence timestamp defect found by the live row smoke test, deploy the catalog and runtime changes, then measure the system with the complete paired-video benchmark and explicit flow checks.

## Non-negotiable outcomes

- Add at least 10,000 exercise variation records beyond the current 634.
- Every exact variant resolves to 8–15 camera-aware visual criteria across movement, equipment, and exact-variation specificity.
- Generated variants must be mechanically coherent. Blind Cartesian products are prohibited.
- Exercise identity and equipment must agree before an exact rubric is eligible.
- Ambiguous, missing, or incompatible matches must use `observation_only` and must never receive an exercise-specific score.
- Gemini receives only the selected rubric, never the complete 10,000-plus catalog.
- Contradicted and insufficient findings remain internal and are never rendered as rejected or unknown cards.
- A numerical score requires an exact match, at least 60 percent verified rubric coverage, and at least three represented domains.
- Evidence timestamps must satisfy `startMs <= peakMs <= endMs` after every verifier adjustment.
- Existing worker, pose, 3D, and tracker paths remain outside the active pipeline.
- No subagents are used for design, implementation, or verification.

## Options considered

### 1. One giant materialized catalog sent to Gemini

Generate 10,000 additional rows and include every name and alias in the indexing prompt. This most closely resembles the current 634-entry implementation, but it scales badly: the existing generated migration is already 7.1 MB and registry materialization takes about 40 seconds in a one-off TypeScript process. A 10,634-entry prompt would increase cost and make exercise recognition less reliable. Rejected.

### 2. Materialized variants with structured server-side retrieval

Generate and store every exact variant and every resolved criterion, but stop sending the catalog to Gemini. The indexer returns a structured description of visible mechanics. Server code retrieves a small family-and-equipment candidate set, ranks exact labels, aliases, and mechanics, and selects a rubric only when the best candidate is unambiguous. This preserves explicit per-variation records while keeping the model prompt small. Selected.

### 3. Virtual variants composed only at runtime

Store a small set of movement templates and construct variants dynamically without creating 10,000 exercise rows. This is the most compact approach, but it does not satisfy the explicit requirement for 10,000 additional exercises and makes catalog inspection harder. Rejected.

## Catalog architecture

### Curated variation blueprints

The source catalog is split into focused blueprint modules rather than growing the existing `rubric-registry.ts` into one enormous file. Each blueprint declares:

- canonical movement name and family;
- allowed categories and equipment classes;
- allowed support, trajectory, laterality, stance, grip, and angle values;
- compatibility predicates that exclude nonsensical combinations;
- aliases generated from common word-order and equipment-name variants;
- family-specific criteria template keys;
- equipment-specific criteria template keys.

The generator enumerates only combinations allowed by a blueprint. For example, `bottoms-up` grip may be permitted for kettlebell presses and carries but not for selectorized chest presses. `Smith` requires a fixed-rail trajectory. `Selectorized` and `plate-loaded machine` variants use machine support/path criteria and exclude free-weight touch-point rules.

### Stable identity

Every variant has a deterministic slug and mechanics key. Existing IDs 1–634 remain stable. New IDs begin after the current maximum and are assigned deterministically from sorted blueprints. Generation fails on duplicate slugs, aliases that collide across incompatible mechanics, duplicate mechanics keys, invalid equipment/trajectory pairs, or an unstable second generation.

### Resolved criteria

Each exact variant materializes 8–15 criteria from:

1. universal visible-movement criteria;
2. movement-family criteria;
3. equipment/path criteria;
4. stance, grip, support, laterality, and angle criteria that are present only when relevant;
5. one exact-variation consistency criterion.

Criteria continue to use visible questions rather than fixed joint-angle claims. Every criterion includes camera visibility, severity cap, coaching cue, applicability/exclusion tags, provenance, and specificity.

### Database deployment

The schema remains in a small migration. Catalog data is emitted into deterministic chunk migrations so no individual SQL file becomes excessively large. Each chunk upserts variants before their criteria. A final verification migration records and asserts the expected variant and criteria counts. Removed or superseded generated rows are deactivated only when they belong to the generator’s managed ID range; unrelated historical rows are preserved.

## Recognition and rubric retrieval

### Indexer output

The 4 FPS indexer no longer receives every catalog row. It receives a compact closed taxonomy for family, equipment class, camera view, support, trajectory, laterality, stance, grip, and angle, while returning a free-form visible exercise label plus structured mechanics and alternatives. It still cannot produce form findings, coaching, or scores.

### Candidate retrieval

Server code retrieves active candidates matching family and equipment class. Candidate ranking uses normalized canonical label, aliases, and structured-mechanics agreement. Ranking is deterministic and returns:

- `exact` only when the best candidate clears the minimum score and has a sufficient margin over the runner-up;
- `observation_only` when no candidate qualifies, equipment conflicts, or the top candidates remain ambiguous.

An exact result stores the matched variant ID, selected rubric, match score, and match evidence for auditing. No family-level or “nearest exercise” rubric is silently borrowed.

### Analyst input

The 12 FPS analyst receives the validated video index, active-set clip, repetition intervals, limitations, and only the selected 8–15 criteria. The larger catalog therefore does not increase the analyst prompt.

## Evidence reliability fix

The verifier may refine a candidate’s peak timestamp. That refinement must be constrained to an evidence interval belonging to the finding, not merely the broad verifier clip. The pipeline selects the evidence interval containing the verified peak; if none contains it, it keeps the original valid peak rather than corrupting the final result. The final public-finding validator rechecks the interval invariant before frame requests, result assembly, and persistence.

This directly addresses the live row failure where the verifier returned 3,867 ms for evidence beginning at 3,917 ms.

## Complete flow matrix

The following flows must be exercised:

1. Upload succeeds and processing begins.
2. Upload fails and retries without losing the local recording.
3. Gemini file remains processing and polling resumes without duplicate upload.
4. Usable exact match with sufficient coverage produces a score.
5. Usable exact match with insufficient coverage withholds the score.
6. Unknown exercise uses observation-only criteria and withholds the score.
7. Known label with incompatible equipment uses observation-only criteria.
8. Unable video returns one retry reason/instruction and no coaching.
9. Analyst emits invalid, speculative, duplicate, or low-confidence candidates and they are filtered individually.
10. Verifier supports, contradicts, or cannot establish findings; only supported findings become public.
11. No supported correction returns calm copy rather than uncertainty cards.
12. Supported findings request five exact display frames each for at most three displayed findings.
13. Frame upload failure cleans temporary frames and remains retryable.
14. Writer succeeds using only supported finding IDs.
15. Writer fails or invents unsupported language and deterministic fallback preserves the analysis.
16. Interrupted processing resumes from persisted artifacts without repeating completed model stages.
17. Terminal polling returns the stored result without another model call.
18. Provider/storage failure stores a stable failure code and exposes a recoverable user path where available.
19. Reanalysis uses the current pipeline without reviving retired pose/tracker inputs.

## Benchmark and accuracy reporting

### Registry-resolution matrix

A deterministic matrix samples every new variant and verifies exact self-resolution, equipment mismatch fallback, camera-hidden omission, alias resolution, and ambiguity fallback. This proves catalog behavior at full scale without paying for 10,000 video calls.

### Paired-video benchmark

Run all 12 licensed paired fixtures: rows, curls, shoulder presses, squats, push-ups, and triceps extensions across good/bad pairs and multiple views. Record:

- completion rate;
- client-schema validity;
- recognition accuracy;
- exact versus observation-only resolution;
- rep-count error;
- good-video significant-correction false-positive rate;
- bad-video signal recall;
- score availability and pairwise score separation;
- evidence timestamp validity and boundary rate;
- unsafe load-claim rate;
- latency and model-call telemetry.

The report must distinguish architecture correctness from measured coaching accuracy. The benchmark is small and does not justify a universal accuracy percentage.

### Live flow smoke tests

Run at minimum one exact catalog video, one deliberately out-of-catalog video, and one unusable/blank video through the deployed service. Validate persisted rubric resolution, score eligibility, frame manifests, client schema, and terminal status. Automated tests cover controlled provider failure, writer fallback, retries, and resume/idempotency branches.

## Verification gates

Completion requires all of the following current evidence:

- generated totals meet or exceed 10,634 variants and 120,000 criteria;
- deterministic generation produces byte-identical output twice;
- all registry integrity and flow tests pass;
- full Jest suite passes;
- TypeScript passes;
- lint has zero errors;
- database migrations deploy successfully and remote counts match generated counts;
- Edge Functions deploy successfully;
- all 12 benchmark fixtures complete or their exact failures are reported;
- live exact, observation-only, and unable flows satisfy their invariants;
- no final result violates the client schema;
- the timestamp regression is reproduced red, fixed green, and covered permanently.

## Explicit limits

- The system does not claim that 10,000 generated names make Gemini 10,000 times more accurate.
- The system does not score an unknown or ambiguous variation.
- The system does not infer injuries, hidden physiology, or exact loads that are unreadable.
- The system does not claim universal percentage accuracy from twelve benchmark videos.
- Catalog scale must not increase the indexer prompt in proportion to catalog size.
