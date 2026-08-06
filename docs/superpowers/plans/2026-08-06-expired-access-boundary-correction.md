# Expired Access Boundary Correction Implementation Plan

> Execute this plan inline in the current worktree. Repository instructions prohibit subagents.

**Goal:** Keep completed accounts usable in the native app after subscription expiry while locking expired users out of the website dashboard and removing the public website header from the portal route.

**Architecture:** Separate account admission from analysis admission. The native global gate blocks only unresolved entitlement verification; `resolveAnalysisEntry` remains responsible for record, quota-exhausted, purchase, and unavailable action states. The website client branches on normalized subscription state before constructing the dashboard shell, and the route stops composing the public `SiteShell`.

**Stack:** Expo Router, React Native, TypeScript, Jest, Next.js, React, Supabase Realtime, Node test runner, CSS.

## Task 1: Specify native admission behavior with tests

**Files:**
- Modify `src/features/access/account-access.test.ts`
- Modify `src/features/auth/launch-route.test.ts`
- Modify `src/components/subscription-access-gate.test.tsx`

**Changes:**
- Assert completed active and expired profiles can open the native account.
- Preserve assertions that signed-out, incomplete, loading, and unknown states do not bypass verification.
- Assert expired completed users launch Home rather than the subscription route.
- Assert the global gate renders native application children after expiry and does not present purchase controls itself.
- Retain analysis-entry assertions proving expiry maps to Purchase and zero quota maps to the disabled exhausted state.

**Verification:** Run the three focused Jest files and confirm the new expectations fail before implementation, then pass afterward.

## Task 2: Correct native account routing at the source

**Files:**
- Modify `src/features/access/account-access.ts`
- Modify `src/features/auth/launch-route.ts`
- Modify `src/components/subscription-access-gate.tsx`
- Verify `src/app/index.tsx`
- Verify `src/app/(tabs)/_layout.tsx`
- Verify `src/features/access/ensure-analysis-access.ts`

**Changes:**
- Make account admission depend on authentication, completed profile, and a resolved active-or-expired access state.
- Route completed active and expired users to Home; route unknown access to the existing verification surface.
- Reduce the global subscription gate to loading/unknown verification and remove its expired purchase wall.
- Leave the tab-center state machine and paid mutation guards intact so expired users receive Purchase only when attempting analysis, while active zero-quota users remain disabled.
- Do not weaken any Edge Function entitlement or quota reservation check.

## Task 3: Specify the website lockout and header removal

**Files:**
- Modify `website/app/manage-subscription/manage-subscription.test.tsx`
- Add page composition coverage if needed for `website/app/manage-subscription/page.tsx`

**Changes:**
- Assert active and cancelled-paid-through states retain dashboard content.
- Assert expired and not-subscribed states render only the recovery view.
- Assert recovery HTML omits sidebar navigation, red status text, plan/quota cards, and management row.
- Assert recovery HTML includes Open Formie, support, and sign-out actions.

**Verification:** Run the focused website test and confirm the changed expectations fail before implementation, then pass afterward.

## Task 4: Implement the website portal boundary and redesign

**Files:**
- Modify `website/app/manage-subscription/page.tsx`
- Modify `website/app/manage-subscription/manage-subscription-client.tsx`
- Modify `website/app/globals.css`
- Verify `website/components/account-portal-shell.tsx`
- Verify `website/components/site-shell.tsx`

**Changes:**
- Stop wrapping the manage-subscription route with `SiteShell`, eliminating the public white header and footer structurally.
- Add an expired/not-subscribed branch before `AccountPortalShell` creation.
- Render a dedicated full-viewport recovery section with high-resolution Formie branding, calm copy, a primary deep link to `form://subscription`, support, and sign-out.
- Keep active and active-cancelled paid-through accounts in `AccountPortalShell`.
- Remove expired-only dashboard labels and CSS, and make portal/recovery min-height cover the full viewport now that the marketing header is absent.
- Preserve authenticated Realtime subscriptions so a lifecycle update can replace the dashboard with the recovery view immediately.

## Task 5: Verify, restart, and commit

**Files:**
- All intended worktree changes requested by the user

**Changes and commands:**
- Run focused native and website tests.
- Run the complete root Jest suite, root TypeScript check, and Expo lint.
- Run website tests, lint, and production build.
- Run `git diff --check` and inspect staged status/statistics.
- Restart Metro and the Next.js development server, then verify the Expo manifest and website routes respond successfully.
- Stage the complete current worktree with `git add -A`, because the user explicitly requested all accumulated changes be committed.
- Create one descriptive commit and confirm the worktree is clean. Do not push without a separate request.
