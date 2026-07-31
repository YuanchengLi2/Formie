# Strict Performance Scoring Implementation Plan

> **For agentic workers:** Execute inline in the current session. The repository instructions prohibit subagents.

**Goal:** Replace automatic 95-style binary scoring with strict, verified per-criterion performance scoring in the existing analysis pipeline.

**Architecture:** Extend the existing criterion-verifier contract with a calibrated `performanceScore`. Parse and persist that value on `VerifiedCriterionAssessment`, then use it in the existing deterministic weighted scorer while retaining coverage calibration, correction reconciliation, severity caps, and compatibility for sessions created before deployment.

**Tech Stack:** TypeScript, Supabase Edge Functions, Gemini structured JSON, Jest.

## Global Constraints

- No extra model call, scoring layer, pose tracker, or recording rejection.
- Every viewable workout still receives a numeric score.
- A score of 95 requires verified exceptional performance, not just no correction.
- Existing in-progress sessions without the new field remain resumable.
- Do not use subagents.

---

### Task 1: Extend the verifier scoring contract

**Files:**
- Modify: `supabase/functions/_shared/criteria-prompts.ts`
- Modify: `supabase/functions/_shared/criteria-contracts.ts`
- Modify: `supabase/functions/_shared/criteria-pipeline.ts`
- Test: `supabase/functions/_shared/criteria-prompts.test.ts`
- Test: `supabase/functions/_shared/criteria-contracts.test.ts`

**Interfaces:**
- Produces: `VerifiedCriterionAssessment.performanceScore?: number`
- Consumes: Gemini criterion assessments containing `performanceScore: number | null`

- [ ] Add failing schema and parser tests requiring a finite, clamped score for visible outcomes and no score for insufficient outcomes.
- [ ] Run the focused tests and confirm they fail because `performanceScore` is absent.
- [ ] Add the schema field, strict calibration instructions, parser validation, and compatibility type.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Score from verified performance

**Files:**
- Modify: `supabase/functions/_shared/criteria-pipeline.ts`
- Test: `supabase/functions/_shared/criteria-pipeline.test.ts`

**Interfaces:**
- Consumes: verified assessments with optional `performanceScore`
- Produces: the existing `scoreVerifiedCriteria(...)` result shape

- [ ] Add failing tests proving all-good criteria can produce an 82 instead of 95, genuinely exceptional criteria can reach 95, and verified corrections override optimistic values.
- [ ] Run the scoring tests and confirm the old binary scorer fails them.
- [ ] Use `performanceScore` when present, fall back to the legacy outcome/severity value when absent, and preserve coverage and severity caps.
- [ ] Run the scoring tests and confirm they pass.

### Task 3: Verify and deploy

**Files:**
- Validate all modified files and existing callers.

**Interfaces:**
- Produces: deployed `analyze-video` function with strict scoring.

- [ ] Run all Jest tests and `npx tsc --noEmit`.
- [ ] Deploy `analyze-video --no-verify-jwt` and confirm the new active version.
- [ ] Run the entirely new matched exercise matrix and persist its raw output and evaluator report.
- [ ] Report reliability, score distribution, good/bad ordering, and remaining misses without hiding failures.
