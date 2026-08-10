# V56 Single-Call Rep-Audited Coaching Design

## Goal

Replace the currently deployed v55 behavior with a v56 analysis pipeline that invokes Gemini at most once per analysis attempt, audits every visible repetition, returns exactly four distinct evidence-backed coaching issues, and renders the requested bold-lead plus normal-detail coaching layout.

## Confirmed production failures

The latest production session completed only after two successful full-video Gemini calls. The first response reached Gemini successfully but failed Formie's local coaching contract, so the failed `analyzing` lease was reclaimed and the whole video was sent again. The completed result also demonstrated that the current first/middle/final-third checkpoints are the wrong abstraction: they covered camera setup, the first repetition, and camera shutdown instead of every repetition. Several findings claimed all three repetitions while carrying evidence from only one or two repetitions. Finally, the mobile UI rendered each combined coaching paragraph as one bold block.

## Approved product behavior

- Return exactly four coaching issues for a usable exercise recording.
- Invoke Gemini no more than once for one analysis or reanalysis attempt. There are no automatic Gemini retries or rewatches.
- Persist a successful raw Gemini response before parsing or mapping it. Any later local replay must reuse that persisted response.
- Audit every visible repetition, not arbitrary thirds of the recording.
- A finding may claim a repetition only when it contains evidence from that repetition.
- Keep the four issues distinct. Each issue must identify a different visible relationship, phase, path, position, range, tempo, balance, or repeatability problem.
- Do not present generic exercise myths or hidden physiology as observed errors. In particular, knee travel past the toes, gaze direction, or a specific depth is not automatically an error without visible consequences or declared context.
- `What happened` contains one bold sentence followed by one to three normal-weight sentences.
- `Why it matters` contains one bold sentence followed by one to three normal-weight sentences.
- `What to do next` keeps its existing bold instruction and normal success check.
- A provider or contract failure becomes a terminal failed attempt without consuming an analysis credit. The user may explicitly request a new attempt, but the cron worker must not re-invoke Gemini for v56.

## Architecture

### Provider boundary

The `analyzing` stage owns only the single Gemini provider call. Its durable output is the raw structured response. The stage is completed immediately after a successful provider response, before local parsing. Re-entering the stage returns that stored output and cannot call Gemini again. The pipeline version is bumped to `gemini-whole-video-v56-single-call-rep-audit` so no v55 lease output can be mistaken for v56 output.

The v56 handler classifies all analysis failures as terminal for that attempt. `retry-analysis` explicitly excludes v56 sessions from automatic invocation. A test also asserts that the source contains only one `generate(...)` call on the v56 video-analysis path and no recheck or writer model path.

### Whole-repetition audit

`videoUnderstanding.coverageCheckpoints` is replaced by `repAudit`. Every item contains `repNumber`, `startMs`, `peakMs`, `endMs`, and `visualSummary`. For repeated movements, `repAudit.length` must equal `observedRepCount`, repetition numbers must be sequential from one, and timestamps must be ordered within the recording. This makes first, middle, and final repetitions explicit while also covering every repetition between them.

Every coaching item includes `affectedRepNumbers`. The parser verifies that every affected repetition has a matching evidence moment and refuses claims about uncited repetitions. The prompt instructs Gemini to build `repAudit` before producing the four issues and to compare repetitions before deciding which four visible relationships matter most.

### Coaching contract

Each of the exactly four coaching items contains:

- `observation`: one complete sentence used as the bold `What happened` lead.
- `observationDetails`: one to three normal-weight supporting sentences.
- `whyItMatters`: one complete sentence used as the bold `Why it matters` lead.
- `whyDetails`: one to three normal-weight supporting sentences.
- `correctionDirection`: one complete bold action sentence.
- `affectedRepNumbers`: the explicit repetitions supported by evidence.

Unsupported physiological and safety claims are removed from accepted coaching. The prompt explicitly rejects universal squat-depth, knees-over-toes, and gaze rules unless the recording contains a visible consequence. The four-item requirement remains authoritative, but the fourth item may be a small visible optimization rather than a fabricated severe fault.

### Public result and mobile rendering

`expandedCoaching` gains `whatHappenedDetail` and `whyItMattersDetail`. Existing fields remain for compatibility with historical rows. V56 mapping writes the bold lead to the existing field and supporting copy to the new detail field. Mobile Zod parsing accepts the new optional detail fields so older results still open.

`review-frames.ts` carries both lead and detail for the observed and why tabs. `results/index.tsx` renders two separate `Text` nodes: the lead uses bold white styling and the detail uses normal secondary text. The next-action tab keeps the current instruction/success-check treatment.

## Files and responsibilities

- `supabase/functions/_shared/boundary-free-analysis.ts`: define and parse `repAudit`, exact-four coaching fields, affected-repetition evidence checks, one-sentence leads, one-to-three-sentence details, prompt requirements, and public-result mapping.
- `supabase/functions/_shared/boundary-free-analysis.test.ts`: prove every-rep coverage, exact-four enforcement, unsupported repetition rejection, sentence-shape parsing, mapping, and prompt prohibitions.
- `supabase/functions/_shared/analysis-contract.ts`: add the two optional supporting-detail fields to the shared public result type.
- `supabase/functions/_shared/result-payload.ts`: recognize v56 as a whole-video result.
- `supabase/functions/analyze-video/index.ts`: bump v56, persist raw model output before parsing, remove automatic retry state for v56 failures, and keep finalization local.
- `supabase/functions/analyze-video/whole-video-runner.ts`: preserve the provider-output-before-local-parse boundary through an explicit raw-output interface.
- `supabase/functions/analyze-video/*.test.ts`: assert one provider call, raw-output replay, no recheck/writer invocation, terminal error behavior, and v56 wiring.
- `supabase/functions/retry-analysis/index.ts`: exclude v56 from cron reinvocation.
- `supabase/functions/retry-analysis/handler.test.ts` and a wiring test: prove v56 is never sent back to `analyze-video` automatically.
- `supabase/functions/reanalyze-video/v48-rollback-wiring.test.ts`: update the active pipeline assertion to v56 and keep routing to `analyze-video` while v49 is disabled.
- `src/features/analysis/result-schema.ts`: accept the new supporting-detail fields.
- `src/features/analysis/result-schema.test.ts`: validate new and historical result shapes.
- `src/features/analysis/review-frames.ts`: expose bold lead and normal detail separately for each coaching tab.
- `src/features/analysis/review-frames.test.ts`: verify the requested copy structure and legacy fallback.
- `src/screens/results/index.tsx`: render separate bold and normal text nodes for What happened and Why it matters while retaining What to do next.
- `src/screens/results/results.test.tsx`: verify font weight, copy placement, and tab behavior.

No database migration is required because the raw stage output and new result fields are JSONB, and v56 retry exclusion is implemented in function code. No billing, authentication, capture, or unrelated UI files are part of this repair.

## Verification and deployment

Run focused Jest suites for the boundary-free parser, stage runner/handler, retry worker, result schema, review frames, and results screen. Then run the full project TypeScript check and lint. Deploy `analyze-video` and `retry-analysis` to project `jnprpjnnjyrhvfeflpju`, confirm both new versions and deployment digests, and leave unrelated functions untouched.

The live acceptance run must show exactly one `model_call_telemetry` row for the new session, `analysis_stage_runs.attempt = 0`, terminal `complete`, four findings, a sequential `repAudit` entry for every observed repetition, evidence for every claimed repetition, and the new lead/detail fields in the persisted result. Device verification must confirm one bold sentence plus one to three normal sentences on both requested tabs.
