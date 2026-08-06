# Website Unsubscribed State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. This repository must use one agent only; do not dispatch subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make successful Apple or Google website sign-in produce an explicit, actionable state when the account has no Formie app subscription, while preserving renewal for genuinely expired subscriptions.

**Architecture:** RevenueCat remains the source of truth. Its shared resolver will distinguish an empty customer from historical expiration, the authenticated Edge Function will pass that state through the existing sanitized dashboard DTO, and the Next.js portal will render a dedicated authenticated empty state. OAuth code remains provider-neutral because hosted evidence confirms both providers complete authentication.

**Tech Stack:** TypeScript, RevenueCat REST model, Supabase Edge Functions/Deno, Next.js 16, React 19, Jest, Node test runner, ESLint.

---

### Task 1: Model an account that never subscribed

**Files:**
- Modify: `supabase/functions/_shared/revenuecat.test.ts`
- Modify: `supabase/functions/_shared/revenuecat.ts`

- [ ] **Step 1: Write the failing resolver tests**

Add one test where both `entitlements` and `subscriptions` are empty and require `state: "not_subscribed"` with null management fields. Add a second assertion proving a historical expired entitlement is still `state: "expired"` so incomplete subscription metadata cannot erase purchase history.

- [ ] **Step 2: Run the resolver test and verify RED**

Run: `npx jest --runInBand supabase/functions/_shared/revenuecat.test.ts`

Expected: FAIL because `SubscriptionState` and `resolveSubscriptionState()` currently return `expired` for an empty customer.

- [ ] **Step 3: Implement the minimal resolver distinction**

Extend `SubscriptionState.state` with `not_subscribed`. When no subscription is selected, return `not_subscribed` only if `subscriber.entitlements.length === 0`; otherwise return `expired`, retaining the latest historical entitlement product and expiration when available. Do not infer `not_subscribed` from a provider/network error because those errors never reach the resolver as a valid subscriber.

- [ ] **Step 4: Run the resolver test and verify GREEN**

Run the same focused Jest command and require all RevenueCat tests to pass.

### Task 2: Propagate the state through the authenticated dashboard contract

**Files:**
- Modify: `supabase/functions/account-dashboard/handler.test.ts`
- Modify: `supabase/functions/account-dashboard/handler.ts` only if its explicit response type needs adjustment after the shared type changes
- Modify: `website/lib/account-dashboard.test.ts`
- Modify: `website/lib/account-dashboard.ts`

- [ ] **Step 1: Write failing backend and website DTO tests**

Add an Edge Function handler test whose authenticated subscriber is empty and assert the response contains `subscription.state: "not_subscribed"`. Add a website parser test proving the same DTO is accepted.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx jest --runInBand supabase/functions/account-dashboard/handler.test.ts` and `npm --prefix website test`.

Expected: the website DTO parser rejects `not_subscribed` until its state union and validation allowlist are extended.

- [ ] **Step 3: Update the public DTO**

Add `not_subscribed` to `website/lib/account-dashboard.ts` in both the TypeScript union and runtime allowlist. Keep all nullable fields and error normalization unchanged. The backend handler should continue fetching RevenueCat once, refreshing the ledger, and returning only sanitized fields.

- [ ] **Step 4: Run focused tests and verify GREEN**

Require both backend handler and website DTO tests to pass.

### Task 3: Render the authenticated no-subscription explanation

**Files:**
- Modify: `website/app/manage-subscription/manage-subscription.test.tsx`
- Modify: `website/app/manage-subscription/manage-subscription-client.tsx`
- Modify: `website/app/globals.css`

- [ ] **Step 1: Write the failing portal component test**

Render a dashboard with `subscription.state: "not_subscribed"`. Require the page to show `No subscription to manage`, explain that a subscription must be started in the Formie app with the same account, link to the App Store URL, retain Log Out, and omit quota, cancel, renew, and delete controls.

- [ ] **Step 2: Run the component test and verify RED**

Run: `npm --prefix website test`.

Expected: FAIL because the current component renders the normal plan dashboard for every authenticated DTO.

- [ ] **Step 3: Implement the dedicated state**

Before the normal subscription dashboard branch, render an authenticated `not_subscribed` section with `role="alert"`, explanatory copy, an App Store action sourced from `NEXT_PUBLIC_APP_STORE_URL` with a safe fallback to the homepage, and the existing local Log Out action. Add only the CSS needed to keep this state bounded and readable on mobile.

- [ ] **Step 4: Run the component tests and verify GREEN**

Require all website tests to pass, including the existing Apple/Google icon, authenticated failure, renewing, and cancelled cases.

### Task 4: Verify and deploy the complete repair

**Files:**
- Verify only: all files above plus existing OAuth callback tests
- Deploy: `supabase/functions/account-dashboard`
- Deploy: `website/` through the linked Vercel project

- [ ] **Step 1: Run focused backend tests**

Run: `npx jest --runInBand supabase/functions/_shared/revenuecat.test.ts supabase/functions/account-dashboard/handler.test.ts`

Expected: PASS.

- [ ] **Step 2: Run full website verification**

Run: `npm --prefix website test`, `npm --prefix website run lint`, `npx tsc --noEmit --incremental false -p website/tsconfig.json`, and `npm --prefix website run build`.

Expected: every command exits zero without TypeScript, lint, or build errors.

- [ ] **Step 3: Deploy the authenticated backend**

Run: `npx supabase functions deploy account-dashboard --no-verify-jwt=false` only if supported by the installed CLI; otherwise deploy with the repository's configured JWT verification. Confirm the deployed function is ACTIVE and its new version is visible.

- [ ] **Step 4: Deploy the website**

Use the cached authenticated `vercel.cmd` from `website/` with `--prod --yes`, preserving the linked `useformie` project. Confirm the deployment aliases to `https://useformie.com`.

- [ ] **Step 5: Smoke-test production**

Confirm `/manage-subscription` returns HTTP 200, both provider actions remain in the signed-out HTML, and the callback route still rejects a missing or invalid code with a retryable portal error. Report that credentialed provider completion still requires the user's Google or Apple account, but backend sign-in timestamps already verify both providers reach Supabase.
