# Formai Brand and Whole-Set Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install the supplied FORM logo across Expo surfaces and make whole-set, view-adaptive context a required part of Gemini analysis, persisted results, Results UI, and coaching chat.

**Architecture:** Keep the original Gemini Files API video as the primary high-resolution 18 FPS input with no offsets. Extend the structured result with a persisted `setContext` object that summarizes camera view, visible references, the full sequence, change across the set, and coaching basis; clients remain compatible with legacy rows. Generate deterministic platform assets from the supplied PNG, expose the context in Results and Coach, deploy the schema/functions, and merge the verified branch into local `master`.

**Tech Stack:** Expo 54, React Native, TypeScript, Jest, Zod, Supabase/Postgres, Supabase Edge Functions, Gemini Files API, PowerShell/System.Drawing.

---

### Task 1: Install the supplied brand image

**Files:**
- Modify: `scripts/generate-brand-assets.ps1`
- Create: `scripts/brand-assets.test.js`
- Modify: `src/components/form-wordmark.tsx`
- Create: `src/components/form-wordmark.test.tsx`
- Modify generated PNGs under `assets/images/`

- [ ] Write failing tests that require the Expo icon, splash, adaptive images, favicon, and in-app mark to use the new source-derived assets.
- [ ] Run `npx jest --runInBand scripts/brand-assets.test.js src/components/form-wordmark.test.tsx` and confirm the new expectations fail.
- [ ] Update the asset generator to load the supplied source, render full, safe-area, splash, favicon, and monochrome variants, and update `FormWordmark` to show the image beside the FORM text.
- [ ] Run the generator, inspect the rendered icon/splash/foreground, and rerun the focused tests to green.

### Task 2: Require structured whole-set context

**Files:**
- Modify: `supabase/functions/_shared/analysis-contract.test.ts`
- Modify: `supabase/functions/_shared/analysis-contract.ts`
- Modify: `src/features/analysis/result-schema.test.ts`
- Modify: `src/features/analysis/result-schema.ts`
- Modify: `supabase/functions/analyze-video/handler.test.ts`
- Modify: `supabase/functions/analyze-video/handler.ts`

- [ ] Add failing tests for required model output fields `cameraView`, `visibleReferences`, `sequenceSummary`, `changeAcrossSet`, and `coachingBasis`, plus an unable-result neutral context.
- [ ] Run the contract, client-schema, and handler tests and confirm failure is due to missing `setContext`.
- [ ] Add the TypeScript type, Gemini JSON schema, runtime validation, backward-compatible Zod default, and unable-result value.
- [ ] Rerun focused tests to green.

### Task 3: Make prompt reasoning whole-set and view-adaptive

**Files:**
- Modify: `supabase/functions/_shared/analysis-prompt.test.ts`
- Modify: `supabase/functions/_shared/analysis-prompt.ts`
- Modify: `supabase/functions/_shared/gemini-video.test.ts`
- Modify: `supabase/functions/_shared/gemini-video.ts`

- [ ] Add failing prompt tests for a complete-set context map, same-phase early/middle/late comparison, front/down-front relative-depth cues, machine/implement endpoints, and explicit prohibition on invented metric depth.
- [ ] Add or retain a request-level test proving the primary request sends the complete original file at 18 FPS, high media resolution, with no start/end offsets.
- [ ] Run the focused tests and confirm the new prompt assertions fail while the whole-video metadata assertion documents current behavior.
- [ ] Update the primary and focused-review prompts so all coaching is derived from the complete set and relative visible geometry.
- [ ] Rerun focused tests to green.

### Task 4: Persist and return set context

**Files:**
- Create: `supabase/migrations/202607170014_whole_set_context.sql`
- Modify: `supabase/tests/rls.sql`
- Modify: `supabase/functions/analyze-video/index.ts`
- Modify: `supabase/functions/_shared/result-payload.test.ts`
- Modify: `supabase/functions/_shared/result-payload.ts`

- [ ] Add failing payload and persistence-source tests that require `set_context` to round-trip and legacy rows to receive a neutral default.
- [ ] Run the focused tests and confirm failure.
- [ ] Add a JSONB column with an object constraint, save `setContext`, and map it back into the app contract.
- [ ] Rerun focused tests to green.

### Task 5: Ground coach chat in the complete set

**Files:**
- Modify: `supabase/functions/_shared/coach-prompt.test.ts`
- Modify: `supabase/functions/_shared/coach-prompt.ts`
- Modify: `supabase/functions/coach-chat/handler.test.ts`
- Modify: `supabase/functions/coach-chat/handler.ts` only if the full saved result is not already forwarded

- [ ] Add failing assertions that the coach prompt includes set context, rep timeline, isolated-versus-set-wide distinction, and view-supported relative-depth limits.
- [ ] Run coach prompt/handler tests and confirm failure.
- [ ] Update the coach prompt while preserving the existing full result and video file handoff.
- [ ] Rerun focused tests to green.

### Task 6: Show the whole-set read in the app

**Files:**
- Modify: `src/screens/results/results.test.tsx`
- Modify: `src/screens/results/index.tsx`
- Modify: `src/screens/coach/coach.test.tsx`
- Modify: `src/screens/coach/index.tsx`

- [ ] Add failing UI tests for a `WHOLE-SET READ` block in Results and concise sequence context in Coach.
- [ ] Run the two screen suites and confirm failure.
- [ ] Render sequence summary, change across set, and coaching basis using the current dark/gold visual system without adding camera setup advice.
- [ ] Rerun both suites to green.

### Task 7: Verify, deploy, commit, and merge

**Files:**
- Modify: `.gitignore` for generated verification directories if needed
- Regenerate: `form-expo-qr.png`

- [ ] Run `npx jest --runInBand`, `npx tsc --noEmit`, `npm run lint`, `npx expo-doctor`, and `git diff --check`.
- [ ] Run an Android Expo export to a disposable ignored directory and verify exit code 0.
- [ ] Link/apply migration `202607170014` and verify local/remote migration parity.
- [ ] Deploy `analyze-video`, `analysis-status`, and `coach-chat`, then confirm active versions.
- [ ] Commit all intended source, migration, test, and brand assets while excluding generated exports.
- [ ] Merge `codex/formai-motion-polish` into local `master` and verify the merged tree.
- [ ] Start a fresh Expo tunnel, verify `/status` and `/_expo/link?platform=android`, regenerate the QR from that exact URL, and visually inspect it.
