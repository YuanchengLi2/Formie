# Plain-Language Analysis Coaching Design

**Date:** 2026-08-11

## Objective

Make generated analysis coaching immediately understandable to a new lifter by strengthening the existing `WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION`. Preserve the current response structure, sentence counts, sentence-length ceiling, evidence rules, scoring rules, and amount of coaching detail.

## Selected Approach

Change the model's system instruction at the source. Do not post-process generated coaching, reject individual jargon terms after generation, or add a second model pass. A post-processor could distort evidence and sentence counts; a retry guard would address only detected words rather than teaching the model the intended voice.

The system instruction will explicitly require the model to:

- write for someone with no anatomy, sports-science, or biomechanics background;
- sound like a clear gym coach speaking between sets, not a biomechanics report or medical textbook;
- make every sentence understandable on its first read;
- use ordinary body-part, equipment, direction, and movement words;
- avoid technical anatomy and biomechanics terminology when everyday wording communicates the same visible fact;
- briefly explain any genuinely unavoidable technical term in plain words inside the same sentence; and
- simplify wording without shortening the required sections, removing useful detail, or changing existing sentence-count rules.

## Files

- `supabase/functions/_shared/boundary-free-analysis.ts`: strengthen only `WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION`; do not change schemas, parsing, model selection, or the one-pass video-analysis prompt.
- `supabase/functions/_shared/boundary-free-analysis.test.ts`: add regression assertions for the new audience, voice, jargon, first-read clarity, unavoidable-term explanation, and structure-preservation instructions while retaining existing sentence-count assertions.

## Verification

Run the focused boundary-free analysis tests first, then TypeScript and lint. The test must fail before the prompt changes and pass afterward. Confirm the final diff changes no runtime control flow and preserves `Keep each sentence under 18 words`, all per-field sentence counts, `overallAssessment` at three to four sentences, and `coachNote` at exactly three sentences.
