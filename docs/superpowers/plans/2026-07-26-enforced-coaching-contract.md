# Enforced Coaching Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee that every correction shown in results contains three or four short, evidence-grounded coaching sentences with a direct imperative action.

**Architecture:** Add a focused deterministic coaching-contract module shared by current-result assembly and legacy-result serialization. It preserves compliant model copy, converts invalid wording from the same finding and evidence into safe visible-movement coaching, and never adds another model call.

**Tech Stack:** TypeScript, Deno-compatible shared modules, Jest, Zod result contracts.

## Global Constraints

- Keep the existing one full-video analyst call and one text-only coaching-writer call.
- Do not invent new findings, causes, timestamps, or evidence.
- Limit explanations to visible path, range, control, stability, position, and repeatability.
- Preserve unrelated working-tree changes.
- Use one agent and inline execution only.

---

### Task 1: Deterministic coaching contract

**Files:**
- Create: `supabase/functions/_shared/coaching-contract.ts`
- Create: `supabase/functions/_shared/coaching-contract.test.ts`

**Interfaces:**
- Consumes: a correction with `detail`, `whyItMatters`, `correction`, `cue`, `actionableCorrection`, and evidence.
- Produces: `enforceCorrectionCoaching<T extends CoachingContractFinding>(finding: T): T`.

- [ ] **Step 1: Write failing tests**

Add real regressions for the recent row copy:

```ts
expect(enforceCorrectionCoaching(rowFinding)).toMatchObject({
  whyItMatters: expect.not.stringMatching(/leverage|muscle|trap|joint|strain/i),
  actionableCorrection: { instruction: expect.stringMatching(/^(Keep|Guide|Move|Pull|Lower|Raise|Press|Start|Hold|Control)\b/) },
});
```

Assert that the combined `detail`, `whyItMatters`, instruction, and optional success check contain exactly three or four sentences. Assert that a compliant four-sentence correction remains unchanged.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npx jest --runInBand supabase/functions/_shared/coaching-contract.test.ts
```

Expected: FAIL because `coaching-contract.ts` and `enforceCorrectionCoaching` do not exist.

- [ ] **Step 3: Implement the minimal contract module**

Implement sentence extraction, timing completion from the primary evidence, visible-quality classification, forbidden-cause detection, imperative validation, and evidence-grounded fallback copy. Keep each displayed field to one sentence and omit a redundant or invalid success check.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same Jest command and expect all coaching-contract tests to pass.

### Task 2: Enforce current and historical results

**Files:**
- Modify: `supabase/functions/_shared/single-pass-analysis.ts`
- Modify: `supabase/functions/_shared/single-pass-analysis.test.ts`
- Modify: `supabase/functions/_shared/result-payload.ts`
- Modify: `supabase/functions/_shared/result-payload.test.ts`

**Interfaces:**
- Consumes: `enforceCorrectionCoaching`.
- Produces: current saved results and historical API payloads that both satisfy the same coaching contract.

- [ ] **Step 1: Write failing integration tests**

Add a writer-merge regression with the real “bar path,” leverage, and joint-stability language. Add a legacy payload regression containing a two-sentence detail and verify the public correction is normalized to three or four total sentences.

- [ ] **Step 2: Run integration tests and verify RED**

Run:

```powershell
npx jest --runInBand supabase/functions/_shared/single-pass-analysis.test.ts supabase/functions/_shared/result-payload.test.ts
```

Expected: FAIL because current and legacy paths still return the invalid source wording.

- [ ] **Step 3: Apply the normalizer at both boundaries**

Normalize correction findings after writer copy is merged and while persisted legacy corrections are serialized. Do not alter strengths, evidence, issue IDs, severity, scores, or next-set relationships.

- [ ] **Step 4: Run integration tests and verify GREEN**

Run the same Jest command and expect both suites to pass.

### Task 3: Prompt alignment and full verification

**Files:**
- Modify: `supabase/functions/_shared/single-pass-analysis.ts`
- Modify: `supabase/functions/_shared/single-pass-analysis.test.ts`

**Interfaces:**
- Consumes: the runtime coaching contract.
- Produces: analyst and writer prompts that explicitly avoid the classes of output the runtime rejects.

- [ ] **Step 1: Write a failing prompt assertion**

Assert that the writer is told to replace unsupported source explanations instead of preserving muscle, leverage, strain, joint-loading, or equipment-name mistakes.

- [ ] **Step 2: Run the prompt test and verify RED**

Run the single-pass analysis suite and expect the new assertion to fail.

- [ ] **Step 3: Align prompt wording**

Add concise instructions to use the declared implement name and replace unsupported source mechanisms with one visible path, range, control, stability, or repeatability consequence.

- [ ] **Step 4: Verify the repository**

Run:

```powershell
npx jest --runInBand
npx tsc --noEmit
npx expo lint
git diff --check
```

Expected: 0 test failures, 0 TypeScript errors, and 0 lint errors in changed files.

- [ ] **Step 5: Verify a production-shaped payload**

Run the focused regression using the captured row and skull-crusher coaching fixtures. Confirm each correction has three or four total sentences, no forbidden causal language, and an imperative next action.
