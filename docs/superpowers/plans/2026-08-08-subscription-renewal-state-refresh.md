# Subscription renewal copy, state refresh, and zero-balance UX

## Goal

Make cancellation and resumption unambiguous across the mobile profile and website subscription dashboard, and make the displayed lifecycle state follow the authoritative provider/server state after a user returns from Apple/Google subscription management or uses the Test Store controls.

The user-visible contract is:

- An active subscription has automatic renewal on by default.
- Canceling turns automatic renewal off at the end of the already-paid period. It does not remove the current period or reset the user's current analysis balance.
- Resuming a canceled subscription turns automatic renewal back on. It does not reset, refill, or otherwise change the current analysis balance, and it does not create a new paid period immediately.
- At the paid-through timestamp, a canceled subscription becomes expired and the UI shows the ended state rather than an active/next-billing state.
- A zero remaining balance disables and grays out the mobile Record center-tab action. This remains the center action for both renewing and canceled active subscriptions; Purchase is reserved for expired or not-subscribed accounts.
- The mobile profile no longer shows the Test period ends development label.

## Root cause and architecture

The Test Store control already writes `subscription_test_scenarios`, and the server access RPC overlays that scenario onto the access snapshot. The mobile cancel/resume intent flow is intentionally removed: the website is the management surface, while the app only displays the current subscription state. The production provider path opens the provider management URL, and the AccessProvider app-resume listener must ask the provider/RevenueCat reconciliation endpoint to ingest external cancellation or uncancellation. Without that path, the Profile screen's `active`, `next billing`, and `access ends` copy can remain stale after returning from the store.

The fix keeps server authority intact:

1. Provider management still happens in Apple/Google's subscription UI.
2. The intent executor performs a best-effort snapshot refresh after the handoff opens, without reporting a false failure if the external handoff itself succeeded.
3. App resume and paid-through boundary refreshes use provider reconciliation for real stores and the server snapshot for Test Store scenarios. This prevents a Test Store simulation from being overwritten by a real-provider refresh while ensuring production changes are pulled in when the app returns.
4. The existing server state machine remains responsible for `active_cancelled`, `active_renewing`, `renewal_pending`, and `expired`; no client-only entitlement grant or analysis reset is introduced.

## Detailed file-by-file implementation

### Mobile access and lifecycle state

- `src/features/access/access-provider.tsx`
  - Add a resume/boundary refresh path that chooses `get_my_access_status()` for the sandbox Test Store and `refresh-entitlement` reconciliation for Apple/Google.
  - Use that path from the React Native `AppState` active listener so returning from external subscription management immediately reconciles provider state.
  - Use the same store-aware choice for quota-reset and paid-through timers so a canceled account transitions to expired at the server's paid-through boundary and Test Store scenarios remain authoritative.
  - Preserve identity guards, error handling, and existing bounded renewal polling.

- `src/features/billing/subscription-intent.ts` and `src/features/billing/subscription-intent.test.ts`
  - Delete the mobile cancel/resume intent implementation and its tests. Cancellation and resumption are initiated from the website/provider management surface; the app must not expose a second competing mutation path.

- `src/features/billing/subscription-intent.test.ts`
  - Add a regression assertion that a provider handoff invokes `refreshAccess` after opening the management URL.
  - Keep the existing assertion that Test Store cancellation refreshes after its control mutation.

- `src/features/access/account-access.ts`
  - Update subscription status formatting to expose the actual automatic-renewal state: on for active renewal, off for canceled/expired/no-subscription, and pending while renewal is being checked.
  - Keep the exact provider billing/access-end timestamp in the label.

- `src/features/access/account-access.test.ts`
  - Replace the current expected labels with the explicit automatic-renewal wording.
  - Cover active renewing, active canceled, expired, renewal pending, and no active subscription states.

### Mobile subscription/profile UI

- `src/app/(tabs)/(profile)/index.tsx`
  - Remove the Test Store-only `Test period ends ...` field and its formatter import.
  - Remove mobile subscription intent state, mutation callbacks, and the mobile confirmation modal. Leave Test Store controls that are explicitly for development state simulation.

- `src/screens/profile/index.tsx`
  - Remove `periodEndsLabel` from the subscription prop contract and from the Subscription section render.
  - Make the subscription row read-only: show the plan/lifecycle status, and direct users to manage billing on the Formie website instead of exposing cancel/resume controls in the app.

- `src/screens/profile/profile.test.tsx`
  - Update Test Store fixtures to omit the removed label and assert that the old Test period ends text is absent.
  - Assert that the automatic-renewal state label remains visible for active and canceled examples.

- `src/components/subscription-intent-modal.tsx`
  - Delete the mobile-only modal. The warning-first cancellation reason flow belongs to the website dialog, where the provider handoff is managed.

- `src/components/subscription-intent-modal.test.tsx`
  - Delete the mobile-only modal tests; the website dialog tests cover the user-facing confirmation contract.

- `src/components/center-tab-button.tsx`
  - Treat the `quota_exhausted` variant as disabled even when its parent does not pass a separate disabled prop.
  - Render the exhausted action with a gray circle/lens/text and disabled accessibility state, while preserving the existing gold artwork for actionable variants.

- `src/components/center-tab-button.test.tsx`
  - Replace the old pressable-exhausted expectation with a disabled, gray, non-invoking expectation.

- `src/app/(tabs)/_layout.tsx`
  - Pass the exhausted state through the disabled center-tab path.
  - Keep the center action labeled Record for active canceled accounts with zero analyses, while disabling it in gray. Keep Purchase only for expired/not-subscribed accounts.

- `src/features/access/account-access.test.ts`
  - Add a policy test that an active canceled account with zero remaining analyses still resolves to the exhausted/disabled Record entry rather than a Purchase action or a recording.

### Website subscription dashboard

- `website/app/manage-subscription/manage-subscription-client.tsx`
  - Add an explicit Automatic renewal row to Billing details, derived from the server lifecycle (`On`, `Off`, or `Checking`), rather than inferring it from a generic Active/Canceled pill.
  - Update the plan and management-card copy to state that active plans renew automatically, cancellation turns that off at period end, and resume turns it back on without changing current-period analyses.
  - Pass `paidThrough` to the web confirmation dialog.
  - Preserve the current refresh timer, Realtime refresh, Test Store simulation flow, provider handoff, and existing compact card layout.

- `website/app/manage-subscription/subscription-intent-dialog.tsx`
  - Accept an optional paid-through timestamp.
  - Update cancellation and resume confirmation copy to name automatic renewal and explicitly say the current analysis balance is not reset/refilled.
  - Keep the warning-first cancellation reason flow and provider-specific handoff explanation.

- `website/app/manage-subscription/manage-subscription.test.tsx`
  - Assert the Automatic renewal field and the new active/canceled/resume copy.
  - Add a canceled zero-balance regression assertion that no next reset is claimed and the state remains access-until-paid-through.

- `website/app/manage-subscription/subscription-intent-dialog.test.tsx`
  - Assert the confirmation dialogs expose automatic-renewal-off/on and no-reset wording.

- `website/app/globals.css`
  - No selector change is required: the new Automatic renewal value reuses the existing billing-list and status styles, so the approved dashboard layout does not shift.

### Server verification

- `supabase/functions/subscription-test-controls/index.ts` and the normalized access SQL are not changed unless a regression test demonstrates that the server snapshot fails to overlay the scenario. The current implementation already maps cancel to `active_cancelled`/`will_renew = false`, uncancel to `active_renewing`/`will_renew = true`, preserves billing dates, and transitions to expired after `billing_period_end`.
- Existing server lifecycle tests will be run to verify that cancel/uncancel preserve the paid-through timestamp and that expiry occurs at the boundary.

## Latest implementation addendum: quota meter, exact paywall geometry, and purchase confirmation

The follow-up requirements extend the same state contract. The implementation is file-specific so the UI, provider reconciliation, and deployed database wiring cannot drift apart.

### Mobile quota presentation

- `src/components/analysis-quota-bar.tsx`
  - Remove the compact `badge` variant and always render the stable-width meter.
  - Keep the live fraction on the left (`#/10`), clamp the remaining value to the configured limit, and set the fill width to the remaining percentage.
  - Preserve the progress-bar accessibility value so the visual meter and screen-reader state use the same source.

- `src/screens/home/index.tsx`
  - Give the quota container the flexible space between the Formie wordmark and settings button.
  - Render the meter without the former compact `10/10` badge so narrow phones shrink the track instead of overflowing.

- `src/components/analysis-quota-bar.test.tsx` and `src/screens/home/home.test.tsx`
  - Verify the long track exists, the left fraction is live, and zero remaining produces a zero-width fill without changing the stable track layout.

### Exact paywall image scaling

- `assets/production/paywall/reference/paywall-reference-latest.png`
  - This is the approved 853×1844 source image. The screen must render this asset rather than a recreated approximation.

- `src/screens/onboarding/premium-screen.tsx`
  - Derive image height, status mask, back hotspot, and CTA coordinates from one source-width scale. Independent horizontal and vertical scales are removed because they distort the reference image.
  - Preserve the entire source image and allow the ScrollView to provide the required vertical reach on shorter devices.
  - Keep the native CTA, back action, loading state, and sync-required retry action layered over the image so purchase functionality remains live.

- `src/screens/onboarding/approved-onboarding.test.tsx`
  - Assert the rendered image ratio equals 1844/853 and that the CTA/status coordinates use the same scale as the source artwork.

### Purchase reconciliation

- `src/features/billing/billing-provider.tsx`
  - Treat the fresh `refresh-entitlement` response as the authoritative server result for the purchase attempt.
  - Do not turn a successful server response into `sync_required` because the secondary local access refresh failed.
  - Use the purchase result product identifier when RevenueCat's customer-info envelope has not populated its subscription product yet, while still requiring both the provider entitlement and server access to be active.

- `src/features/billing/purchase-reconciliation.ts` and its test
  - Centralize the server product fallback so the purchase matching rule is deterministic and covered independently.

### Website Test Store → mobile refresh

- `src/features/access/access-provider.tsx`
  - Subscribe to `subscription_test_scenarios` in the user's existing Realtime channel in addition to entitlements and reservations.
  - Keep the bounded provider retry for real Apple/Google changes and the scenario-aware server refresh for Test Store state.

- `supabase/migrations/202608080001_test_subscription_realtime.sql`
  - Grant authenticated users read access only to their own scenario row, preserve service-controlled writes, and add the table to `supabase_realtime`.
  - This migration must be applied to the Supabase project before a deployed app can observe website Test Store cancel/resume/quota changes while open.

## Updated verification commands

```powershell
npx jest --runInBand src/screens/onboarding/approved-onboarding.test.tsx src/features/billing/purchase-reconciliation.test.ts src/components/analysis-quota-bar.test.tsx src/screens/home/home.test.tsx src/features/access/access-provider.runtime.test.tsx
npx jest --runInBand src/features/access/access-provider.test.ts src/features/access/api.test.ts src/features/access/account-access.test.ts src/screens/profile/profile.test.tsx src/components/center-tab-button.test.tsx src/features/billing/billing-provider.test.ts src/features/billing/purchase-access.test.ts src/features/billing/reconciliation-retry.test.ts src/features/billing/api.test.ts
npx tsc --noEmit
git diff --check
```

## Test-first sequence

1. Add the failing copy/state tests for mobile and website dialogs, automatic-renewal status labels, removed Test period text, and disabled exhausted center tab.
2. Add the failing provider-intent refresh assertion.
3. Implement the smallest source changes described above.
4. Run focused mobile, website, and server lifecycle tests; then run TypeScript checks and `git diff --check`.
5. Verify the local website subscription route and Metro bundle still start, while preserving the unrelated dirty onboarding changes already present in the worktree.

## Verification commands

```powershell
npx jest --runInBand src/features/access/account-access.test.ts src/features/access/access-provider.test.ts src/features/billing/subscription-intent.test.ts src/components/center-tab-button.test.tsx src/components/subscription-intent-modal.test.tsx src/screens/profile/profile.test.tsx
npm --prefix website test -- --runInBand app/manage-subscription/manage-subscription.test.tsx app/manage-subscription/subscription-intent-dialog.test.tsx
npx jest --runInBand supabase/functions/_shared/subscription-state.test.ts supabase/functions/_shared/revenuecat.test.ts supabase/functions/subscription-test-controls/handler.test.ts
npx tsc --noEmit
git diff --check
```

Execution is inline in this session; no subagents are used.
