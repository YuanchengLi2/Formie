# Apple Sandbox Cancellation and Lifecycle Implementation Plan

> **For agentic workers:** Inline execution only. The repository instructions prohibit subagents. Execute each checkbox in this Formai checkout and preserve unrelated dirty files.

**Goal:** Make Apple sandbox cancellation, period rollover, quota refill, and resubscription testable from the existing iOS development client while restoring the full mobile usage meter and avoiding a new TestFlight build.

**Architecture:** RevenueCat and the App Store remain the transaction authorities; Formie never marks a redirect or cancellation intent as a completed cancellation. Apple subscriptions are managed from the native StoreKit sheet, then the app reconciles fresh RevenueCat customer information into the Supabase entitlement ledger and reads the normalized quota snapshot. The website routes Apple sandbox users into that native flow, while production Apple/Google subscriptions continue using provider management URLs. New-period quota is derived from reservation rows scoped to the provider-confirmed period, so cancellation preserves the current balance and renewal or a post-expiry repurchase starts a fresh allowance.

**Tech Stack:** Expo SDK 54, React Native 0.81, Expo Router 6, RevenueCat `react-native-purchases` 10.6, Supabase Edge Functions/Postgres, Next.js 16.2, Jest 29, TypeScript 5.9.

---

## File map and responsibilities

- Modify `src/features/billing/types.ts`: add one platform-neutral subscription-management operation to the `PurchasesClient` contract.
- Modify `src/features/billing/purchases.native.ts`: present Apple's native subscription-management sheet on iOS; use the RevenueCat management URL on non-iOS native platforms.
- Modify `src/features/billing/purchases.web.ts`: provide an explicit unsupported implementation so universal builds satisfy the shared client contract without pretending browser code can present StoreKit UI.
- Create `src/features/billing/subscription-management.ts`: keep lifecycle-derived native management copy pure so it can be tested without loading RevenueCat native modules.
- Modify `src/features/billing/billing-provider.tsx`: expose `manageSubscription()`, serialize it with purchase operations, refresh CustomerInfo after the sheet closes, and reconcile RevenueCat plus Supabase before reporting the new lifecycle state.
- Modify `src/app/(tabs)/(profile)/index.tsx`: make the Subscription row actionable again. Active Apple subscriptions open the native management flow; expired accounts open the purchase route.
- Modify `src/screens/profile/index.tsx`: restore the accessible Manage subscription row without restoring the removed client-side cancellation mutation/modal.
- Modify `src/screens/profile/profile.test.tsx`: prove the row invokes management and that canceled/expired copy remains server-derived.
- Create `src/app/account/manage-subscription.tsx`: deep-linkable native management screen for `form://account/manage-subscription`; show provider status, open the native Apple sheet, and provide an explicit refresh action.
- Modify `src/app/_layout.tsx`: register the protected native management route for completed accounts.
- Create `src/app/account/manage-subscription.test.tsx`: prove active, canceled, and expired/resubscribe routing behavior with mocked providers.
- Modify `website/app/manage-subscription/manage-subscription-client.tsx`: distinguish Apple sandbox from production provider management, route sandbox cancel/resume to the Formie native screen, and always offer expired subscribers a Formie resubscribe link.
- Modify `website/app/manage-subscription/subscription-intent-dialog.tsx`: describe a provider handoff accurately; never say Formie itself completed an Apple cancellation.
- Modify `website/app/manage-subscription/manage-subscription.test.tsx`: cover sandbox-native handoff, production provider URL behavior, post-return refresh, and expired resubscribe.
- Modify `website/app/manage-subscription/subscription-intent-dialog.test.tsx`: cover accurate Apple handoff copy.
- Keep and verify `src/components/analysis-quota-bar.tsx` and `src/screens/home/index.tsx`: the dirty checkout already replaces Build 36's compact badge with the full stable-width `#/10` meter.
- Keep and verify `src/features/access/access-provider.tsx` and `src/features/access/api.ts`: the dirty checkout already refreshes real providers on app resume/boundaries, subscribes to entitlement changes, and retries briefly until a lifecycle snapshot changes.
- Keep and verify `supabase/functions/_shared/entitlement-ledger.ts` and `supabase/functions/revenuecat-webhook/index.ts`: the dirty checkout already allows an explicit provider snapshot to correct stale same-period event state while webhooks preserve event ordering.
- Keep and verify `supabase/migrations/202608080003_preserve_access_during_renewal_pending.sql` and `supabase/migrations/202608080004_preserve_quota_overrides_during_renewal.sql`: these migrations already expire canceled periods, preserve confirmed access during the 90-second renewal window, and calculate usage from reservations belonging to the new quota period.
- Do not modify or publish the analysis prompt for the two-finding report: production data proves the model emitted two items and the result mapper stored two; no UI truncation occurred.
- Do not run `eas build`, `eas submit`, or create any TestFlight build.

## Lifecycle contract

1. `active_renewing`: subscription management can turn automatic renewal off; current period and current quota remain unchanged.
2. `active_cancelled`: access and remaining analyses remain available until `billing_period_end`; native management can turn renewal back on without refilling the current period.
3. Boundary with `will_renew=true`: show the last confirmed access during a bounded `renewal_pending` reconciliation window, fetch RevenueCat again, then accept the new period or expire.
4. Boundary with `will_renew=false`: transition to `expired`; do not refill analyses.
5. Confirmed renewal or post-expiry purchase with a later period: compute usage only from reservations whose `period_start` and `period_end` match the new quota period, yielding the full allowance when none exist.
6. Expired resubscription: call `Purchases.purchasePackage()` through the existing paywall and require both the RevenueCat entitlement and Supabase ledger to confirm before restoring analysis access.

### Task 1: Prove the native management contract fails before implementation

**Files:**
- Modify: `src/features/billing/types.ts`
- Create: `src/features/billing/purchases.native.test.ts`
- Test: `src/screens/profile/profile.test.tsx`

- [x] Add a failing native adapter test that mocks RevenueCat, invokes subscription management, and expects the iOS `Purchases.showManageSubscriptions()` sheet rather than a browser URL.
- [x] Add a failing profile test that presses the Subscription row and expects the supplied `onManageSubscription` callback exactly once.
- [x] Run `npx jest --runInBand src/features/billing/purchases.native.test.ts src/screens/profile/profile.test.tsx`.
- [x] Confirm RED before implementation: the native management adapter did not exist and the profile row was read-only.

### Task 2: Implement native subscription management and reconciliation

**Files:**
- Modify: `src/features/billing/types.ts`
- Modify: `src/features/billing/purchases.native.ts`
- Modify: `src/features/billing/purchases.web.ts`
- Modify: `src/features/billing/billing-provider.tsx`

- [x] Add `showManageSubscriptions(): Promise<void>` to `PurchasesClient`.
- [x] On iOS call `Purchases.showManageSubscriptions()`; this uses the StoreKit sheet tied to the sandbox account used by the development client.
- [x] On Android fetch CustomerInfo, require a non-null `managementURL`, and open it with React Native `Linking`.
- [x] In the web implementation throw a clear unsupported error because the website owns its own provider handoff.
- [x] Add `manageSubscription(): Promise<void>` to `BillingContextValue`.
- [x] In `manageSubscription`, serialize the operation, configure RevenueCat for the authenticated user, present the management UI, then call the existing `syncAccess()` and passive-reconciliation completion path after the sheet closes.
- [x] Do not mutate cancellation, renewal, dates, or quota locally.
- [x] Re-run the Task 1 tests and expect GREEN.

### Task 3: Add the deep-linkable native management surface

**Files:**
- Create: `src/app/account/manage-subscription.tsx`
- Create: `src/app/account/manage-subscription.test.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/(tabs)/(profile)/index.tsx`
- Modify: `src/screens/profile/index.tsx`
- Modify: `src/screens/profile/profile.test.tsx`

- [x] Create `src/features/billing/subscription-management.ts` and tests for active renewing, active canceled, renewal-pending, and expired lifecycle copy.
- [x] Active/canceled screens show authoritative lifecycle text and a `Manage in Apple` action that calls `billing.manageSubscription()`.
- [x] The screen refreshes access after the management sheet closes and when the app returns to the foreground through the existing AccessProvider listener.
- [x] Expired accounts show `Resubscribe in Formie` and navigate to `/subscription`; they never open an obsolete management URL as if renewal were still possible.
- [x] Register `account/manage-subscription` inside the completed-account protected stack.
- [x] Restore the Settings Subscription row as an accessible button. Expired rows navigate to `/subscription`; active rows navigate to `/account/manage-subscription`.
- [x] Keep cancellation reasons and mutation modals deleted from mobile; native StoreKit is the only cancellation authority.
- [x] Run `npx jest --runInBand src/app/account/manage-subscription.test.ts src/screens/profile/profile.test.tsx` and expect GREEN.

### Task 4: Correct website sandbox handoff and resubscription

**Files:**
- Modify: `website/app/manage-subscription/manage-subscription-client.tsx`
- Modify: `website/app/manage-subscription/subscription-intent-dialog.tsx`
- Modify: `website/app/manage-subscription/manage-subscription.test.tsx`
- Modify: `website/app/manage-subscription/subscription-intent-dialog.test.tsx`

- [x] Add a pure `isAppleSandboxSubscription` predicate for `sandbox && (store === "app_store" || store === "mac_app_store")`.
- [x] For Apple sandbox cancel/resume, record the intent and open `form://account/manage-subscription`; do not navigate to the generic App Store website and do not display cancellation-confirmed copy.
- [x] For production App Store and Google Play, preserve the provider URL handoff, then rely on focus/pageshow/visibility refresh to call `account-dashboard`, which fetches RevenueCat before returning the snapshot.
- [x] Change the dialog action copy to `Continue to Apple` or `Open Formie` according to the actual destination.
- [x] In the expired gate, always render `Resubscribe in Formie` pointing to `form://subscription`, including previously subscribed accounts.
- [x] Run the website test command and confirm all 48 tests pass.

### Task 5: Verify period rollover and quota refill at the authoritative layer

**Files:**
- Test: `supabase/functions/_shared/entitlement-ledger.test.ts`
- Test: `supabase/functions/_shared/subscription-state.test.ts`
- Test: `src/features/access/access-provider.test.ts`
- Test: `src/features/access/access-provider.runtime.test.tsx`
- Test: `src/features/access/subscription-state-migration.test.ts`

- [x] Verify same-period provider cancellation changes `active_renewing` to `active_cancelled` without moving `billing_period_end` or quota.
- [x] Verify same-period uncancellation changes it back without refilling quota.
- [x] Verify a later RevenueCat renewal period advances both billing timestamps and yields a quota period with no prior committed reservations.
- [x] Verify a canceled period becomes expired after its exact boundary.
- [x] Verify a post-expiry initial purchase accepts the later period and clears stale test-only scenarios.
- [x] Run the focused lifecycle suites and expect GREEN.
- [x] Query the linked database anonymously to verify migrations `202608080001` through `202608080004` remain applied.

### Task 6: Verify the quota meter and analysis finding path

**Files:**
- Test: `src/components/analysis-quota-bar.test.tsx`
- Test: `src/screens/home/home.test.tsx`
- Verify: `supabase/functions/_shared/boundary-free-analysis.ts`
- Verify: `supabase/functions/analyze-video/index.ts`
- Verify: `src/screens/results/index.tsx`

- [x] Run quota tests proving the track exists, the fraction is visible, and width follows remaining/limit.
- [x] Confirm the shipped prompt contains the complete-recording inventory and additional-evidence-backed-issue instructions.
- [x] Confirm the latest production `analysis_draft.coachingItems`, stored `priority_corrections`, and session count all equal two; this proves no result-screen truncation.
- [x] Do not enforce an arbitrary minimum finding count, which would manufacture problems on a clean or poorly visible set.

### Task 7: Full static and regression verification

**Files:**
- Verify all modified source and test files above.

- [x] Run `npx jest --runInBand`; all 192 suites and 1,016 tests pass.
- [x] Run the website suites; all 48 tests pass.
- [x] Run `npx tsc --noEmit`.
- [x] Run the website production build.
- [x] Run `git diff --check` and inspect `git status --short` to confirm unrelated dirty files were preserved.

### Task 8: Deploy only the surfaces required for dev testing

**Files:**
- Website deployment: `website/` only if Task 4 changes.
- Supabase deployment: only billing functions whose source changed; do not redeploy analysis functions.
- Native runtime: JavaScript bundle through Metro only.

- [x] Deploy the website independently and verify Vercel deployment `dpl_2q5eVsoWV9vU3xCyZKnKD2A5RFkX` is READY, aliased to `useformie.com`, and `/manage-subscription` returns 200.
- [x] Leave the already-live server repair unchanged because no Supabase server source changed in this implementation pass.
- [x] Do not run any EAS build or submission command.

### Task 9: Start the existing development client and run the real Apple sandbox flow

**Files:**
- Runtime only; reuse the installed Formai development client.

- [x] Inspect port 8081; it was free, so no existing process was stopped.
- [x] Start `npx expo start --dev-client --tunnel --port 8081` in a hidden persistent process so the physical iPhone can connect across networks.
- [x] Verify `/status`, the iOS manifest with Expo headers, the exact HTTPS `launchAsset.url`, and HTTP 200 for the 17,844,352-byte bundle.
- [x] Confirm the bundle receives the configured RevenueCat iOS public SDK key without printing it.
- [ ] On device: open Settings > Subscription > Manage subscription, confirm Apple's native sheet shows `formie_monthly`, turn renewal off, return to Formie, and verify `active_cancelled`, unchanged paid-through date, and unchanged remaining analyses.
- [ ] Wait through or accelerate the sandbox boundary; verify canceled access becomes expired and remaining becomes zero without a refill.
- [ ] Tap `Resubscribe in Formie`; verify `Purchases.purchasePackage()` opens the Apple sandbox purchase sheet, a new provider period appears, and remaining becomes 10 before any new analysis.
- [ ] Run one analysis and verify remaining becomes 9 and the full meter updates.
- [ ] Report device-only StoreKit confirmation honestly: local tests and server rows are not substitutes for the user's physical-device tap.
