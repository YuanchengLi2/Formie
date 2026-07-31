# Reanalysis Declaration Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require the user to review and submit set context before every reanalysis while reusing the saved video.

**Architecture:** The results route owns a confirmation state and always opens the existing `SetDeclarationScreen` from the Analyze Again action. The screen receives current declaration data first, falls back to legacy exercise and rep metadata, and supports custom submit/secondary labels so reanalysis reads as Analyze Again/Cancel without changing the post-recording Retake flow.

**Tech Stack:** Expo Router, React Native, React Query, Zod, Jest, React Native Testing Library

## Global Constraints

- Reanalysis must reuse the existing session and uploaded videos.
- Cancel must not mutate the session or start reanalysis.
- Existing mismatch recovery continues to use the same declaration form.
- Preserve unrelated working-tree changes.
- Execute inline without subagents.

---

### Task 1: Reusable declaration-screen action labels

**Files:**
- Modify: `src/screens/set-declaration/index.tsx`
- Test: `src/screens/set-declaration/set-declaration.test.tsx`

**Interfaces:**
- Consumes: existing `SetDeclarationScreenProps`
- Produces: optional `analyzeLabel?: string` and `secondaryLabel?: string`, defaulting to `"Analyze Set"` and `"Retake"`

- [ ] **Step 1: Write the failing test**

Render `SetDeclarationScreen` with `analyzeLabel="Analyze Again"` and `secondaryLabel="Cancel"`, assert both labels render, press Cancel, and assert `onRetake` is called once.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx jest --runInBand src/screens/set-declaration/set-declaration.test.tsx`

Expected: FAIL because the custom action labels are not rendered.

- [ ] **Step 3: Implement optional labels**

Add both optional props, default them during destructuring, and pass them to the existing `FormButton` instances without changing their callbacks.

- [ ] **Step 4: Run the focused test**

Run: `npx jest --runInBand src/screens/set-declaration/set-declaration.test.tsx`

Expected: PASS.

### Task 2: Confirm every reanalysis

**Files:**
- Modify: `src/app/results/[session-id].tsx`
- Create: `src/features/analysis/reanalysis-declaration.test.ts`
- Create: `src/features/analysis/reanalysis-declaration.ts`

**Interfaces:**
- Consumes: `AnalysisResult`, status-level `SetDeclaration | null`
- Produces: `declarationForReanalysis(result, storedDeclaration): SetDeclaration | null`

- [ ] **Step 1: Write failing declaration-selection tests**

Test that the helper prefers the stored declaration, falls back to `result.setDeclaration`, builds a custom/unknown-load declaration from historical label plus rep count, and returns `null` when required historical values are unavailable.

- [ ] **Step 2: Run the helper test and verify failure**

Run: `npx jest --runInBand src/features/analysis/reanalysis-declaration.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the helper**

Implement the priority order:

```ts
storedDeclaration
  ?? result.setDeclaration
  ?? historicalDeclarationFrom(result.recognition.label, result.setSummary?.totalReps)
```

Historical fallback uses a custom exercise, total reps, unknown load, no side, no styles, and no focus note.

- [ ] **Step 4: Wire the results route**

Replace direct reanalysis from `onReanalyze` with `setConfirmingReanalysis(true)` for every result. Prefill `SetDeclarationScreen` with the helper output, pass `analyzeLabel="Analyze Again"` and `secondaryLabel="Cancel"`, submit through `reanalyzeAnalysis({ sessionId, declaration })`, and make Cancel close the form without calling the mutation.

- [ ] **Step 5: Run focused verification**

Run:

```powershell
npx jest --runInBand src/features/analysis/reanalysis-declaration.test.ts src/screens/set-declaration/set-declaration.test.tsx src/features/analysis/api.test.ts
npx tsc --noEmit
```

Expected: all tests and TypeScript pass.

### Task 3: Regression verification

**Files:**
- Verify only

**Interfaces:**
- Consumes: completed Tasks 1 and 2
- Produces: verified reanalysis confirmation behavior

- [ ] **Step 1: Run route-adjacent result and declaration tests**

Run:

```powershell
npx jest --runInBand src/screens/results/results.test.tsx src/screens/set-declaration/set-declaration.test.tsx src/features/analysis/reanalysis-declaration.test.ts src/features/analysis/api.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript and lint**

Run:

```powershell
npx tsc --noEmit
npm run lint
```

Expected: TypeScript passes and lint has no new errors or warnings.
