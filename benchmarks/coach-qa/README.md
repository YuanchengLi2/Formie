# Formai video-aware Coach benchmark

This is a 20-question, five-recording benchmark for natural-language video questions. The source videos come from the CC BY 4.0 Mendeley dataset identified in `manifest.json`; videos are downloaded to a temporary directory and are not committed.

The manifest covers rep references, explicit timestamps, movement descriptions, early-versus-late comparisons, fresh observations absent from saved findings, and deliberately unanswerable visibility questions. Human labels are deliberately bounded to visible evidence and are not medical or biomechanical ground truth.

Run it from the repository root:

```powershell
python scripts/prepare-video-benchmark.py benchmarks/video-analysis/manifest.json <temp-directory> mv_row_s1_diagonal_bad,mv_curl_s2_front_bad,mv_press_s1_side_bad,mv_squat_s2_diagonal_bad,mv_pushup_s1_front_bad
$env:GEMINI_API_KEY = "<key>"
npx tsx scripts/run-coach-qa.ts benchmarks/coach-qa/manifest.json <temp-directory> <results.json>
```

Review each result against its `humanLabel` and the original recording. Add `review.correct` and `review.unsupportedClaims` to every result, then run:

```powershell
node scripts/coach-qa-evaluator.cjs benchmarks/coach-qa/manifest.json <reviewed-results.json> <report.json>
```

The release gate is 20/20 infrastructure completion, at least 17/20 human agreement, at least 85% localization within one second for time-labeled cases, zero unsupported claims on unanswerable cases, and 100% citations inside the reviewed range. A fluent answer without explicit human review never passes.
