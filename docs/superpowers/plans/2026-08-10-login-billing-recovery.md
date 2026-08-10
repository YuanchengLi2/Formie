# Login and Billing Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not use subagents for this repository; the owner explicitly requires single-agent execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the post-login black screen for missing or incomplete profiles, prove Google authentication uses the same authoritative billing identity, verify native cancellation and resubscription behavior, and refresh the existing development runtime without creating a TestFlight build.

**Architecture:** Supabase authentication owns the stable user UUID, and that UUID must be the only RevenueCat App User ID regardless of whether the session came from email, Apple, or Google. Root routing must maintain a matching invariant with Expo Router protection: incomplete profiles may only target onboarding routes, while completed profiles may target subscription or app routes. Apple remains authoritative for cancellation; Formie presents the native subscription sheet and reconciles RevenueCat plus the server ledger when the app becomes active again.

**Tech Stack:** Expo Router 6, React Native 0.81, Supabase Auth/PostgREST/Edge Functions, RevenueCat `react-native-purchases`, Jest, TypeScript, Expo dev client.

---

## File map

- Modify `src/features/auth/launch-route.test.ts`: add regressions for authenticated users whose profile is missing/incomplete and whose account-scoped onboarding state is either fresh or already in progress.
- Modify `src/features/auth/launch-route.ts`: enforce the route-protection invariant by routing every incomplete authenticated profile to onboarding, never `/subscription`.
- Modify `src/features/billing/purchases.native.test.ts` only if the identity trace exposes a provider-dependent or stale RevenueCat identity transition; test configuration from anonymous/different users to the authenticated Supabase UUID.
- Modify `src/features/billing/purchases.native.ts` only if the RED test proves the current `configuredUserId` bookkeeping can leave RevenueCat on another App User ID.
- Modify `src/features/billing/billing-provider.test.ts` only if provider-level evidence shows reconciliation begins before RevenueCat has adopted the authenticated UUID; test ordering between `configure`, `getCustomerInfo`, and `refresh-entitlement`.
- Modify `src/features/billing/billing-provider.tsx` only if required by that failing ordering test; keep authentication-provider details out of billing and key solely on `auth.user.id`.
- Modify `src/app/account/manage-subscription.tsx` only if focused UI/runtime evidence shows the native management action is unreachable or its state is stale; preserve Apple-owned cancellation and in-app resubscription after expiry.
- Modify `src/app/(tabs)/(profile)/index.tsx` only if settings does not reflect access updates after returning from Apple; the route must render `AccessProvider` state and not maintain a second billing cache.
- Modify the relevant focused test beside either settings file if a UI change is needed.
- Do not modify account data until the live audit distinguishes current Apple/RevenueCat state from obsolete Formie-only state.

### Task 1: Repair incomplete-account launch routing

- [ ] **Step 1: Write failing launch-route regressions**

Add tests equivalent to:

```ts
expect(resolveLaunchRoute({
  phase: "authenticated",
  onboarding: "not_started",
  currentStep: "welcome",
  profileComplete: false,
  accessStatus: "unknown",
})).toBe("/onboarding/welcome");

expect(resolveLaunchRoute({
  phase: "authenticated",
  onboarding: "logged_out",
  currentStep: "welcome",
  profileComplete: false,
  accessStatus: "unknown",
})).toBe("/onboarding/welcome");
```

The second case covers reauthentication after an old explicit logout marker. Existing `in_progress` and `profile_sync_required` tests continue to cover exact-step resume and profile synchronization.

- [ ] **Step 2: Run the focused test and prove RED**

Run: `npx jest --runInBand src/features/auth/launch-route.test.ts`

Expected before implementation: the new cases receive `/subscription`, proving the protected-route contradiction.

- [ ] **Step 3: Implement the route invariant**

In the authenticated `!profileComplete` branch of `resolveLaunchRoute`:

```ts
if (onboarding === "profile_sync_required" || onboarding === "awaiting_account") {
  return "/onboarding/create-account";
}
if (onboarding === "in_progress") {
  return `/onboarding/${currentStep ?? "welcome"}`;
}
return "/onboarding/welcome";
```

This fixes the cause rather than adding a black-screen fallback: the returned route is now always permitted by `_layout.tsx`'s `onboardingAllowed` guard.

- [ ] **Step 4: Run focused auth routing tests and prove GREEN**

Run: `npx jest --runInBand src/features/auth/launch-route.test.ts src/features/auth/onboarding-auth-route.test.tsx src/features/auth/auth-callback-route.test.tsx`

Expected: all suites pass, with missing, incomplete, newly created, and completed accounts selecting valid routes.

### Task 2: Prove Google and email share one billing identity

- [ ] **Step 1: Inspect the live authentication identity without mutating it**

Resolve `yuanchengli612@gmail.com` via the Supabase Admin API and compare its provider list, UUID, `user_profiles.user_id`, and `user_access_entitlements.revenuecat_app_user_id`.

Expected invariant: the email and Google identities are attached to one Supabase UUID, and the entitlement row uses that same UUID.

- [ ] **Step 2: Trace native RevenueCat configuration**

Verify `BillingProvider.configure()` passes `auth.user.id`, `purchases.native.ts` calls `Purchases.logIn(appUserId)` whenever the configured SDK identity may differ, and reconciliation runs only after configuration resolves.

- [ ] **Step 3: Add a failing identity test only if the trace finds a mismatch**

The regression must reproduce the exact stale transition, such as anonymous SDK initialization followed by Google authentication. It must assert `Purchases.logIn(<Supabase UUID>)` happens before `getCustomerInfo()`.

- [ ] **Step 4: Apply the smallest identity fix only after RED**

Keep the billing interface provider-neutral. Apple, Google, and email login must all converge on `auth.user.id`; do not key RevenueCat by email or OAuth subject.

- [ ] **Step 5: Run focused billing identity tests**

Run: `npx jest --runInBand src/features/billing/purchases.native.test.ts src/features/billing/billing-provider.test.ts src/features/billing/api.test.ts`

Expected: configuration, reconciliation, and logout/login transitions pass for the stable UUID.

### Task 3: Verify cancellation, return-to-app refresh, restart, and Settings rendering

- [ ] **Step 1: Verify native management presentation tests**

Run: `npx jest --runInBand src/features/billing/purchases.native.test.ts src/features/billing/subscription-management.test.ts src/screens/profile/profile.test.tsx`

Confirm iOS calls `Purchases.showManageSubscriptions()` rather than opening a web account URL, and confirm Settings distinguishes active renewal, cancellation-at-period-end, and expiry.

- [ ] **Step 2: Verify lifecycle reconciliation tests**

Run: `npx jest --runInBand src/features/access/access-provider.test.ts src/features/billing/billing-provider.test.ts supabase/functions/refresh-entitlement/handler.test.ts supabase/functions/revenuecat-webhook/handler.test.ts`

Confirm both app foregrounding and RevenueCat webhooks update the authoritative server state, including cancellation, uncancellation/resume, renewal, and expiry.

- [ ] **Step 3: Fix only a reproduced gap**

If the native sheet cannot open, patch the presentation boundary and its test. If returning from Apple does not refresh, patch the AppState reconciliation ordering and its test. If Settings remains stale after access changes, remove the stale local source and render the AccessProvider value directly. Do not add client-side cancellation mutations because Apple owns the subscription transaction.

- [ ] **Step 4: Verify resubscription behavior**

Before expiry, Apple management owns “resume renewal.” After expiry, `ManageSubscriptionRoute` must offer `Resubscribe in Formie`, which routes to `/subscription` and starts a new in-app purchase; access is restored only after RevenueCat and the server ledger agree.

### Task 4: Reset only obsolete account state

- [ ] **Step 1: Compare current providers and billing authorities**

Read the Supabase auth providers, profile, access ledger, sandbox scenario row, reservations, and last RevenueCat snapshot. Do not delete a current Apple sandbox entitlement merely because the account previously used another test system.

- [ ] **Step 2: Select the narrow reset target from evidence**

- If only `subscription_test_scenarios` is obsolete, delete that test override row.
- If an abandoned analysis reservation is incorrectly holding credit, cancel that reservation through the existing reservation lifecycle.
- If RevenueCat itself still owns an active Apple sandbox subscription, report that Apple purchase history must be cancelled/expired or cleared at the Apple sandbox layer; deleting the Supabase ledger alone is not a reset because reconciliation will recreate it.
- Preserve `auth.users`, linked Google/email identities, and `user_profiles` unless the owner explicitly asks to delete the whole account and onboarding data.

- [ ] **Step 3: Read back all affected rows**

After any authorized mutation, query the exact user UUID and confirm only the selected obsolete state changed.

### Task 5: Focused verification, push, and dev-runtime refresh

- [ ] **Step 1: Run focused regression suites**

Run the auth-routing suites plus only the billing/access/settings suites touched by the implementation.

- [ ] **Step 2: Run TypeScript validation**

Run: `npx tsc --noEmit`

Expected: no new TypeScript errors.

- [ ] **Step 3: Review the scoped diff**

Use `git diff --check` and `git diff -- <changed paths>`. Preserve unrelated `.codex-tmp/` and `website/tsconfig.tsbuildinfo` files.

- [ ] **Step 4: Commit and push**

Stage only the plan and verified source/test files, commit with a scoped message, and push the current branch. Do not create or submit an EAS/TestFlight build.

- [ ] **Step 5: Refresh the existing development bundle**

Verify the Formie-owned Metro listener, `/status`, iOS manifest, and bundle response. Restart only that project process if required; otherwise the existing Metro dev session will serve the new code automatically. Provide the existing dev-client QR/URL and clearly label it as a Metro development QR, not an installation QR.
