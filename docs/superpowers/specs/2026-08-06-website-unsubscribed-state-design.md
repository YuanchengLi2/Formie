# Website Unsubscribed State Design

## Problem

Apple and Google OAuth are completing in production, but accounts without a currently manageable RevenueCat subscription fall into the same `expired` state as previously subscribed accounts. The website then has no meaningful management action, which makes a successful sign-in look like the provider button failed.

## Design

RevenueCat subscription resolution will expose a first-class `not_subscribed` state only when the subscriber has neither subscription history nor entitlement history. A historical subscription remains `expired`, preserving its store-specific renewal path. Missing or malformed provider data remains an operational error rather than being mislabeled as either state.

The authenticated website portal will render `not_subscribed` as a dedicated error/empty state. It will explain that subscriptions must be started in the Formie iPhone app, that this website manages an existing Apple or Google subscription, and that the user should return with the same social account after purchasing. The state will include the configured App Store link and Log Out, but it will not show quota, cancellation, renewal, or deletion controls as though a plan existed.

Google and Apple continue through the same PKCE callback and cookie-backed Supabase session. No provider-specific workaround will be added because production authentication records show both providers successfully signing in; the corrected post-login subscription state is the shared underlying repair.

## Data Contract

`subscription.state` becomes:

```ts
"active_renewing" | "active_cancelled" | "expired" | "legacy" | "not_subscribed"
```

For `not_subscribed`, product, store, dates, and management URLs are `null`, and `sandbox` is `false`.

## Verification

Tests will prove that an empty RevenueCat customer resolves to `not_subscribed`, a historical expired customer remains `expired`, the Edge Function returns the new state, the website DTO accepts it, and the portal displays explanatory copy plus the App Store action without subscription-management controls. Existing OAuth, active, cancelled, and expired tests must remain green.
