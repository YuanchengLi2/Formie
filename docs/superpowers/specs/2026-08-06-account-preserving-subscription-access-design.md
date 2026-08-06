# Account-Preserving Subscription Access Design

## Product decision

Formie keeps the existing automatically renewing monthly subscription: the live RevenueCat localized monthly price includes ten analyses per billing period. Subscription state controls whether a user may create a new analysis; it does not control access to a completed Formie account.

A completed user may always open Home, Coach, Progress, Settings, and saved analysis results after authentication. Cancelling renewal preserves analysis access through the store-provided paid-through timestamp. Once that period expires, the user retains account and saved-result access, but cannot record or submit another analysis until a native in-app purchase restores the entitlement.

New users still complete onboarding, authenticate, synchronize the approved profile, and purchase the initial subscription before entering the completed account. This prevents an OAuth-only identity or an incomplete onboarding profile from bypassing the initial purchase.

## Mobile navigation and access

`src/features/auth/launch-route.ts` owns launch destinations. An approved, profile-complete account with onboarding state `complete` routes to Home for `active`, `legacy_unlimited`, `expired`, and `unknown` access states. A newly onboarded `premium_required` account routes to `/subscription` unless active or legacy access is already confirmed. Subscription expiration is never a logout reason and never leaves a completed account without a route.

`src/app/_layout.tsx` mirrors the same rule in Expo Router guards. Completed accounts are admitted to the application stack independently of entitlement. The subscription route remains restricted to profile-complete users who either still require their first purchase or explicitly navigate there to repurchase. A small pure policy module in `src/features/access/account-access.ts` keeps the launch guard and Record-button decision consistent and testable.

`src/app/index.tsx` removes the expired-session terminator and all billing-reconciliation loading gates. It waits only for authentication, onboarding hydration, and the profile decision needed to choose a route. Network or provider failures therefore degrade analysis creation to unavailable without blocking the saved account.

## Analysis creation and repurchase

The center tab action has four states:

1. `active` or `legacy_unlimited` with `canAnalyze=true`: label **Record** and open exercise selection.
2. Active with no remaining quota: label **Record** and show the existing reset-date quota message.
3. `expired`: label **Purchase subscription** and open `/subscription` inside the authenticated app.
4. `unknown`, loading, or provider error: label **Record** and show a retryable access-check message rather than starting a recording.

`src/app/subscription.tsx` is reusable for both initial purchase and an expired completed account. Purchase or restore refreshes the server ledger and returns to Home. Back navigation remains available for a completed account, while the new-user initial paywall remains mandatory. The existing reservation and Edge Function authorization continue requiring active access and remaining quota, so changing navigation cannot bypass billing.

## Home analysis balance

`src/app/(tabs)/(home)/index.tsx` passes the current access state into `src/screens/home/index.tsx`. The Home header shows a compact top-right balance beside the Settings control: a numeric form such as **8 analyses left**, **Unlimited** for legacy access, **0 analyses left** for expired access, and **Checking analyses** while unresolved. It appears only on Home and remains readable on narrow devices.

## Website portal

The signed-out Manage Subscription page retains recognizable Apple and Google provider icons. Status popups never show the App Store download badge.

The authenticated dashboard is available only for `active_renewing`, `active_cancelled`, and `legacy` subscription states. Active renewing users receive the store-owned cancellation link. Cancelled-but-paid-through users see the access-end date and a store management/resubscribe link when RevenueCat provides one. `expired` and `not_subscribed` states receive a blocking popup explaining that subscription purchase must be completed in the Formie app; the dashboard itself remains hidden.

Account deletion is removed from the website UI, client invocation, CSS, legal copy, Supabase Function registration, deployment documentation, and the `delete-account` Function implementation/tests. This removes the publicly exposed self-service deletion path without deleting any existing user data.

## Backend and lifecycle

RevenueCat and the access ledger remain authoritative for subscription and quota. `active_cancelled` remains active until `paidThrough`; reconciliation persists `expired` only after that time. Expiry stops new reservations but does not sign out Supabase, clear local data, delete user data, or mark onboarding logged out.

The account-dashboard Function continues returning the normalized subscription state. The website uses that state to either render management controls or the inactive-subscription popup. Provider/network failures remain errors and are never converted to expiration.

## Verification

Tests cover launch routing for expired/unknown completed accounts, router admission, Record-versus-purchase decisions, Home balance rendering, initial purchase versus repurchase, provider failure, website popup icon removal, dashboard gating, cancellation/resubscribe actions, and absence of account deletion. Focused Jest and website tests run before TypeScript, lint, and production builds. Finally, the website is deployed and checked live, Metro is restarted with cache clearing, the device-facing bundle is verified for the new markers, and the connected app is reloaded.
