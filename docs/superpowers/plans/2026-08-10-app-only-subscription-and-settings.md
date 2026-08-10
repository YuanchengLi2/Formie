# App-only Subscription and Settings Implementation Plan

> **For agentic workers:** Execute this plan in one agent. The workspace owner explicitly prohibits subagents. Follow `superpowers:executing-plans`, `superpowers:test-driven-development`, and `superpowers:verification-before-completion` inline.

**Goal:** Make subscription management exclusively native, make Apple management reliably open regardless of background entitlement reconciliation, automatically refresh access after lifecycle changes, simplify Settings support/legal content, publish an accurate retention policy, and remove the public website subscription portal.

**Architecture:** The native `AccessProvider` remains the single automatic entitlement-refresh owner: initial authentication, foreground transitions, Realtime events, exact billing boundaries, and renewal-pending retries all converge there. `BillingProvider.manageSubscription` becomes a presentation command that is never blocked by passive reconciliation; it opens StoreKit first and then starts a non-blocking reconciliation. The website becomes informational/legal only, with no authentication or subscription-management surface.

**Tech Stack:** Expo Router, React Native, RevenueCat/StoreKit, Jest, Next.js, Vitest, TypeScript, Vercel.

---

## Task 1: Remove the website subscription portal completely

**Files:**

- Delete `website/app/manage-subscription/page.tsx` and `website/app/manage-subscription/manage-subscription-client.tsx` so `/manage-subscription` has no Next.js route and returns 404 rather than redirecting.
- Delete portal-only UI/tests: `website/app/manage-subscription/manage-subscription.test.tsx`, `website/app/manage-subscription/subscription-intent-dialog.tsx`, and `website/app/manage-subscription/subscription-intent-dialog.test.tsx`.
- Delete portal-only OAuth callback files: `website/app/auth/callback/route.ts`, `route.test.ts`, and `callback-next.ts`.
- Delete portal-only infrastructure: `website/lib/oauth-redirect.ts`, its test, `website/lib/account-dashboard.ts`, its test, all three `website/lib/supabase/{browser,server,route}.ts` modules and `route.test.ts`, and `website/components/account-portal-shell.tsx`.
- Delete `website/proxy.ts` and `website/lib/subscription-intent.ts` with its test because both exist only to authenticate and mutate the removed portal, then remove the now-unused `@supabase/ssr` and `@supabase/supabase-js` website dependencies and refresh `website/package-lock.json`.
- Modify `website/components/site-shell.tsx` to remove the Manage Subscription navigation link and later expose Retention Policy in the footer.
- Modify `website/app/globals.css` to remove portal-only styles and change compact navigation from four to three columns.
- Modify `website/app/page.test.tsx` to assert that the public navigation contains only product, privacy, and terms destinations and does not advertise subscription management.
- Add `website/app/removed-subscription-portal.test.ts` to enforce that the removed route, auth callback, and browser Supabase portal modules do not return accidentally.

**Steps:**

- [ ] Add the removal contract test and update the home-shell expectation; run the focused Vitest command and observe failure while the route still exists.
- [ ] Delete the portal files and remove their CSS/navigation references with `apply_patch`.
- [ ] Run the focused website tests again and verify the removal contract passes.

## Task 2: Decouple Apple management presentation from billing reconciliation

**Files:**

- Modify `src/features/billing/billing-provider.tsx`: remove the silent early return tied to `purchasing`, `reconciling`, or `restoring`; configure RevenueCat and present the native management sheet immediately; after the sheet closes, launch entitlement reconciliation without making a later network failure retroactively fail the presentation action.
- Add `src/features/billing/subscription-management-presentation.ts`: isolate the sequence as a testable command boundary that awaits configuration and store presentation, then starts reconciliation as background work with its own error boundary.
- Modify `src/features/billing/billing-provider.test.ts` to prove management presentation occurs while passive reconciliation is active and to prove post-sheet reconciliation remains automatic.
- Modify `src/features/billing/purchases.native.test.ts` only if needed to preserve the iOS StoreKit-management contract and error propagation.

**Steps:**

- [ ] Add a behavioral regression test that reproduces the current no-op when provider state is reconciling; run it and confirm RED because `showManageSubscriptions` is not called.
- [ ] Change only the management command and its post-dismissal reconciliation boundary; do not add polling or duplicate the `AccessProvider` lifecycle.
- [ ] Run the focused billing tests and confirm GREEN, including purchase, restore, and existing reconciliation behavior.

## Task 3: Simplify the native subscription-management screen

**Files:**

- Modify `src/app/account/manage-subscription.tsx`: keep one actionable StoreKit/provider button, remove manual Refresh Status state/button and the redundant success alert, show actionable errors only when the native management sheet cannot be presented, and preserve plan/billing details.
- Extend `src/features/billing/subscription-management.test.ts` (kept outside the Expo route tree) to assert the route has no manual refresh action and still invokes `billing.manageSubscription`.
- Preserve `src/app-route-hygiene.test.ts`, which prevents Jest test files from being interpreted as routes.

**Steps:**

- [ ] Update the focused route contract test first and confirm it fails against the existing Refresh Status implementation.
- [ ] Remove route-local refresh behavior and make the single button’s busy state local to presentation.
- [ ] Run route-hygiene and subscription-screen tests to confirm GREEN.

## Task 4: Rework Settings support, policies, and subscription-row geometry

**Files:**

- Modify `src/features/auth/legal-config.ts`: add `retentionUrl`, defaulting to `https://useformie.com/retention`, while preserving environment overrides for existing legal URLs.
- Modify `src/features/auth/legal-config.test.ts` to cover the new stable default.
- Modify `src/screens/profile/index.tsx`: replace Premium Support and separate feedback affordances with one `Get Help` action; remove privacy/retention summary rows; add Privacy Policy and Retention Policy links; keep Terms; and top-align the subscription chevron with the plan title.
- Modify `src/screens/profile/profile.test.tsx` to verify labels, callbacks, links, removed copy, and chevron alignment.
- Modify `src/app/(tabs)/(profile)/index.tsx` to pass the resolved retention URL to the profile screen.

**Steps:**

- [ ] Add legal-config and profile assertions first; run focused Jest and verify missing retention/link/layout behavior fails.
- [ ] Implement the prop/config/UI changes and avoid introducing another subscription refresh mechanism.
- [ ] Run the focused profile/legal tests and confirm GREEN.

## Task 5: Publish accurate privacy, retention, and terms language

**Files:**

- Add `website/app/retention/page.tsx` and `page.test.tsx`. Explain the implemented rule precisely: eligible server-side analysis data is deleted after 30 days only when that retention option is enabled and effective, pre-effective analyses are not silently covered, local device copies are separate, and limited provider/legal records can remain.
- Modify `website/app/privacy/page.tsx` and its test so the privacy page links to retention details and does not claim uploads are universally removed immediately after processing.
- Modify `website/app/terms/page.tsx` and its test so account/subscription management is described as in-app rather than through a removed dashboard.
- Modify `website/components/site-shell.tsx` and relevant shell tests to add the Retention Policy footer link.

**Steps:**

- [ ] Write the retention/legal content tests and confirm RED for the missing page and outdated dashboard wording.
- [ ] Implement the pages and shell links using the existing legal-page visual system.
- [ ] Run the complete website test suite and confirm GREEN.

## Task 6: Verify, commit, deploy, and restart development runtime

**Files:**

- No new product files. Commit only intentional tracked changes and the already-present route-hygiene test move; never stage `.codex-tmp/` or `website/tsconfig.tsbuildinfo`.

**Steps:**

- [ ] Run focused native tests, then full `npx jest --runInBand`, `npx tsc --noEmit`, and `npx expo lint`.
- [ ] From `website/`, run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
- [ ] Inspect `git diff --check`, `git status`, and the final diff for accidental/unrelated changes.
- [ ] Commit logical implementation changes and push the current branch to `origin`; do not create, submit, or upload an EAS/TestFlight build.
- [ ] Deploy production from the repository root with Vercel, verify READY/alias, and check `/`, `/privacy`, `/retention`, and `/terms` return 200 while `/manage-subscription` returns 404.
- [ ] Restart only the Formie Expo dev-client tunnel process on port 8081, preserving unrelated processes. Verify the new listener persists, `/status` responds, the iOS manifest resolves, and its exact `launchAsset.url` returns successfully.
