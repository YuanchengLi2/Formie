# App-only subscription management and Settings policy links

Date: 2026-08-10

## Outcome

Formie will remove its website subscription portal completely. Subscription status and provider management will remain available only inside the native app. The native screen will open Apple or the appropriate store without being blocked by background entitlement reconciliation, and Formie will refresh subscription state automatically after the store UI closes, on app resume, at billing boundaries, and through existing realtime updates. There will be no manual "Refresh subscription status" control.

The Settings screen will replace promotional support and privacy summary rows with direct actions: Get Help, Privacy Policy, and Retention Policy. The website will publish a separate retention policy grounded in the behavior the code actually implements.

## Confirmed current-state evidence

- The website currently exposes `/manage-subscription`, a navigation link, OAuth callback code, Supabase browser/server clients, dashboard fetching, cancellation UI, and portal-only styles.
- The app already has the native route `src/app/account/manage-subscription.tsx` and uses RevenueCat's `Purchases.showManageSubscriptions()` on iOS.
- `BillingProvider.manageSubscription()` currently returns silently while billing state is `purchasing`, `reconciling`, or `restoring`. This couples presentation of Apple's sheet to unrelated background reconciliation and explains a tap that can appear to do nothing.
- The native route currently waits for store management, then explicitly calls `access.refresh()`, and also exposes a second manual refresh button. This duplicates the existing automatic mechanisms in `AccessProvider`.
- `AccessProvider` already refreshes on authentication, app resume, Supabase realtime events, exact `paidThrough` and quota-reset boundaries, and renewal-pending retry intervals. The manual button is therefore not the source of truth and can be removed.
- The named account is not stale. Its earlier sandbox period expired, then a new Apple sandbox purchase began at 2026-08-10 02:34:50 UTC (2026-08-09 10:34:50 PM Eastern) and ends at 2026-08-11 02:34:50 UTC (2026-08-10 10:34:50 PM Eastern). No account row or test-scenario override needs repair.
- The new five-minute sandbox renewal setting belongs to the newly created Sandbox Apple Account. Apple does not retroactively apply that cadence to a purchase made by a different sandbox account.
- The website has `/privacy` and `/terms`, but no standalone `/retention` page.
- The app's current statement that analysis uploads are removed immediately after processing is not supported by the retention implementation. The backend supports a 30-day cleanup only for users whose profile has `video_retention_days = 30` and a retention effective timestamp; it applies only to analyses created after that timestamp.

## Architecture and behavior

### 1. Delete website subscription management

The public site will have no subscription dashboard, sign-in flow, cancellation form, app deep-link handoff, or Manage Subscription navigation item. `/manage-subscription` will cease to exist and return the normal Next.js 404 response. It will not redirect and will not be replaced with an "Open Formie" page.

Portal-only source will be removed instead of hidden:

- Delete `website/app/manage-subscription/page.tsx`, `manage-subscription-client.tsx`, `subscription-intent-dialog.tsx`, and their tests.
- Delete the portal-only website OAuth callback under `website/app/auth/callback/`.
- Delete `website/lib/oauth-redirect.ts` and its test.
- Delete `website/lib/account-dashboard.ts` and its test.
- Delete portal-only Supabase browser/server/route client modules and their tests after confirming no remaining import consumes them.
- Delete `website/components/account-portal-shell.tsx` if it has no non-portal consumer.
- Remove account-portal, dashboard, usage, billing, and subscription-dialog CSS from `website/app/globals.css`; keep shared legal/support/landing styles.
- Remove the Manage Subscription item from `website/components/site-shell.tsx` and change the narrow navigation grid from four columns to three.
- Update `website/app/page.test.tsx` to require that the homepage has no Manage Subscription link and that the remaining navigation is How it works, Coaching, and Pricing.

Historical Supabase migrations and the deployed authenticated `account-dashboard` Edge Function are not part of the public website surface and will not be destructively removed in this change. They may remain for auditability and rollback safety, but no shipped website code will invoke them.

### 2. Make native Apple management independent of reconciliation

`src/features/billing/billing-provider.tsx` will separate "present the provider management UI" from "reconcile entitlement state." Presenting the Apple sheet must not be blocked merely because an automatic access check is already running.

The native flow will be:

1. The route prevents duplicate taps with its own local `manage` operation state.
2. Billing configuration is ensured.
3. `purchasesClient.showManageSubscriptions()` presents Apple's native sheet immediately.
4. When the sheet closes, provider reconciliation starts automatically. Reconciliation errors update background billing state but do not turn a successfully opened Apple sheet into a misleading "could not connect" result.
5. If Apple itself fails to present the sheet, the route shows a specific retryable Apple-management error. The failure will not be swallowed and will not be replaced by a generic refresh failure.

`src/features/billing/purchases.native.ts` remains the native boundary: iOS uses `Purchases.showManageSubscriptions()` and other platforms use the RevenueCat management URL. A fallback to the ordinary production App Store subscriptions URL will not be used for an Apple sandbox purchase because that URL can show the device's production Apple ID instead of the Sandbox Apple Account.

Tests will cover that a background `reconciling` state does not suppress store presentation, iOS still calls the native RevenueCat method, and a presentation error remains distinct from a later reconciliation error.

### 3. Remove manual refresh and rely on automatic synchronization

`src/app/account/manage-subscription.tsx` will remove:

- the `refresh` busy variant;
- the manual refresh function;
- the "Refresh subscription status" button;
- refresh-success text such as "Subscription status refreshed."

The screen will keep the current plan, lifecycle copy, analysis balance, and one provider-management button. It will render the latest `AccessProvider` state and show only actionable provider-presentation failures.

No new polling loop will be added to the screen. Automatic synchronization remains centralized in `src/features/access/access-provider.tsx`, which already owns app-resume refresh, realtime refresh, exact boundary timers, and renewal-pending reconciliation. Focused tests will lock in those mechanisms and ensure the screen contains no manual refresh action.

### 4. Restructure Settings support and policy links

`src/screens/profile/index.tsx` will make these visible changes:

- Replace the non-actionable "Premium support" row and separate "Send Feedback" text with one accessible, pressable "Get Help" row that opens the existing in-app feedback route.
- Remove the two informational rows under "Privacy and retention."
- Add two accessible policy links: "Privacy Policy" and "Retention Policy."
- Keep "Terms of Use" in the Legal section without duplicating Privacy Policy there.
- Position the subscription chevron at the top-right of the subscription row, aligned with the plan title rather than vertically centered beside the state text.

`src/app/(tabs)/(profile)/index.tsx` will pass the retention URL and continue routing Get Help to `/account/send-feedback`. `src/features/auth/legal-config.ts` will add a validated `retentionUrl` with the default `https://useformie.com/retention`. Its tests will cover URL parsing and defaults.

`src/screens/profile/profile.test.tsx` will verify the new labels, link destinations, absence of Premium support and the old privacy-summary claims, Get Help navigation, and the subscription chevron layout contract.

### 5. Publish accurate website policies

Add `website/app/retention/page.tsx` using the existing `LegalPage` component. The policy will state, in plain language:

- what account, analysis, local recording, uploaded recording, derived artifact, feedback, billing, and security-log data exists;
- that uploads are private and access-controlled, not public or sold;
- that the implemented 30-day cleanup applies only when the account has that retention setting and only to analyses created after the setting's effective timestamp;
- that deletion removes the eligible analysis session and associated stored video/artifact paths;
- that local device copies follow device/app storage behavior and are not deleted by a server cleanup;
- that billing/provider records, fraud/security records, backups, and legally required records may follow different retention periods;
- how to request account-data help through support.

Update `website/app/privacy/page.tsx` to remove the inaccurate immediate-deletion implication, summarize privacy handling, and link to `/retention` for timing details. Update `website/app/terms/page.tsx` so subscription management is described as app-only and it no longer refers to a website dashboard. Add Retention to the website footer.

Website tests will render the privacy and retention pages and assert the core claims, contact route, updated date, and absence of the removed dashboard language.

The policy text is a product draft based on implemented behavior, not legal advice. It must not promise deletion behavior the backend does not perform.

## Error handling

- A store-sheet presentation failure is shown locally on the native subscription screen with a retry action.
- Background refresh errors remain inside the access/billing providers and do not add a manual status control or remove the last confirmed access snapshot.
- Renewal-pending behavior preserves the last confirmed active access until RevenueCat or the webhook ledger confirms the next state.
- Website policy links use validated HTTP(S) URLs; a missing optional retention URL falls back to the production Formie URL in the same way as Terms and Privacy.
- The removed website route intentionally returns 404; this is the requested behavior, not an error fallback.

## Test-first implementation sequence

1. Add failing website tests requiring the Manage Subscription link and route modules to be absent, and requiring the retention page and updated legal copy.
2. Remove the website portal and add the retention page until those tests pass.
3. Add failing native billing tests proving store presentation is not suppressed by reconciliation and that presentation and reconciliation failures are separated.
4. Change the billing-provider flow until those tests pass.
5. Add a failing native route/source test requiring no manual refresh control; simplify the native subscription route until it passes.
6. Add failing Settings and legal-config tests for Get Help, policy links, the top-right chevron, and the retention URL; implement those UI/config changes.
7. Run focused tests after each red/green cycle, then run the full app Jest suite, TypeScript, Expo lint, website tests, website TypeScript, website lint, and website production build.

## Release and runtime verification

- Commit only the files in this design plus the already present test-relocation changes after reviewing their provenance; do not stage `.codex-tmp/` or generated `website/tsconfig.tsbuildinfo`.
- Push the existing `codex/ios-3d-tracking-scoring` branch.
- Deploy `website/` to the existing Vercel `useformie` project.
- Verify `https://useformie.com/` is 200, `/privacy` is 200, `/retention` is 200, `/terms` is 200, and `/manage-subscription` is 404. Verify the homepage source contains no Manage Subscription navigation.
- Restart only the Formie Expo dev-client tunnel on port 8081, preserving unrelated processes, then verify Metro status, iOS manifest, and launch bundle.
- Do not create or submit a TestFlight build.
- On the physical iPhone, verify Settings -> Subscription opens the native Apple sheet, closing it returns to Formie, state refreshes without a manual button, Get Help opens feedback, and both policy links open the live website pages.

## Account-specific acceptance result

No database mutation will be made for `yuanchengli612@gmail.com`. The current entitlement is an active, renewing Apple sandbox monthly subscription with a paid-through time of 2026-08-11 02:34:50 UTC. The app should change this account only when Apple/RevenueCat reports a cancellation, renewal, or expiration. To test five-minute periods, the device must make a fresh purchase while signed into the newly configured five-minute Sandbox Apple Account; changing a different tester's renewal rate does not alter this existing transaction.
