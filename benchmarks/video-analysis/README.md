# Formai video-analysis benchmark

This benchmark uses six matched good/bad pairs from the CC BY 4.0 dataset [A Multi-View Raw Video Dataset of Seven Fitness Exercises with Good/Bad Form Labels](https://data.mendeley.com/datasets/kgbb3yn47p/1), DOI `10.17632/kgbb3yn47p.1`, by S Ashlesh Pai, Pratham PN, Advith P, and Abhishek Mashetty.

Each pair holds the person, exercise, and camera view constant. The suite covers six exercise families and balances front, side, and diagonal phone recordings. Videos are downloaded into a temporary directory and are not committed.

The source dataset supplies exercise, good/bad, subject, and view labels. It does not supply expert issue-level annotations or authoritative repetition counts, so the automated benchmark measures client-schema validity, recognition, camera direction, score calibration/ranking, bad-form signal recall, good-form false positives, evidence timing, rubric resolution, model-stage failures, latency, equipment-observation coverage, and unsafe exact-load claims. Rep-count error is reported only for fixtures that declare `expectedRepCount`. It must not be presented as expert validation of every coaching sentence.

Run preparation, live analysis, and evaluation with:

```powershell
python scripts/prepare-video-benchmark.py benchmarks/video-analysis/manifest.json <temporary-output-directory>
npx tsx scripts/run-live-video-matrix.mts <temporary-output-directory> matched-multiview "" benchmarks/video-analysis/manifest.json
node scripts/video-benchmark-evaluator.cjs benchmarks/video-analysis/manifest.json <temporary-output-directory>/matched-multiview.json <temporary-output-directory>/matched-multiview-report.json
npx tsx scripts/verify-criteria-flow-matrix.mts
```

The evaluator exits nonzero when any minimum or maximum threshold fails. A terminal response counts as complete only when the mobile client schema accepts it. The deterministic camera matrix separately checks 4,320 exact-rubric combinations across four machine exercises, five directions, four heights, three tilts, three distances, three framings, and clear/occluded states.

For a bounded live smoke, the preparation command accepts a comma-separated fixture filter as its final argument. The live runner accepts the same filter as its fourth argument.

## Archived single-pass baseline: 2026-07-19

The production Supabase/Gemini run attempted all 12 fixtures under one deployed version. Ten completed and two failed validation. It passed only the unsafe-load safety threshold; it did not meet the paid-launch accuracy thresholds.

| Metric | Result | Required | Pass |
| --- | ---: | ---: | :---: |
| Completion | 83.3% | at least 95% | No |
| Exercise recognition | 83.3% | at least 90% | No |
| Score-band accuracy | 41.7% | at least 80% | No |
| Good-form false-positive rate | 83.3% | at most 20% | No |
| Bad-form signal recall | 50.0% | at least 80% | No |
| Matched-pair score ordering | 16.7% | at least 80% | No |
| Equipment observation coverage | 75.0% | at least 80% | No |
| Unsafe exact-load claims | 0.0% | exactly 0% | Yes |
| Evidence near a window boundary | 6.4% | at most 5% | No |

The six good/bad score pairs were `82/failed`, `69/95`, `92/failed`, `59/59`, `85/39`, and `59/87`. The only correctly ordered pair was the front-view push-up (`85/39`). This is the retired single-pass baseline: it was not score-accurate enough for a paid launch, despite producing some useful individual coaching results. New live runs use `criteria-pipeline-v3` with deterministic exact exercise/equipment matching, camera-filtered rubrics, a 4 FPS index, a 12 FPS active-set analyst, independent per-finding verification, and server-calculated scoring.

A separate two-clip machine check scored a good front-diagonal chest-supported T-bar row `100` and its edited bad-form counterpart `39`; both returned two equipment observations, no numeric load claim, and no boundary-frame error. A post-benchmark text-safety patch also removed an unsupported muscle-isolation explanation while preserving the visible chest-pad correction. That sanitizer-only patch does not change the multi-view scoring verdict above.

## Criteria catalog v4 live run: 2026-07-20

The same 12 fixtures were run against the deployed criteria pipeline and catalog v4. All 12 completed with client-valid schemas. A Supabase worker-resource limit occurred during the squat case; resumable stage state and the hardened benchmark runner preserved completed cases and retried the same session successfully.

| Metric | Retired baseline | Catalog v4 | Required | Pass |
| --- | ---: | ---: | ---: | :---: |
| Completion | 83.3% | 100.0% | at least 95% | Yes |
| Client schema validity | not recorded | 100.0% | 100% | Yes |
| Exercise recognition | 83.3% | 75.0% | at least 90% | No |
| Exact rubric resolution | not recorded | 91.7% | diagnostic | — |
| Score-band accuracy | 41.7% | 25.0% | at least 80% | No |
| Good-form false-positive rate | 83.3% | 0.0% | at most 20% | Yes |
| Bad-form signal recall | 50.0% | 33.3% | at least 80% | No |
| Matched-pair score ordering | 16.7% | 33.3% | at least 80% | No |
| Equipment observation coverage | 75.0% | 100.0% | at least 80% | Yes |
| Unsafe exact-load claims | 0.0% | 0.0% | exactly 0% | Yes |
| Camera direction | not recorded | 100.0% | at least 90% | Yes |
| Evidence interval validity | not recorded | 100.0% | 100% | Yes |
| Model-stage failure rate | not recorded | 0.0% | at most 5% | Yes |

The numeric pairs available in v4 were row `100/89` and curl `100/74`; the other four pairs correctly withheld scores because verified coverage did not clear the scoring gate. Average separation among scored good/bad cases was 18.5 points. This is a meaningful reliability and rubric-resolution improvement, but the paid accuracy gate still fails because of exercise-identity errors and missed bad-form signals. A post-run evidence-window patch centers public clips around the verified event and rejects verifier peaks at interval edges; targeted live smokes returned zero boundary evidence. It does not change the recognition/recall verdict above.

## Catalog v5 targeted hardening: 2026-07-20

Catalog v5 retains 12,283 variants and expands the deployed registry from 159,036 to 159,372 criteria. Exact matching now treats explicit laterality and execution style as compatibility gates and ranks confidence-weighted visible alternative labels. In a live unilateral overhead-triceps regression, this changed the selected variation from the bilateral ID 519 or observation-only fallback to the correct `single-arm-dumbbell-overhead-triceps-extension` ID 12101.

The new side-view overhead-triceps landmark criteria compare elbow position against the head/shoulder and torso position against the floor at matching phases. On the previously missed bad-form clip, the live v5 pipeline produced a repeated upper-arm drift correction, independently verified it at 0.95 confidence, returned valid local evidence with zero boundary events, and kept the score withheld because full scoring coverage was not established. The difficult shoulder-press clip still resolves incorrectly as an overhead triceps extension, so catalog v5 is a targeted recall and variation-resolution gain, not a claim that the full accuracy gate now passes.
