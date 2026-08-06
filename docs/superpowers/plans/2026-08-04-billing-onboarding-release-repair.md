# Billing, Onboarding, and Release Readiness Repair Plan

> **For agentic workers:** Execute this plan inline in the current session. The repository owner explicitly prohibits subagents.

**Goal:** Remove the audited release blockers by enforcing subscription access, making RevenueCat expiry authoritative, rendering real onboarding controls and transient states, and documenting the remaining provider/build operations precisely.

**Architecture:** Keep RevenueCat as the provider source of truth, but map subscriber entitlements through one shared time-aware function before either refresh or cron reconciliation writes the access ledger. Activate the existing server launch function through an append-only migration so pre-launch accounts are preserved as `legacy_unlimited` and post-launch accounts require a live entitlement. Replace the screenshot-first onboarding branch with the already-implemented native layouts and controls; only runtime-imported native artwork remains in the screen.

**Tech Stack:** Expo 54, React Native, Expo Router, Jest, TypeScript, Supabase SQL migrations/Edge Functions, RevenueCat native/web clients, EAS configuration.

---

## File map and responsibilities

### Billing and access

- Create `supabase/migrations/202608040004_activate_subscription_launch.sql`.
  - Invoke `public.activate_subscription_launch()` after migration `202608040002` defines it.
  - Keep activation idempotent and preserve the migration order; do not directly overwrite existing entitlement rows.
- Modify `supabase/functions/_shared/revenuecat.ts`.
  - Add a typed time-aware snapshot helper that returns `active` only when the configured entitlement exists and its expiration is in the future.
  - Return the configured entitlement ID and historical period/product fields with `status: "expired"` when the result has ended, so audit data is preserved without storing stale provider data as active.
- Modify `supabase/functions/refresh-entitlement/index.ts`.
  - Replace the raw identifier lookup with the shared snapshot helper before the upsert.
  - Persist the helper’s status, entitlement ID, product ID, purchase start, and expiration.
- Modify `supabase/functions/reconcile-entitlements/index.ts`.
  - Apply the same shared snapshot helper to cron reconciliation.
  - Keep legacy rows excluded from provider reconciliation.
- Modify `supabase/functions/_shared/revenuecat.test.ts`.
  - Prove an expired provider entitlement produces an expired persistence snapshot, not an active one.
- Create `supabase/functions/create-analysis/subscription-activation-wiring.test.ts`.
  - Prove the append-only activation migration exists and calls the service-role launch function.
- Modify `package.json` only if needed to include the new wiring test in the focused analysis/billing test command; preserve all existing scripts and unrelated dependency changes.

### Onboarding UI

- Modify `src/screens/onboarding/approved-onboarding.tsx`.
  - Remove the `approvedReferenceAssets`/`ReferenceScreen`/transparent hit-target branch from the runtime path.
  - Keep `Welcome`, `Loading`, `AccountCreation`, `Premium`, `QuestionContent`, and `MarketingArtwork` as the native visual implementation.
  - Add a stable test ID/accessibility value for the age wheel’s current selection.
  - Show `Connecting...` with an activity indicator while account OAuth is in progress.
  - Keep purchase/restore busy state, error text, live package price, and disabled actions visible on Premium.
  - Accept explicit RevenueCat package availability so `Go Now` is disabled when no live monthly package exists; keep Restore Purchase available unless an operation is busy.
  - Do not add a production skip path or generic fallback copy.
- Modify `src/app/onboarding/[step].tsx` and `src/app/subscription.tsx`.
  - Pass `billing.offering?.packages[0]` availability into the shared Premium screen.
  - Continue passing the live localized price and billing/auth error state; do not enable purchase against the fallback display value.
- Modify `src/screens/onboarding/approved-onboarding.test.tsx`.
  - Replace screenshot-specific price assertions with visible native price assertions.
  - Add regression coverage that stateful controls expose visible selected state and no approved screenshot is mounted for question steps.
  - Add regression coverage for account connection and Premium purchase errors/progress.
  - Add regression coverage that an unavailable RevenueCat package disables purchase without disabling restore.

### Release configuration and documentation

- Modify `supabase/config.toml`.
  - Set the production Site URL to `https://useformie.com` while retaining the native callback and explicit local development callback URLs.
  - Do not place OAuth secrets in the file.
- Modify `src/features/auth/auth-backend-config.test.ts`.
  - Assert the production Site URL, native callback, and explicit localhost development callbacks without relying on the old single-line TOML layout.
- Modify `docs/FORMIE_ONBOARDING_REVENUECAT_SETUP.md`.
  - State that migration `202608040004` activates enforcement.
  - Separate Test Store development values from required App Store/Google Play production values.
  - Add exact EAS environment names/commands and the required post-build verification, without committing real keys.
- Modify `eas.json` only for non-secret profile metadata or validation-compatible environment naming; never put `test_` or production RevenueCat keys in source control.

## Execution sequence

1. Add the failing regression tests and run only those tests. Expected result: current code fails because raw reconciliation bypasses expiry, the activation migration is absent, the screenshot branch has no visible native controls/transient states, and the paywall cannot distinguish an unavailable package from a live price.
2. Implement the shared RevenueCat snapshot and wire both Edge Functions to it. Re-run the billing tests and confirm the expired case is green.
3. Add the append-only activation migration and migration wiring test. Confirm it calls the existing service-role function rather than changing the legacy-seeding logic.
4. Remove the runtime screenshot branch, expose the native onboarding states, and pass live package availability through both paywall routes. Re-run the onboarding screen suite and inspect the rendered test tree for visible selected values, error text, progress text, and a disabled unavailable-package purchase button.
5. Update the Supabase local config and setup guide. Check the EAS project environment list without printing secret values. If real provider keys/store products are unavailable, report those external prerequisites rather than substituting Test Store values.
6. Run the focused billing/onboarding suite, full TypeScript check, lint, and the existing targeted regression commands. Review `git diff` and `git status` to ensure only intended hunks are part of this repair; do not stage or commit the user’s unrelated dirty work.

## External release operations that code cannot complete

- RevenueCat dashboard: create real App Store and Google Play apps for `app.form.coach`, attach the monthly products to `formie_pro`, remove the unused yearly package and duplicate entitlement, and configure the production offering.
- EAS: set actual platform public RevenueCat keys in the `development`, `preview`, and `production` EAS environments. Local `test_` keys are valid only for development/Test Store QA.
- Supabase dashboard: apply the migrations/functions, set the production Site URL and redirect allowlist, configure provider secrets, and schedule reconciliation.
- Release build: build an EAS development/preview or production-compatible iOS artifact after provider setup, install it, and test Google/Apple, purchase, restore, expiry, and logout on a physical device.

## Verification commands

```powershell
npx jest --runInBand supabase/functions/_shared/revenuecat.test.ts supabase/functions/create-analysis/subscription-activation-wiring.test.ts src/screens/onboarding/approved-onboarding.test.tsx
npx tsc --noEmit
npm run lint
```

Completion requires fresh command output, a clean intended diff review, and a separate report for live RevenueCat/Supabase/EAS/device verification.
