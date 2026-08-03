# Gemini Short-Clip Rechecks and Impactful Coaching Headlines

## Goal

Keep the restored `gemini-whole-video-v48` pipeline general across exercises while allowing Gemini 3.6 Flash to rewatch an uncertain moment. Gemini first analyzes the complete recording. It may then request zero to three sequential rechecks, each limited by deterministic code to a two-second window from the same retained source video. Gemini 3.1 Flash-Lite remains responsible for coaching prose and produces a short, high-impact headline for the white bold text.

This feature must improve evidence verification without becoming a mandatory multi-pass pipeline, a movement-specific rubric, or a path for the text writer to invent visual facts.

## Selected Architecture

### Analyst flow

1. Send the full retained recording to Gemini 3.6 using the existing full-video prompt and schema, extended with an optional `recheckRequest`.
2. The request contains only:
   - `centerMs`: the exact moment Gemini wants to inspect again.
   - `reason`: the uncertainty it intends to resolve.
3. Deterministic code clamps the requested center to the recording and creates a window no longer than 2,000 ms. Near the beginning or end, the window shifts inward so it remains as close to two seconds as the video permits.
4. Send the latest complete parsed analysis, the recheck reason, and only that timestamped video window back to Gemini 3.6.
5. Gemini returns a complete revised analysis plus an optional next `recheckRequest`. Replacing the complete contract avoids fragile patch joins and ensures evidence, scores, muscles, strengths, and issue ordering remain internally consistent.
6. Repeat until Gemini returns no request or three successful rechecks have completed. Ignore a fourth request and continue with the latest validated analysis.
7. Send only the final validated analysis and declaration to Flash-Lite for writing.

The initial full-video call is always required. Rechecks are optional and never replace complete-recording analysis. The same Gemini Files upload is reused; the server uses `videoMetadata.startOffset` and `endOffset`, so it does not generate, upload, or retain physical clip files.

### Recheck permissions

A recheck may confirm, correct, add, remove, or reprioritize an analyst finding only when the two-second clip supplies visible evidence. It may also correct timestamps, body regions, scores, muscle focus, or rep references when the prior output was inconsistent with the clip. It may not write coaching prose, use a named-fault checklist, or treat absent evidence in the short window as proof that a whole-set observation is false.

Every revised analysis must pass the same `parseBoundaryFreeAnalysis` validation as the initial response. Invalid revised output fails the analysis contract; it is not merged partially and is not rewritten into generic fallback content.

## Model Contracts

### Full-video response

Extend `BoundaryFreeAnalysis` with:

```ts
type RecheckRequest = {
  centerMs: number;
  reason: string;
};

type BoundaryFreeAnalysisWithRecheck = BoundaryFreeAnalysis & {
  recheckRequest: RecheckRequest | null;
};
```

The full-video prompt tells Gemini that rechecking is optional, is intended only for genuine uncertainty, and costs another video review. It must finish the full-video analysis before requesting a clip. The prompt does not suggest body parts, exercises, faults, or target issue counts.

### Recheck response

The recheck response uses the same complete schema. Its prompt includes:

- The immutable declaration as neutral context.
- The latest validated analysis as text.
- The requested reason.
- The exact two-second clip metadata.
- An instruction to revise only what the visible clip justifies.
- The remaining recheck allowance.

Gemini may request the same or another center if it remains uncertain, but deterministic orchestration stops after three completed rechecks.

### Flash-Lite headline

The existing writer `coachingItems[].title` becomes the explicit white-text headline. The writing prompt requires it to state the most important, actionable takeaway from that issue and summarize the longer coaching below it. It should normally be about 4–10 words, use one short sentence or phrase, and be specific to the visible exercise issue. It must not use generic labels such as `Improve form`, `Stay controlled`, or `Priority 1`.

The parser validates that the headline is nonempty, contains no line breaks, and is a single short sentence. It rejects malformed output rather than truncating or replacing it. The public mapper continues copying the writer title to both `finding.title` and `expandedCoaching.summary`; no public schema migration is required. The results UI continues using `finding.title` as the only bold white line and displays the complete coaching paragraph below it.

## Runtime, Persistence, and Idempotency

The recheck loop runs inside the existing leased `analyzing` stage, before the writer. Its stage input hash remains based on the retained video, declaration, FPS, and pipeline version. The stage output persists only after the final analyst result and writer result are both valid, preserving current atomic behavior.

Each provider call writes normal `model_call_telemetry`:

- Initial analyst: stage `analyzing`, full-video clip fields null.
- Rechecks: stages `analysis_recheck_1` through `analysis_recheck_3`, with exact `clip_start_ms` and `clip_end_ms`.
- Writer: existing text-only telemetry.

The logical maximum is three successful recheck model calls per analysis run. Provider-level HTTP transport retries inside a single generate request are not new logical rechecks. A failed recheck fails the leased analysis stage and follows the existing provider retry policy; deterministic schema failures do not silently retry unchanged output.

No database migration is needed because telemetry already accepts stage strings and clip boundaries, while the final combined stage output is JSON. The pipeline version changes from `gemini-whole-video-v48` to `gemini-whole-video-v48-recheck1` so an old completed stage cannot be confused with the new contract.

## Error and Limit Behavior

- Invalid `centerMs`, missing reason, or non-finite timestamp: reject the analyst contract.
- Recording shorter than two seconds: use the entire recording as the recheck window.
- Request near either edge: shift and clamp the window within `[0, durationMs]`.
- Fourth request: do not call Gemini again; discard only the request and keep the latest validated analysis.
- Recheck provider failure: fail through the existing retryable provider path.
- Recheck schema failure: fail as a deterministic analysis-contract error.
- No request: retain the current two-call flow of one analyst plus one writer.
- Declaration-only fallback: never requests rechecks because no video evidence is available.

## File Changes

### New files

- `supabase/functions/analyze-video/short-clip-recheck.ts`
  - Define `MAX_RECHECKS = 3` and `MAX_RECHECK_WINDOW_MS = 2000`.
  - Validate and clamp requested centers.
  - Build two-second windows.
  - Orchestrate sequential rechecks through injected generation and parsing functions.
  - Return the final validated analysis and recheck telemetry metadata.
- `supabase/functions/analyze-video/short-clip-recheck.test.ts`
  - Cover zero requests, one request, chained requests, the three-call cap, edge clamping, short videos, invalid requests, revised-analysis propagation, and parser failure.

### Existing backend files

- `supabase/functions/_shared/boundary-free-analysis.ts`
  - Add the optional recheck contract to the analyst type and response schema.
  - Parse `recheckRequest` structurally without changing findings.
  - Add a recheck prompt builder that receives the latest analysis and neutral declaration context.
  - Strengthen the writer-title instruction and parser validation for a concise impactful headline.
- `supabase/functions/_shared/boundary-free-analysis.test.ts`
  - Prove the generic analyst prompt contains no named fault hints.
  - Prove valid recheck requests parse and invalid requests fail.
  - Prove the recheck prompt carries the latest analysis, reason, exact window context, and remaining allowance.
  - Prove short issue-specific headlines survive while generic, multiline, or long-sentence headlines fail.
- `supabase/functions/analyze-video/index.ts`
  - Update the pipeline version.
  - Run the new recheck orchestrator after the initial parsed analyst response and before Flash-Lite.
  - Reuse the existing Gemini file and `buildVideoGenerateContentRequest` window support.
  - Record numbered recheck telemetry with exact clip boundaries.
  - Pass only the final revised analysis to the writer and mapper.
- `supabase/functions/_shared/gemini-generate.test.ts`
  - Retain or extend coverage proving that a requested window becomes Gemini `videoMetadata.startOffset` and `endOffset` and does not create another media upload.

### Existing client files

- `src/screens/results/index.tsx`
  - No behavior change should be required because `finding.title` is already the short bold headline and the full text is already rendered below it.
- `src/screens/results/results.test.tsx`
  - Add a regression assertion showing the AI-written impactful title is the only bold copy and the complete paragraph remains smaller text.
- `package.json`
  - Add the new recheck test file to `test:analysis`.

## Testing and Acceptance

Automated acceptance requires:

1. A no-recheck result still performs exactly one 3.6 analyst call and one Flash-Lite writer call.
2. Chained requests perform no more than three logical recheck calls.
3. Every recheck window is at most 2,000 ms and within the source duration.
4. Each call receives the revised result from the previous recheck.
5. A fourth request creates no provider call.
6. Telemetry identifies each recheck and its exact clip boundaries.
7. The writer sees only the final revised analysis.
8. Rechecks neither add coaching tasks to 3.6 nor introduce exercise-specific prompt hints.
9. The bold headline is short, specific, AI-written, and separate from the full coaching paragraph.
10. The persisted public payload still passes `analysisResultSchema`.

Run:

```powershell
npm run test:analysis
npm run typecheck
npm run lint
git diff --check
```

After deployment, verify one retained video that requests a recheck and one that does not. Confirm model-call telemetry, clip boundaries, final client parsing, and visible headline/detail rendering in the development client.
