# Plain-Language Analysis Coaching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline. The user explicitly prohibited subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen Formie's analysis-coaching system prompt so responses remain equally detailed and equally short while using language a new lifter understands immediately.

**Architecture:** Change the behavior at the model instruction boundary rather than rewriting responses after generation. Keep the JSON schema, evidence mapping, scores, sentence counts, and model call pipeline untouched; regression-test the complete instruction contract in the existing prompt test.

**Tech Stack:** TypeScript, Supabase Edge Function shared prompt code, Jest.

## Global Constraints

- Do not use subagents.
- Modify only the analysis coaching system prompt and its regression test.
- Preserve every existing sentence-count rule and the under-18-word limit.
- Preserve evidence, scoring, schema, model selection, and one-pass behavior.
- Do not add a post-processor, jargon blacklist retry, extra model call, or output fallback.
- Teach the model the intended plain-language voice at the source.

## File Map

- Modify `supabase/functions/_shared/boundary-free-analysis.test.ts`: prove the system instruction specifies audience, voice, first-read clarity, ordinary visible language, avoidance of biomechanics jargon, explanation of unavoidable terms, and no loss of detail or structure.
- Modify `supabase/functions/_shared/boundary-free-analysis.ts`: add the matching plain-language paragraph to `WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION` beside the existing sentence-length instruction.

---

### Task 1: Lock and implement the plain-language system instruction

**Files:**
- Modify: `supabase/functions/_shared/boundary-free-analysis.test.ts:404-423`
- Modify: `supabase/functions/_shared/boundary-free-analysis.ts:973-995`

**Interfaces:**
- Consumes: exported `WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION: string`.
- Produces: the same exported system-instruction interface with a stronger language contract and unchanged structural constraints.

- [ ] **Step 1: Add failing prompt-contract assertions**

Inside `asks for exercise-specific coaching without turning every finding into a repetition log`, add literal assertions that the system instruction contains these independent requirements:

```ts
expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("no anatomy, sports-science, or biomechanics background");
expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("clear gym coach speaking between sets");
expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("understand every sentence on the first read");
expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("ordinary body-part, equipment, direction, and movement words");
expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("Avoid technical anatomy and biomechanics terms");
expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("explain it immediately in plain words inside the same sentence");
expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("Do not remove useful detail or shorten a required section");
```

Keep the existing assertions for exact sentence counts and `Keep each sentence under 18 words`; those assertions prove the requested length contract remains in force.

- [ ] **Step 2: Run the focused test and verify the intended failure**

Run:

```powershell
npx jest --runInBand supabase/functions/_shared/boundary-free-analysis.test.ts
```

Expected: FAIL because the current system instruction does not contain the newly specified audience and voice contract.

- [ ] **Step 3: Strengthen the system instruction without changing control flow**

Immediately after the existing `Keep each sentence under 18 words` paragraph in `WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION`, add one paragraph with the exact requirements asserted in Step 1. It must say that simplifying wording does not authorize removing useful detail, shortening required sections, or changing sentence-count rules. Do not modify `buildWholeVideoWritingPrompt`, `buildBoundaryFreeAnalysisPrompt`, schemas, parsers, or model invocation code.

- [ ] **Step 4: Run focused and static verification**

Run:

```powershell
npx jest --runInBand supabase/functions/_shared/boundary-free-analysis.test.ts
npm run typecheck
npm run lint
git diff --check
```

Expected: the focused suite and typecheck exit 0; lint has no new errors or warnings in changed files; diff check reports no whitespace errors.

- [ ] **Step 5: Commit the scoped change**

Run:

```powershell
git add -- docs/superpowers/specs/2026-08-11-plain-language-analysis-coaching-design.md docs/superpowers/plans/2026-08-11-plain-language-analysis-coaching.md supabase/functions/_shared/boundary-free-analysis.ts supabase/functions/_shared/boundary-free-analysis.test.ts
git commit -m "Make analysis coaching easier to understand"
```

Expected: one local commit containing only the two documents, the system prompt, and its test.
