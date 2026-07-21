# Exact Evidence and Complete Mistake Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not use subagents in this repository.

**Goal:** Make the one-pass Gemini analyst report every distinct clearly visible mistake, select the clearest issue frame, and produce a strict score consistent with all findings.

**Architecture:** Strengthen the internal `AnalysisDecision` prompt and structural validator without adding another model call. The analyst remains immutable and the writer remains copy-only; invalid analyst output follows the existing retry path instead of being recalculated or overridden.

**Tech Stack:** TypeScript, Jest, Supabase Edge Functions, Gemini Files API and `generateContent`.

## Global Constraints

- Use exactly one `gemini-3.5-flash` whole-video call at 12 FPS, high media resolution, and high thinking.
- Use at most one `gemini-3.1-flash-lite` text-only call at low thinking.
- Do not add a verifier, catalog, rubric, pose system, tracker, or exercise-specific scoring.
- Preserve saved results, recordings, migrations, public result shapes, and playback against the original private video.
- “All mistakes” means all distinct clearly visible evidence-backed issues, excluding duplicates, uncertainty, and hidden mechanics.

---

### Task 1: Exact evidence-window validation

**Files:**
- Modify: `supabase/functions/_shared/single-pass-analysis.test.ts`
- Modify: `supabase/functions/_shared/single-pass-analysis.ts`

**Interfaces:**
- Consumes: `parseAnalysisDecision(value: unknown, durationMs: number)`.
- Produces: evidence moments with `startMs < peakMs < endMs` and duration at most 2,000 ms.

- [ ] **Step 1: Write failing boundary and broad-window tests**

```ts
const boundary = decision();
boundary.findings[0].evidence[0].peakMs = boundary.findings[0].evidence[0].startMs;
expect(() => parseAnalysisDecision(boundary, 25_020)).toThrow(/strictly inside/i);

const broad = decision();
broad.findings[0].evidence[0] = { ...broad.findings[0].evidence[0], startMs: 15_000, peakMs: 16_500, endMs: 17_501 };
expect(() => parseAnalysisDecision(broad, 25_020)).toThrow(/2,000 ms/i);
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npx jest --runInBand supabase/functions/_shared/single-pass-analysis.test.ts`

Expected: the boundary and 2,001 ms window are currently accepted.

- [ ] **Step 3: Implement minimal evidence validation**

```ts
if (peakMs <= startMs || peakMs >= endMs) throw new Error(`${name}.peakMs must fall strictly inside its interval`);
if (endMs - startMs > 2_000) throw new Error(`${name} evidence window cannot exceed 2,000 ms`);
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npx jest --runInBand supabase/functions/_shared/single-pass-analysis.test.ts`

Expected: PASS.

### Task 2: Complete score-rationale ownership

**Files:**
- Modify: `supabase/functions/_shared/single-pass-analysis.test.ts`
- Modify: `supabase/functions/_shared/single-pass-analysis.ts`

**Interfaces:**
- Consumes: parsed correction IDs and the five `ScoreCriterionKey` values.
- Produces: exactly five unique rationale entries with every correction referenced.

- [ ] **Step 1: Write failing completeness tests**

```ts
const missingDimension = decision();
missingDimension.scoreRationale = missingDimension.scoreRationale.slice(0, 4);
expect(() => parseAnalysisDecision(missingDimension, 25_020)).toThrow(/all five scoring dimensions/i);

const unscoredCorrection = decision();
unscoredCorrection.scoreRationale.forEach((item) => { item.evidenceIds = []; });
expect(() => parseAnalysisDecision(unscoredCorrection, 25_020)).toThrow(/correction.*score rationale/i);
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npx jest --runInBand supabase/functions/_shared/single-pass-analysis.test.ts`

Expected: incomplete rationale is currently accepted.

- [ ] **Step 3: Add completeness validation**

```ts
const rationaleCriteria = new Set(scoreRationale.map((item) => item.criterion));
if (scoreRationale.length !== SCORE_KEYS.length || rationaleCriteria.size !== SCORE_KEYS.length || SCORE_KEYS.some((key) => !rationaleCriteria.has(key))) {
  throw new Error("scoreRationale must cover all five scoring dimensions exactly once");
}
const referencedFindingIds = new Set(scoreRationale.flatMap((item) => item.evidenceIds));
const missingCorrection = findings.find((finding) => finding.kind === "correction" && !referencedFindingIds.has(finding.id));
if (missingCorrection) throw new Error(`correction ${missingCorrection.id} must appear in score rationale`);
```

- [ ] **Step 4: Expand the fixture to five rationale entries and verify GREEN**

Run: `npx jest --runInBand supabase/functions/_shared/single-pass-analysis.test.ts`

Expected: PASS.

### Task 3: Strict score and severity consistency

**Files:**
- Modify: `supabase/functions/_shared/single-pass-analysis.test.ts`
- Modify: `supabase/functions/_shared/single-pass-analysis.ts`

**Interfaces:**
- Consumes: analyst-owned numeric score and correction severities.
- Produces: rejection-only validation; never a replacement score.

- [ ] **Step 1: Write failing score-band tests**

```ts
const inflated = decision();
inflated.score = 95;
inflated.findings[0].severity = "important";
expect(() => parseAnalysisDecision(inflated, 25_020)).toThrow(/90-100/i);

const understatedSeverity = decision();
understatedSeverity.score = 68;
understatedSeverity.findings[0].severity = "note";
expect(() => parseAnalysisDecision(understatedSeverity, 25_020)).toThrow(/60-69/i);
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npx jest --runInBand supabase/functions/_shared/single-pass-analysis.test.ts`

Expected: contradictory score/severity combinations are currently accepted.

- [ ] **Step 3: Add rejection-only band validation**

```ts
const corrections = findings.filter((finding) => finding.kind === "correction");
if (score >= 90 && corrections.some((finding) => finding.severity !== "note")) throw new Error("90-100 scores allow only isolated note corrections");
if (score >= 70 && score < 80 && !corrections.some((finding) => finding.severity !== "note")) throw new Error("70-79 scores require an important visible problem");
if (score >= 60 && score < 70 && !corrections.some((finding) => finding.severity === "high")) throw new Error("60-69 scores require a high-severity visible breakdown");
if (score < 60 && corrections.filter((finding) => finding.severity === "high").length < 2) throw new Error("scores below 60 require multiple high-severity visible breakdowns");
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npx jest --runInBand supabase/functions/_shared/single-pass-analysis.test.ts`

Expected: PASS.

### Task 4: Comprehensive analyst prompt

**Files:**
- Modify: `supabase/functions/_shared/single-pass-analysis.test.ts`
- Modify: `supabase/functions/_shared/single-pass-analysis.ts`

**Interfaces:**
- Consumes: `buildSinglePassAnalysisPrompt(durationMs: number)`.
- Produces: explicit whole-set audit, all-visible-mistake requirement, deduplication rules, exact-frame instructions, and strict scoring self-check.

- [ ] **Step 1: Write failing prompt assertions**

```ts
const prompt = buildSinglePassAnalysisPrompt(25_020);
expect(prompt).toContain("every distinct clearly visible mistake");
expect(prompt).toContain("neighboring sampled frames");
expect(prompt).toContain("not before the issue and not after it");
expect(prompt).toContain("all five scoring dimensions exactly once");
expect(prompt).toContain("Every correction ID must appear");
```

- [ ] **Step 2: Run the prompt test and verify RED**

Run: `npx jest --runInBand supabase/functions/_shared/single-pass-analysis.test.ts`

Expected: assertions fail against the current “most important limiter” language.

- [ ] **Step 3: Replace the conflicting prompt language**

Require the analyst to audit setup/stability, path/alignment, range/positions, control/tempo, and rep consistency; output every distinct visible mistake; merge repeated occurrences into one finding with multiple narrow moments; and inspect neighboring frames before choosing `peakMs`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npx jest --runInBand supabase/functions/_shared/single-pass-analysis.test.ts supabase/functions/analyze-video/single-pass-index-wiring.test.ts`

Expected: PASS and still exactly one analyst plus at most one writer call.

### Task 5: Regression, full verification, and deployment

**Files:**
- Verify: `supabase/functions/analyze-video/index.ts`
- Verify: `supabase/functions/_shared/single-pass-analysis.ts`

**Interfaces:**
- Consumes: latest 25-second row video from the existing private regression fixture.
- Produces: non-persisted analysis with comprehensive corrections, exact event peaks, and a strict consistent score.

- [ ] **Step 1: Run focused and full automated verification**

Run:

```powershell
npx jest --runInBand supabase/functions/_shared/single-pass-analysis.test.ts supabase/functions/analyze-video/single-pass-runner.test.ts supabase/functions/analyze-video/single-pass-index-wiring.test.ts
npm test -- --runInBand
npm run typecheck
npm run lint
```

Expected: all commands pass.

- [ ] **Step 2: Run the non-persisting live row-video analysis**

Use `gemini-3.5-flash`, the production prompt/schema, 12 FPS, high resolution, and high thinking. Print every correction with severity, evidence interval, `peakMs`, repetition, and visual description. Do not create or update an analysis session.

- [ ] **Step 3: Inspect the selected frames**

Extract local stills only for regression inspection at each returned `peakMs`. Confirm each displayed frame visibly contains its described mistake and that separate visible mistakes are not collapsed.

- [ ] **Step 4: Deploy the affected function**

Run: `supabase functions deploy analyze-video --project-ref jnprpjnnjyrhvfeflpju`

Expected: deployment reports `analyze-video` active with a new version.
