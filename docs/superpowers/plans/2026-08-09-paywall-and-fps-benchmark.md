# Pre-Build-34 Paywall and FPS Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This repository's `AGENTS.md` forbids subagents, so execute inline with `superpowers:executing-plans`.

**Goal:** Ship the exact pre-build-34 no-reviews paywall with a working native monthly-purchase button, compare the same near-15-second saved clip at 4/8/12 FPS with high reasoning, consolidate production on 12 FPS, and create a verified iOS TestFlight build.

**Architecture:** Work in an ignored Git worktree based on the current design commit, then reconstruct only the approved paywall hunks and asset from the dirty main checkout. Keep benchmark execution outside production state by downloading one retained video and calling Gemini directly through the existing request builders. Make the shared analysis settings module authoritative for both primary and V49 FPS so configuration cannot drift.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript 5.9, Jest, Supabase Storage/Postgres, Gemini GenerateContent, RevenueCat, EAS Build/TestFlight.

---

## File map

- `assets/production/paywall/reference/paywall-reference-no-social-proof.png`: approved pre-build-34 bitmap with the reviews and baked CTA removed.
- `src/screens/onboarding/premium-screen.tsx`: responsive artwork geometry, native back target, native CTA, purchase/reconciliation state, and accessibility text.
- `src/screens/onboarding/approved-onboarding.test.tsx`: rendered paywall and monthly-purchase regression coverage.
- `scripts/compare-analysis-fps-live.ts`: read-only live benchmark CLI; source selection, video download, three Gemini calls, metrics, and anonymized report.
- `scripts/compare-analysis-fps-live.test.ts`: deterministic tests for FPS matrix, shared request invariants, metric aggregation, and comparison output.
- `supabase/functions/_shared/analysis-settings.ts`: single source of truth for the production analyst FPS, media resolution, reasoning, and duration limits.
- `supabase/functions/analyze-video-v49/config.ts`: V49 model identities and import/re-export of shared production analyst settings.
- `supabase/functions/analyze-video-v49/config.test.ts`: regression proving V49 and primary resolve to 12 FPS/high reasoning/high resolution.
- `package.json`: stable `benchmark:analysis-fps` command.

### Task 1: Create and verify the isolated implementation worktree

**Files:**
- Verify: `.gitignore`
- Create worktree directory: `.worktrees/paywall-fps-build-20260809`

- [ ] **Step 1: Confirm `.worktrees` exists and is ignored**

Run: `git check-ignore .worktrees`

Expected: `.worktrees` is printed and exit code is 0.

- [ ] **Step 2: Create a dedicated branch and worktree from the current commit**

Run: `git worktree add .worktrees/paywall-fps-build-20260809 -b codex/paywall-fps-build-20260809 HEAD`

Expected: Git prepares the new branch without modifying the dirty main checkout.

- [ ] **Step 3: Install the locked dependency graph**

Run in the worktree: `npm ci`

Expected: installation completes; existing audit or peer warnings are recorded but do not alter source files.

- [ ] **Step 4: Run a focused clean baseline**

Run: `npx jest --runInBand src/screens/onboarding/approved-onboarding.test.tsx supabase/functions/analyze-video-v49/config.test.ts supabase/functions/_shared/analysis-settings.test.ts`

Expected: all selected baseline tests pass before implementation.

### Task 2: Restore the exact pre-build-34 paywall and prove its visible button is interactive

**Files:**
- Add: `assets/production/paywall/reference/paywall-reference-no-social-proof.png`
- Modify: `src/screens/onboarding/premium-screen.tsx`
- Modify: `src/screens/onboarding/approved-onboarding.test.tsx`

- [ ] **Step 1: Add failing paywall assertions before production code**

Update the existing premium tests to require:

```tsx
expect(screen.getByTestId("premium-scroll")).toHaveProp("contentInsetAdjustmentBehavior", "never");
expect(screen.getByTestId("premium-status-mask")).toBeTruthy();
expect(screen.getByLabelText(/Formie plans paywall/).props.accessibilityLabel).not.toContain("Trusted by 1,000+ lifters");
const button = screen.getByRole("button", { name: "Start monthly - $9.99/mo" });
await fireEvent.press(button);
expect(props.onPurchasePlan).toHaveBeenCalledWith("monthly");
```

Add geometry assertions showing the CTA source frame begins below the plan-box bottom and remains reachable on 390x844 and 390x667 screens.

- [ ] **Step 2: Run the focused test and observe the intended failure**

Run: `npx jest --runInBand src/screens/onboarding/approved-onboarding.test.tsx`

Expected: fail because the clean worktree still uses the review-containing bitmap and mismatched transparent hotspot.

- [ ] **Step 3: Copy the approved asset without altering other dirty assets**

Copy only `paywall-reference-no-social-proof.png` from the main checkout into the identical worktree path. Verify its SHA-256 matches the main working-tree source.

- [ ] **Step 4: Implement proportional artwork and native controls**

In `premium-screen.tsx`, add `getPremiumArtworkLayout(width, height)` based on the 852x1846 source. Use `ScrollView`, preserve aspect ratio, mask the 76-source-pixel status chrome, place a native back `Pressable`, and render an opaque 56-point native CTA at the approved source frame. The CTA handler must be:

```ts
if (syncRequired) onRetrySync?.();
else if (onPurchasePlan) onPurchasePlan("monthly");
else onPurchase();
```

Use `pointerEvents="none"` on decorative images so they cannot intercept the press. Keep the CTA disabled only while reconciling or when no live monthly package exists.

- [ ] **Step 5: Run the paywall test and verify green**

Run: `npx jest --runInBand src/screens/onboarding/approved-onboarding.test.tsx`

Expected: all onboarding/paywall tests pass, including the visible CTA press.

- [ ] **Step 6: Commit the isolated paywall change**

Run: `git add assets/production/paywall/reference/paywall-reference-no-social-proof.png src/screens/onboarding/premium-screen.tsx src/screens/onboarding/approved-onboarding.test.tsx && git commit -m "fix: ship interactive no-reviews paywall"`

### Task 3: Add a same-video FPS benchmark with deterministic evaluation

**Files:**
- Create: `scripts/compare-analysis-fps-live.ts`
- Create: `scripts/compare-analysis-fps-live.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing unit tests for the benchmark contract**

Define a pure request matrix function whose result is exactly `[4, 8, 12]`. Assert every request uses `thinkingLevel: "high"`, `mediaResolution: "MEDIA_RESOLUTION_HIGH"`, the same model/prompt/schema/video identity, and only the FPS changes. Test a pure summarizer with known usage values and assert input/output/thinking tokens, latency, estimated cost, finding count, evidence count, and pairwise overlap.

- [ ] **Step 2: Run the benchmark unit test and verify red**

Run: `npx jest --runInBand scripts/compare-analysis-fps-live.test.ts`

Expected: fail because the benchmark module does not exist.

- [ ] **Step 3: Implement the pure benchmark helpers**

Export typed helpers for the FPS matrix, usage/cost summary, normalized finding terms, evidence count, and pairwise agreement. Reuse `estimatedGeminiCost("gemini-3.6-flash", usage)` instead of duplicating prices.

- [ ] **Step 4: Implement the read-only live CLI**

Load environment variables without printing them. Query `analysis_sessions` for retained 3,000-15,000 ms inputs, select the newest row among those closest to 15,000 ms, download `analysis_video_path ?? video_path`, parse its saved declaration, and construct the V49 problem-finder request three times. Use the same bytes, prompt, schema, high resolution, high reasoning, and temperature for every call. Call Gemini sequentially at 4/8/12 FPS and emit an anonymized JSON report containing source duration, per-run result/metrics, and comparison metrics. Do not insert/update/delete database rows or storage objects.

- [ ] **Step 5: Add the package command**

Add:

```json
"benchmark:analysis-fps": "tsx scripts/compare-analysis-fps-live.ts"
```

- [ ] **Step 6: Run unit tests and verify green**

Run: `npx jest --runInBand scripts/compare-analysis-fps-live.test.ts supabase/functions/_shared/gemini-cost.test.ts`

Expected: both suites pass.

- [ ] **Step 7: Commit the benchmark tooling**

Run: `git add scripts/compare-analysis-fps-live.ts scripts/compare-analysis-fps-live.test.ts package.json && git commit -m "test: compare analysis quality across fps"`

### Task 4: Run the real 4/8/12 high-reasoning comparison

**Files:**
- No repository writes required; report is captured from stdout.

- [ ] **Step 1: Load local secrets into process scope without echoing values**

Read `.env.local` from the main checkout and set only the benchmark process environment. Never print keys or signed video data.

- [ ] **Step 2: Execute the comparison**

Run: `npm run benchmark:analysis-fps`

Expected: three successful Gemini 3.6 Flash responses for one saved near-15-second clip.

- [ ] **Step 3: Inspect the report**

Compare latency, prompt/output/thinking tokens, calculated cost, findings, evidence coverage, timestamp agreement, and qualitative specificity. Record failures exactly; do not treat a provider timeout as a quality score.

### Task 5: Consolidate production analysis on the selected 12-FPS setting

**Files:**
- Modify: `supabase/functions/analyze-video-v49/config.test.ts`
- Modify: `supabase/functions/analyze-video-v49/config.ts`
- Verify: `supabase/functions/_shared/analysis-settings.ts`
- Verify: `supabase/functions/analyze-video/index.ts`

- [ ] **Step 1: Change the V49 config test to require shared 12 FPS**

Assert `V49_REQUESTED_FPS === REQUESTED_ANALYSIS_FPS === 12`, high analyst reasoning, and high media resolution.

- [ ] **Step 2: Run the config tests and verify red**

Run: `npx jest --runInBand supabase/functions/analyze-video-v49/config.test.ts supabase/functions/_shared/analysis-settings.test.ts`

Expected: V49's current hard-coded 4-FPS assertion/configuration fails the new requirement.

- [ ] **Step 3: Import the shared production settings in V49 config**

Replace the V49-only FPS/reasoning/resolution constants with aliases imported from `../_shared/analysis-settings.ts`, while leaving V49 model names and timeout local. Both production paths then compile against one authoritative setting.

- [ ] **Step 4: Run config and request-builder tests**

Run: `npx jest --runInBand supabase/functions/analyze-video-v49/config.test.ts supabase/functions/_shared/analysis-settings.test.ts supabase/functions/_shared/gemini-generate.test.ts supabase/functions/analyze-video-v49/index-wiring.test.ts`

Expected: all suites pass and requests preserve 12 FPS/high reasoning/high resolution.

- [ ] **Step 5: Commit the configuration repair**

Run: `git add supabase/functions/analyze-video-v49/config.ts supabase/functions/analyze-video-v49/config.test.ts && git commit -m "fix: unify production analysis at 12 fps"`

### Task 6: Full verification and iOS build

**Files:**
- Verify all changed files and build metadata; no additional source file is expected.

- [ ] **Step 1: Run focused functional suites**

Run: `npx jest --runInBand src/screens/onboarding/approved-onboarding.test.tsx src/features/billing/billing-provider.test.ts src/features/billing/purchase-reconciliation.test.ts scripts/compare-analysis-fps-live.test.ts supabase/functions/analyze-video-v49/config.test.ts supabase/functions/analyze-video-v49/index-wiring.test.ts supabase/functions/_shared/analysis-settings.test.ts supabase/functions/_shared/gemini-generate.test.ts supabase/functions/_shared/gemini-cost.test.ts`

Expected: zero failed suites and zero failed tests.

- [ ] **Step 2: Run static verification**

Run: `npx tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 3: Inspect scope and repository state**

Run: `git status --short`, `git diff --check HEAD~3..HEAD`, and `git log --oneline -5`.

Expected: only planned files are committed; no secret, benchmark video, generated report, or unrelated main-checkout change is present.

- [ ] **Step 4: Start a paid EAS production iOS build**

Run: `npx eas-cli@latest build -p ios --profile production --non-interactive`

Expected: remote iOS build number auto-increments beyond 34 and reaches `FINISHED`. If the local command times out after upload, query the build list before retrying so a duplicate build is not created.

- [ ] **Step 5: Submit the finished binary to TestFlight**

Run: `npx eas-cli@latest submit -p ios --profile production --latest --non-interactive`

Expected: EAS reports successful upload to App Store Connect. Apple processing and a real TestFlight sandbox purchase remain separate device-side acceptance gates.
