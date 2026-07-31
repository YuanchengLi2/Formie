# Recording Recovery and Equipment Coaching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline. Do not dispatch subagents.

**Goal:** Preserve high-quality video analysis while making failed recordings recoverable and surfacing evidence-backed equipment, load, and weight observations.

**Architecture:** Keep the existing sub-cent recording preflight and Gemini 3.6 analysis profile unchanged. Recover failed remote analyses from the device-local recording by creating a new upload session, and prevent the server reset endpoint from clearing results until its retained input is verified. Render the existing structured equipment observations beside the whole-set summary; priority corrections continue to carry `load` or `equipment` coaching areas when the analyst finds an actionable problem.

**Tech Stack:** Expo Router, React Native, TanStack Query, Supabase Edge Functions, Jest, TypeScript.

## Global Constraints

- Recording preflight must remain below USD $0.01 per request; the measured production-equivalent request is approximately USD $0.002.
- Do not replace Gemini 3.6 analysis with a cheaper model that failed real-video quality checks.
- Do not invent an equipment or load fault when the video only establishes a neutral fact or an unreadable label.
- Use one agent only.

---

### Task 1: Recover failed analyses from the device-local recording

**Files:**
- Modify: `src/features/analysis/reanalysis-progress-route.test.tsx`
- Modify: `src/app/analysis/[session-id].tsx`

**Interfaces:**
- Consumes: `deviceVideoStore.find(sessionId)` and the existing `local_reanalysis_prepared` capture action.
- Produces: a failed-analysis retry that routes through `/analysis/upload` with the original declaration and `previousSessionId`.

- [x] **Step 1: Write the failing route test**

Assert that retry reads the device binding, dispatches `local_reanalysis_prepared` and `upload_started`, and navigates to `/analysis/upload` without calling the destructive server reset.

- [x] **Step 2: Run the focused test and confirm the old server-reset behavior fails it**

Run: `npx jest --runInBand src/features/analysis/reanalysis-progress-route.test.tsx`

- [x] **Step 3: Implement the device-local retry**

Load the saved recording, preserve the saved declaration, dispatch the two capture events, and replace the route with `/analysis/upload`. Return a clear error when the device recording is no longer present.

- [x] **Step 4: Run the focused test**

Run: `npx jest --runInBand src/features/analysis/reanalysis-progress-route.test.tsx`

### Task 2: Verify reusable server input before clearing a result

**Files:**
- Modify: `supabase/functions/reanalyze-video/handler.test.ts`
- Modify: `supabase/functions/reanalyze-video/handler.ts`
- Modify: `supabase/functions/reanalyze-video/index.ts`

**Interfaces:**
- Consumes: an owned session's retained storage path or live Gemini file metadata.
- Produces: `verifyReusableInput(sessionId, userId)` returning `ready`, `video_missing`, or `not_found`.

- [x] **Step 1: Write failing handler tests**

Assert that `resetSession` is never called when input verification returns false, and that the endpoint returns `VIDEO_NOT_FOUND` without altering the saved result.

- [x] **Step 2: Run the focused test and confirm it fails**

Run: `npx jest --runInBand supabase/functions/reanalyze-video/handler.test.ts`

- [x] **Step 3: Implement verification before reset**

Load the owned session. Accept a retained `video_path` only when the storage object still exists; otherwise call Gemini Files `getFile` and require `ACTIVE`. Map missing, forbidden, deleted, failed, or processing-only terminal input to `VIDEO_NOT_FOUND`.

- [x] **Step 4: Run the focused test**

Run: `npx jest --runInBand supabase/functions/reanalyze-video/handler.test.ts`

### Task 3: Surface equipment and load analysis

**Files:**
- Modify: `src/screens/results/results.test.tsx`
- Modify: `src/screens/results/index.tsx`

**Interfaces:**
- Consumes: `AnalysisResult.equipmentObservations`.
- Produces: a visible `SETUP, EQUIPMENT & LOAD` section containing the observation, load label when established, and coaching relevance.

- [x] **Step 1: Write the failing result-screen test**

Assert that a visible-load observation renders its title, objective observation, coaching relevance, and an honest unreadable-load label.

- [x] **Step 2: Run the focused test and confirm the section is absent**

Run: `npx jest --runInBand src/screens/results/results.test.tsx`

- [x] **Step 3: Implement the compact equipment/load section**

Render up to four existing observations. Format exact and partial load values; display `Weight marking not readable` for `not_readable`; do not convert neutral observations into faults.

- [x] **Step 4: Run the focused test**

Run: `npx jest --runInBand src/screens/results/results.test.tsx`

### Task 4: Regression and live verification

**Files:**
- Verify only.

**Interfaces:**
- Consumes: the three completed behaviors above.
- Produces: test, typecheck, lint, deployment, and live-session evidence.

- [x] **Step 1: Run focused and analysis tests**

Run: `npx jest --runInBand src/features/analysis/reanalysis-progress-route.test.tsx supabase/functions/reanalyze-video/handler.test.ts src/screens/results/results.test.tsx src/features/analysis/result-schema.test.ts supabase/functions/_shared/single-pass-analysis.test.ts`

- [x] **Step 2: Run static checks**

Run: `npx tsc --noEmit`

Run: `npx expo lint`

- [x] **Step 3: Deploy only the changed Edge Function**

Run: `npx supabase functions deploy reanalyze-video --use-api`

- [x] **Step 4: Verify the stale newest session is rejected without another destructive reset**

Call the deployed endpoint against a controlled stale-input fixture or a disposable session and confirm `VIDEO_NOT_FOUND`.

- [ ] **Step 5: Verify a new device upload**

Use the device-local newest recording when available. Confirm camera preflight, upload, Gemini 3.6 analysis, persisted client schema, and equipment/load presentation.
