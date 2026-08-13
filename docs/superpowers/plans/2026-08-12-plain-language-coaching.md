# Plain-Language Coaching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not use subagents for this repository.

**Goal:** Make generated coaching easier to understand while preserving video specificity, exercise accuracy, useful technical vocabulary, and the existing output structure.

**Architecture:** Keep the analyst and persisted analysis contract unchanged. Modify only the server-side writer system instruction that converts validated facts into display copy, then verify the exact prompt contract with a source-level unit test before deploying the `analyze-video` Supabase function.

**Tech Stack:** TypeScript, Jest, Supabase Edge Functions, Gemini structured generation, Zod result contracts.

## Global Constraints

- Prefer short sentences and familiar gym language.
- Use technical terminology only when it improves accuracy or usefulness.
- Explain uncommon technical terms immediately in everyday words.
- Keep each response specific to the declared exercise, recorded set, and visible evidence.
- Preserve a short title, exactly three What happened detail sentences, exactly three Why it matters detail sentences, and one direct next-step sentence.
- Do not change issue identification, evidence, scoring, schemas, pipeline retry behavior, or UI rendering.
- Do not introduce a banned-word list or reusable sentence template.

---

## File Structure

- Modify `supabase/functions/_shared/boundary-free-analysis.test.ts`: owns regression assertions for the writer system instruction and proves the plain-language requirement is present without weakening existing specificity and sentence-count requirements.
- Modify `supabase/functions/_shared/boundary-free-analysis.ts`: owns `WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION`, the server-side instruction sent to Gemini for final coaching copy.
- No new runtime files, dependencies, schemas, or migrations are needed.

### Task 1: Establish and implement the plain-language writer contract

**Files:**
- Modify: `supabase/functions/_shared/boundary-free-analysis.test.ts`
- Modify: `supabase/functions/_shared/boundary-free-analysis.ts`

**Interfaces:**
- Consumes: `WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION: string`, already passed to `buildTextGenerateContentRequest` by `supabase/functions/analyze-video/index.ts`.
- Produces: the same exported string and the same Gemini JSON output contract; only its readability instruction changes.

- [ ] **Step 1: Write the failing prompt-contract assertions**

Add these assertions to the existing writer-instruction test:

```ts
expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("Use mostly everyday gym language and short sentences");
expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("If a technical term is useful, explain it immediately in plain words");
expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toContain("Do not stack technical terms");
```

Retain the existing assertions for exercise/video specificity, three-sentence detail fields, direct writer output, and absence of a reusable sentence template.

- [ ] **Step 2: Run the focused test and verify the new contract fails**

Run:

```powershell
npx jest --runInBand supabase/functions/_shared/boundary-free-analysis.test.ts
```

Expected: FAIL because the current instruction says only `precise coaching language that is easy to understand` and does not contain the three explicit readability requirements.

- [ ] **Step 3: Make the minimal production prompt change**

In `WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION`, replace the broad readability sentence with this guidance while leaving its remaining output instructions unchanged:

```text
Use mostly everyday gym language and short sentences. Keep useful exercise terms when they make the coaching more accurate. If a technical term is useful, explain it immediately in plain words. Do not stack technical terms or make the person decode the coaching.
```

Do not add vocabulary filters, post-processing, rejection logic, or parser behavior.

- [ ] **Step 4: Run focused tests and verify the contract passes**

Run:

```powershell
npx jest --runInBand supabase/functions/_shared/boundary-free-analysis.test.ts
```

Expected: PASS with all writer, mapping, evidence, and prompt-contract tests green.

- [ ] **Step 5: Run full analysis verification**

Run:

```powershell
npm run test:analysis
npm run typecheck
git diff --check
```

Expected: all analysis suites pass, `tsc --noEmit` exits zero, and the diff has no whitespace errors.

- [ ] **Step 6: Deploy and verify the server function**

Run:

```powershell
npx supabase functions deploy analyze-video
npx supabase functions list
```

Expected: deploy exits zero and `analyze-video` appears `ACTIVE` at a newer function version. No iOS build is required because the writer instruction runs in the Supabase function.

- [ ] **Step 7: Commit and push the scoped implementation**

Run:

```powershell
git add supabase/functions/_shared/boundary-free-analysis.ts supabase/functions/_shared/boundary-free-analysis.test.ts docs/superpowers/plans/2026-08-12-plain-language-coaching.md
git commit -m "Simplify coaching language"
git push origin HEAD:codex/fix-analysis-billing-v70
```

Expected: the release branch points to the new commit and the working tree is clean.
