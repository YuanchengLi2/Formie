# Exact Evidence, Strict Scoring, and Complete Visible-Mistake Analysis

## Objective

Strengthen Formai's existing single-pass Gemini analysis so every distinct, clearly visible, evidence-backed technique mistake is reported; every selected `peakMs` points to the frame where that mistake is clearest; and the analyst's score is strict and internally consistent with its findings. The change must not add a verifier, catalog, pose system, tracker, exercise-specific rubric, or another video-model call.

## Scope and definitions

“All mistakes” means every distinct visible deviation that can be supported directly by the original video and that yields useful coaching. The analyst must exclude:

- duplicate descriptions of the same underlying visible issue;
- speculative muscle activation, pain, force, hidden joint mechanics, or camera-axis depth;
- low-confidence possibilities that are not clearly visible;
- cosmetic differences that do not affect visible execution or repeatability.

An uncertain observation belongs in `videoCheck.limitations`, not in a correction.

## Architecture

The active architecture remains:

1. One `gemini-3.5-flash` call receives the whole original video at 12 FPS, high media resolution, and high thinking.
2. Its immutable `AnalysisDecision` owns recognition, score, rationale, severity, repetition timing, findings, evidence windows, and selected `peakMs` values.
3. At most one `gemini-3.1-flash-lite` low-thinking call rewrites user-facing wording only.
4. Server-side merging preserves all analyst-owned facts and falls back to the analyst's wording if the writer fails.

No downstream stage may add, delete, verify, recalculate, cap, or override analyst findings or scores.

## Comprehensive visible-mistake coverage

The analyst prompt will require a deliberate whole-set audit across five general visible dimensions:

- setup and stability;
- path and alignment;
- range and positions;
- control and tempo;
- repetition consistency.

The output must include one correction for every distinct clearly visible mistake found during that audit, not only the highest-priority limiter. A mistake that repeats across multiple repetitions remains one finding with multiple evidence moments. Separate visible problems remain separate findings. Strengths and limitations cannot replace corrections.

Every analyzed result must contain at least one correction. Every correction must:

- have complete actionable coaching;
- have a unique stable ID;
- contain at least one evidence moment;
- be referenced by at least one score-rationale entry.

## Exact event-frame selection

For each evidence moment, Gemini must inspect the neighboring sampled frames and select the frame where the described deviation is maximally visible. `peakMs` must identify the issue itself—not anticipation, setup before it, or recovery after it.

Structural validation will require:

- `startMs < peakMs < endMs`;
- the evidence interval to remain within the recording;
- a narrow evidence window of no more than 2,000 ms;
- referenced repetition evidence to remain inside that repetition;
- visible body areas or implements and a literal `visualEvidence` description;
- recurring findings to use separate evidence moments rather than one broad interval.

Playback cards and markers continue seeking the private original video directly to `peakMs`.

## Strict score consistency

The analyst continues to own the numeric score. Server code validates consistency but never changes the value.

The analyst must return exactly one score-rationale entry for each of the five general scoring dimensions, with unique criterion keys. Every correction ID must appear in the rationale so no reported mistake is omitted from scoring.

The existing bands remain authoritative:

- `90–100`: exceptional execution; corrections may only be isolated `note` issues.
- `80–89`: good execution with minor or recurring visible limitations.
- `70–79`: at least one `important` or `high` visible problem.
- `60–69`: at least one repeated or materially disruptive `high` problem.
- Below `60`: multiple major `high` problems, or one visibly safety-critical major breakdown described explicitly in the evidence.

Validation rejects internally inconsistent outputs and allows the existing retry policy to rerun the analyst. It does not calculate a replacement score.

## Writer restrictions

The writer remains copy-only. It cannot add or remove findings, omit actionable coaching, change score or severity, alter evidence, move timestamps, change recognition, or select frames. Missing writer entries retain the analyst's original wording.

## Testing and verification

Contract tests will first fail and then prove:

- broad or boundary-selected evidence windows are rejected;
- every correction is included in score rationale;
- all five scoring dimensions appear exactly once;
- score and severity bands cannot contradict each other;
- writer output cannot remove or alter findings or analyst-owned data;
- persisted analyst decisions remain resumable.

After focused tests, run the full Jest suite, TypeScript, and lint. Then run the latest 25-second dumbbell-row recording through the non-persisting Gemini regression. Inspect every correction and `peakMs`, confirm each timestamp shows its described event, confirm separate visible mistakes are not collapsed, and confirm the score matches the strict bands. Existing saved results must remain untouched.

## Deployment

Deploy only the affected `analyze-video` Supabase function after verification. Preserve all historical database columns, migrations, recordings, and result-reading compatibility.
