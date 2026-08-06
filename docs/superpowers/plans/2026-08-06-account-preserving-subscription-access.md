# Account-Preserving Subscription Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. This repository must use one agent only; do not dispatch subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep completed accounts accessible after subscription expiration, gate only new analyses, expose native repurchase and Home quota UI, and simplify the website portal to active subscription management without account deletion.

**Architecture:** Separate account admission from analysis entitlement with pure access-policy helpers consumed by launch routing, Expo Router guards, the center tab, and Home. Keep RevenueCat plus the server ledger authoritative for purchase and quota. The website authenticates every visitor but renders management only for active/paid-through subscriptions and directs inactive users to purchase inside the app.

**Tech Stack:** Expo Router, React Native, TypeScript, RevenueCat, Supabase Edge Functions, Next.js 16, React, Node test runner, Jest.

---

### Task 1: Encode account and analysis-entry policy

**Files:**
- Create: `src/features/access/account-access.ts`
- Create: `src/features/access/account-access.test.ts`
- Delete: `src/features/access/session-exit.ts`
- Delete: `src/features/access/session-exit.test.ts`

- [ ] Write failing tests proving completed accounts remain accessible for active, expired, and unknown access; premium-required accounts remain locked unless access is active; analysis entry returns `record`, `quota_exhausted`, `purchase`, or `unavailable` correctly.
- [ ] Run `npx jest --runInBand src/features/access/account-access.test.ts` and confirm failure before implementation.
- [ ] Implement `canOpenCompletedAccount`, `resolveAnalysisEntry`, and `formatAnalysisBalance` as pure functions using existing access types.
- [ ] Delete the obsolete expired-session terminator and its tests.
- [ ] Re-run the focused tests and expect all passing.

### Task 2: Repair launch routing and protected routes

**Files:**
- Modify: `src/features/auth/launch-route.ts`
- Modify: `src/features/auth/launch-route.test.ts`
- Modify: `src/app/index.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/screens/auth/index.tsx`

- [ ] Change launch-route tests first so completed expired and unresolved accounts expect `/(tabs)/(home)`, while `premium_required + expired` still expects `/subscription`.
- [ ] Run the test and confirm it fails under the old terminator behavior.
- [ ] Remove `resolveSettledAccessIssue`; route completed accounts to Home independently of billing status.
- [ ] Remove expiry logout, subscription-required popup, and billing/access loading gates from `src/app/index.tsx`; retain only lifecycle state required to choose onboarding, Login, initial Premium, or Home.
- [ ] Use `canOpenCompletedAccount` in `src/app/_layout.tsx`; allow `/subscription` for initial purchase and authenticated completed-account repurchase without unlocking incomplete accounts.
- [ ] Remove the now-unused `SubscriptionRequiredScreen` export.
- [ ] Re-run launch tests, then `npx tsc --noEmit` to catch guard/type mismatches.

### Task 3: Replace Record with Purchase subscription when expired

**Files:**
- Modify: `src/components/center-tab-button.tsx`
- Create: `src/components/center-tab-button.test.tsx`
- Modify: `src/app/(tabs)/_layout.tsx`
- Modify: `src/app/subscription.tsx`
- Modify: `src/features/access/ensure-analysis-access.test.ts`

- [ ] Add a failing component test proving the center control accepts an accessible label and visible text.
- [ ] Add or update policy tests for expired, exhausted, active, legacy, and unresolved access.
- [ ] Parameterize `CenterTabButton` with `label` and `accessibilityLabel`.
- [ ] In the tabs layout, open `/subscription` for `purchase`, show the reset message for `quota_exhausted`, show a retryable status alert for `unavailable`, and open exercise selection only for `record`.
- [ ] Keep server-side reservation enforcement and its saved-result error behavior unchanged.
- [ ] Make `/subscription` return completed repurchasers to Home after successful purchase/restore without re-running onboarding; keep initial-purchase completion behavior.
- [ ] Run the focused access, component, and subscription tests.

### Task 4: Add the Home analysis balance

**Files:**
- Modify: `src/app/(tabs)/(home)/index.tsx`
- Modify: `src/screens/home/index.tsx`
- Modify: `src/screens/home/home.test.tsx`

- [ ] Add failing Home tests for `8 analyses left`, `0 analyses left`, `Unlimited`, and the unresolved label.
- [ ] Read access context in the Home route and pass the formatted balance into `HomeScreen`.
- [ ] Extend `HomeHeader` with a bounded top-right balance pill beside Settings, including narrow-width text behavior and accessibility labels.
- [ ] Ensure loading, empty-history, and populated-history variants all render the same header balance.
- [ ] Run `npx jest --runInBand src/screens/home/home.test.tsx src/features/access/account-access.test.ts`.

### Task 5: Simplify and correctly gate the website dashboard

**Files:**
- Modify: `website/app/manage-subscription/manage-subscription-client.tsx`
- Modify: `website/app/manage-subscription/manage-subscription.test.tsx`
- Modify: `website/app/globals.css`

- [ ] Update tests first to require no App Store badge in any popup, no deletion UI, an inactive-subscription blocking message that points to the app, active cancellation, and cancelled-paid-through resubscribe when a management URL exists.
- [ ] Run `npm --prefix website test` and confirm the old badge/deletion implementation fails.
- [ ] Remove `AppStoreBadge` from popup rendering while retaining Apple/Google icons on signed-out OAuth buttons.
- [ ] Hide the dashboard for expired and never-subscribed states and render `Renew in the Formie app`; keep active and paid-through management controls.
- [ ] Remove the deletion state, confirmation flow, Function invocation, danger-area markup, and unused styles.
- [ ] Run website tests and lint.

### Task 6: Remove the account-deletion endpoint and update legal/setup text

**Files:**
- Delete: `supabase/functions/delete-account/handler.ts`
- Delete: `supabase/functions/delete-account/index.ts`
- Delete: `supabase/functions/delete-account/handler.test.ts`
- Modify: `supabase/config.toml`
- Modify: `website/app/privacy/page.tsx`
- Modify: `website/app/terms/page.tsx`
- Modify: `docs/FORMIE_ONBOARDING_REVENUECAT_SETUP.md`

- [ ] Remove the `delete-account` Function registration and source/tests so the endpoint is not part of future deployments.
- [ ] Remove self-service deletion claims from Privacy and Terms while keeping accurate cancellation and paid-through language.
- [ ] Document that expiration preserves account/history access, blocks new analyses, changes Record to Purchase subscription, and requires native repurchase.
- [ ] Run backend/shared tests, website tests, and source searches proving no client-exposed deletion action remains.

### Task 7: Full verification, restart, and deployment

**Files:**
- Verify all modified files above; do not stage unrelated dirty work.

- [ ] Run focused Jest tests for access, launch routing, Home, tabs/purchase, billing, and website portal.
- [ ] Run `npx tsc --noEmit` and `npm run lint`.
- [ ] Run `npm --prefix website test`, `npm --prefix website run lint`, and `npm --prefix website run build`.
- [ ] Restart Expo with `npm start -- --dev-client --lan --clear`, verify the listener belongs to Formie, request the iOS manifest/bundle, confirm markers for `Purchase subscription` and `analyses left`, and reload the connected iOS client.
- [ ] Deploy the website production build, verify the production alias, and inspect the live Manage Subscription inactive popup for no App Store icon and no deletion action.
- [ ] Report source-test, build, deployment, and device-delivery evidence separately; do not claim device-visible behavior from compilation alone.
