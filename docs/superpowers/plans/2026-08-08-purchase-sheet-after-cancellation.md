# Purchase Sheet After Cancellation Implementation Plan

> **For agentic workers:** Inline execution only. `AGENTS.md` forbids subagents. Execute this plan task-by-task in the current Formai checkout while preserving unrelated user changes.

**Goal:** Make the native RevenueCat purchase sheet open after a cancelled or expired subscription without weakening purchase reconciliation or risking duplicate billing.

**Architecture:** Separate passive provider observation from explicit purchase reconciliation. A pure classifier will treat Supabase `expired` and `not_subscribed` as checkout-ready, while retaining `sync_required` for unresolved server states; explicit purchase/restore flows remain strict and require both RevenueCat and Supabase confirmation.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript 5.9, RevenueCat `react-native-purchases` 10.6, Jest 29.

---

## File map

- Modify `src/features/billing/purchase-reconciliation.ts`: owns pure decisions shared by the provider and tests. Add `resolvePassiveBillingState`; do not place React state mutations here.
- Modify `src/features/billing/purchase-reconciliation.test.ts`: prove the regression and the retained pending-state behavior.
- Modify `src/features/billing/billing-provider.tsx`: consume the classifier at every passive reconciliation boundary. Keep `purchase()`, `restore()`, and `retryPurchaseSync()` strict.
- Do not modify `src/features/billing/purchases.native.ts`: its call to `Purchases.purchasePackage()` is correct.
- Do not modify `src/screens/onboarding/premium-screen.tsx`: its `Pressable` already routes ready checkout to `onPurchase`.

### Task 1: Reproduce the state-machine failure with a pure regression test

**Files:**
- Modify: `src/features/billing/purchase-reconciliation.test.ts`
- Test: `src/features/billing/purchase-reconciliation.test.ts`

- [ ] Add a test importing `resolvePassiveBillingState` and asserting these exact transitions:

```ts
expect(resolvePassiveBillingState({ providerActive: true, serverLifecycleState: "expired", offeringAvailable: true })).toBe("ready");
expect(resolvePassiveBillingState({ providerActive: true, serverLifecycleState: "not_subscribed", offeringAvailable: true })).toBe("ready");
expect(resolvePassiveBillingState({ providerActive: true, serverLifecycleState: "renewal_pending", offeringAvailable: true })).toBe("sync_required");
expect(resolvePassiveBillingState({ providerActive: true, serverLifecycleState: "unknown", offeringAvailable: true })).toBe("sync_required");
expect(resolvePassiveBillingState({ providerActive: false, serverLifecycleState: "expired", offeringAvailable: false })).toBe("failed");
```

- [ ] Run `npx jest src/features/billing/purchase-reconciliation.test.ts --runInBand`.
- [ ] Verify RED: the suite must fail because `resolvePassiveBillingState` does not exist. A syntax or fixture failure does not count.

### Task 2: Implement the passive-state classifier

**Files:**
- Modify: `src/features/billing/purchase-reconciliation.ts`
- Test: `src/features/billing/purchase-reconciliation.test.ts`

- [ ] Import `SubscriptionLifecycleState` from `src/features/access/types.ts` as a type.
- [ ] Export a `PassiveBillingState` union limited to `ready | sync_required | failed`.
- [ ] Implement the minimal classifier:

```ts
export function resolvePassiveBillingState(input: {
  providerActive: boolean;
  serverLifecycleState: SubscriptionLifecycleState;
  offeringAvailable: boolean;
}): PassiveBillingState {
  if (!input.offeringAvailable) return "failed";
  if (input.providerActive && (input.serverLifecycleState === "renewal_pending" || input.serverLifecycleState === "unknown")) {
    return "sync_required";
  }
  return "ready";
}
```

- [ ] Run `npx jest src/features/billing/purchase-reconciliation.test.ts --runInBand`.
- [ ] Verify GREEN: all purchase reconciliation tests pass.

### Task 3: Apply the classifier to every passive billing boundary

**Files:**
- Modify: `src/features/billing/billing-provider.tsx`
- Test: `src/features/billing/purchase-reconciliation.test.ts`

- [ ] Import `resolvePassiveBillingState` alongside the existing reconciliation helpers.
- [ ] Add a local `finishPassiveReconciliation(snapshot, offeringAvailable)` callback that:
  - calls the pure classifier with `snapshot.providerActive`, `serverAccess.lifecycleState`, and `offeringAvailable`;
  - sets `succeeded/active` only when both provider and server are active;
  - sets `sync_required/checking` only for `renewal_pending` or `unknown` server lifecycle states;
  - sets `ready/expired` and clears stale reconciliation errors for explicit `expired` or `not_subscribed` states;
  - never completes onboarding or grants access from provider state alone.
- [ ] In `load()`, replace the unconditional `providerActive && !serverActive` branch with the passive classifier after offerings are loaded.
- [ ] In the AppState listener and CustomerInfo update listener, call `finishPassiveReconciliation`, not the explicit-operation `finishReconciliation` function.
- [ ] In the expired-access transition effect, retain provider refresh for accurate metadata but pass its result through the passive classifier so it cannot relock checkout.
- [ ] Leave `purchase()`, `retryPurchaseSync()`, and `restore()` on `finishReconciliation`; these paths represent explicit user operations and must continue requiring server confirmation.

### Task 4: Verify code behavior

**Files:**
- Verify: `src/features/billing/purchase-reconciliation.ts`
- Verify: `src/features/billing/billing-provider.tsx`
- Verify: `src/screens/onboarding/premium-screen.tsx`

- [ ] Run `npx jest src/features/billing/purchase-reconciliation.test.ts src/features/billing/billing-provider.test.ts src/screens/onboarding/approved-onboarding.test.tsx --runInBand`.
- [ ] Expected: all suites pass; the existing test proving `onPurchasePlan("monthly")` remains green.
- [ ] Run `npx tsc --noEmit`.
- [ ] Expected: exit code 0 with no TypeScript errors.
- [ ] Run `git diff --check -- src/features/billing/purchase-reconciliation.ts src/features/billing/purchase-reconciliation.test.ts src/features/billing/billing-provider.tsx`.
- [ ] Expected: exit code 0. Line-ending warnings may be reported separately but whitespace errors must not appear.

### Task 5: Update and verify the running mobile app

**Files:**
- Runtime only; no native project changes expected.

- [ ] Resolve the current listener on port 8081 and verify it belongs to the Formai Expo process before stopping anything.
- [ ] Stop only that Formai Metro process. Preserve unrelated web and Metro servers.
- [ ] Start `npx expo start --dev-client --tunnel --port 8081` in a hidden long-lived process with project-local logs.
- [ ] Poll `http://127.0.0.1:8081/status` until it returns `packager-status:running`.
- [ ] Fetch the iOS manifest with `expo-platform: ios`, `expo-protocol-version: 1`, and `expo-runtime-version: exposdk:54.0.0`; verify the referenced `launchAsset.url` returns HTTP 200.
- [ ] Ask for one device tap on Buy while monitoring the Metro log. Success requires a RevenueCat purchase operation/native sheet path; repeated CustomerInfo reads alone are a failure and require returning to diagnosis.

No commit is included because the user requested implementation and a running app update, not a source-control commit.
