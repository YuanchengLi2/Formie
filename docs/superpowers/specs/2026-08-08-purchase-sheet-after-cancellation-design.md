# Purchase Sheet After Cancellation Design

## Problem

After a Test Store cancellation, Supabase correctly reports the account as `expired`, but RevenueCat can temporarily retain an active simulated entitlement. `BillingProvider` currently treats every `providerActive && !serverActive` snapshot as `sync_required`. The paywall then routes its CTA to `retryPurchaseSync()` instead of `purchase()`, so `Purchases.purchasePackage()` is never invoked and no native purchase sheet appears.

Runtime evidence supports this path: tapping the CTA produced repeated RevenueCat CustomerInfo reads without a purchase operation, while the monthly offering remained available.

## Desired behavior

- An authoritative server lifecycle of `expired` or `not_subscribed` must leave checkout ready, even when passive RevenueCat state is stale.
- `renewal_pending` and `unknown` remain reconciliation states when RevenueCat reports active access.
- Once an explicit purchase or restore begins, existing two-sided RevenueCat/Supabase reconciliation remains unchanged; access is granted only when both sides confirm it.
- The paywall CTA and artwork remain unchanged. The correction belongs in billing state classification, not in an extra button handler.

## Architecture

Add a pure passive-state classifier to the existing purchase reconciliation module. `BillingProvider` will use it for initial load and passive SDK updates. Explicit purchase, restore, and retry flows continue using `finishReconciliation`, preserving duplicate-charge protection and post-purchase synchronization.

## Files

- `src/features/billing/purchase-reconciliation.ts`: define the passive billing-state classifier from provider activity, authoritative server lifecycle, and offering availability.
- `src/features/billing/purchase-reconciliation.test.ts`: cover cancelled/expired checkout readiness and genuine pending reconciliation before production code changes.
- `src/features/billing/billing-provider.tsx`: route initial loading, app-resume reconciliation, CustomerInfo listeners, and access transitions through the passive classifier. Do not change `purchases.native.ts` or the paywall CTA.

## Validation

Run focused billing tests, the paywall interaction suite, TypeScript, and the relevant billing/access suite. Restart only Formai Metro on port 8081. Confirm `/status`, the iOS manifest, and its launch asset. On the next device tap, the RevenueCat log must show a purchase operation rather than only CustomerInfo reads.
