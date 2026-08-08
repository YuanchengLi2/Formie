# Formie onboarding and RevenueCat release setup

The approved onboarding and social-auth flow is wired to RevenueCat. The local Chrome sandbox uses RevenueCat Test Store, so it can exercise offer loading, the purchase modal, entitlement sync, restore, logout, and login without charging money. Production purchases still require the store and RevenueCat records below. The app intentionally disables an authenticated `Go Now` button when RevenueCat has not returned a live package; it never charges a stale hard-coded price.

## Current sandbox configuration

- RevenueCat project: `Form Ai`.
- RevenueCat app: `Test Store` only (no real App Store or Google Play app configuration yet).
- Offering: `default` with `$rc_monthly` for the current monthly Test Store product and `$rc_annual` for Test Store product `yearly`.
- Entitlement: `formie_pro`.
- Test Store keys are loaded only from the ignored local `.env.local` file. Never submit a build containing a `test_` key; Test Store is for development QA only.

The Chrome preview is started with `npm run web -- --port 8082`. A sandbox purchase creates a Test Store receipt, and the Supabase `refresh-entitlement` function reads the RevenueCat subscriber using the server secret before the app grants access. Test Store values must remain limited to the EAS `development` environment; they must never be copied into `preview` or `production`.

## RevenueCat dashboard

1. Create or select the iOS and Android apps for bundle/package `app.form.coach`.
2. Connect monthly `formie_monthly` at $9.99 and annual `formie_yearly` at $99.99 as auto-renewable products in the same subscription group.
3. Create entitlement `formie_pro` and attach both products to it. Configure the current Test Store monthly product as `$rc_monthly` and existing Test Store product `yearly` as `$rc_annual`.
4. Create the current offering. The default offering is accepted when `EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default`; if a named offering is used, set that identifier in the Expo environment.
5. Configure sandbox testers and verify both purchase and restore on iOS and Android development builds.

## Environment values

Set the following in the Expo build environment (never commit real values):

- `EXPO_PUBLIC_REVENUECAT_IOS_PUBLIC_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_PUBLIC_KEY`
- `EXPO_PUBLIC_REVENUECAT_WEB_PUBLIC_KEY` (web/Test Store preview only)
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=formie_pro`
- `EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID=formie_monthly`
- `EXPO_PUBLIC_REVENUECAT_YEARLY_PRODUCT_ID=formie_yearly`
- `EXPO_PUBLIC_REVENUECAT_PRODUCT_ID=formie_monthly` (temporary monthly fallback)
- `EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default` (or the named offering)

Set the platform public keys separately in all three EAS environments. The profile-to-environment mapping is explicit in `eas.json`:

```powershell
eas env:create --environment development --name EXPO_PUBLIC_REVENUECAT_IOS_PUBLIC_KEY --value <test-store-ios-public-key> --visibility sensitive
eas env:create --environment development --name EXPO_PUBLIC_REVENUECAT_ANDROID_PUBLIC_KEY --value <test-store-android-public-key> --visibility sensitive
eas env:create --environment preview --name EXPO_PUBLIC_REVENUECAT_IOS_PUBLIC_KEY --value <app-store-ios-public-key> --visibility sensitive
eas env:create --environment preview --name EXPO_PUBLIC_REVENUECAT_ANDROID_PUBLIC_KEY --value <play-store-android-public-key> --visibility sensitive
eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_IOS_PUBLIC_KEY --value <app-store-ios-public-key> --visibility sensitive
eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_ANDROID_PUBLIC_KEY --value <play-store-android-public-key> --visibility sensitive
eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID --value formie_pro --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_PRODUCT_ID --value formie_monthly --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_OFFERING_ID --value default --visibility plaintext
```

Use `eas env:list --environment <development|preview|production>` to confirm variable names without printing values. Do not use the local `test_` values for a store build.

Set these as Supabase Edge Function secrets:

- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_ENTITLEMENT_ID=formie_pro`
- `RECONCILE_ENTITLEMENTS_SECRET`

The client uses the Supabase user UUID as the RevenueCat app user ID. The server fetches the subscriber directly from RevenueCat, so a client cannot grant itself access by editing local state or sending a fake entitlement.

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the verified public `NEXT_PUBLIC_APP_STORE_URL` in the Vercel `website/` project. Never expose a service-role key or RevenueCat secret in a public website variable. Website OAuth returns through `https://useformie.com/auth/callback`; local website OAuth uses `http://localhost:3000/auth/callback`; native OAuth retains `form://auth/callback`. Supabase PKCE codes are single-use, so the native auth browser owns normal callbacks and initial-URL handling is cold-start recovery only.

## Supabase rollout

Apply the existing subscription launch migrations followed by `202608070001_subscription_state_machine_and_plan_quota.sql`, then deploy `revenuecat-webhook`, `refresh-entitlement`, `reconcile-entitlements`, `cancel-analysis`, `account-dashboard`, and `subscription-test-controls`. The migration installs the product catalog, normalized lifecycle ledger, monthly quota resolver, one-live-analysis reservation enforcement, and service-role-only development simulations. Do not manually rewrite entitlement rows from a client.

```sql
select enforcement_enabled, activated_at
from public.subscription_launch_config
where id = true;
```

Confirm the query returns `enforcement_enabled = true` and a non-null activation timestamp. Schedule `reconcile-entitlements` with the `x-cron-secret` header. Reconciliation uses the same expiry-aware entitlement mapping as login refresh and releases reservations that have been abandoned for more than two hours.

There are two intentionally separate synchronization paths:

- Authenticated app boundary checks invoke `refresh-entitlement` with the current Supabase access token. This path is used at quota reset and paid-through timestamps, during bounded renewal-pending verification, and after a purchase or restore.
- Scheduled maintenance invokes `reconcile-entitlements` with `x-cron-secret`. This endpoint is cron-only and must never be called by a mobile or website client.

Both paths normalize the provider result into the same entitlement-ledger snapshot. Persistence compares lifecycle, entitlement, product, plan, store, sandbox and renewal flags, paid-through/billing timestamps, and quota-driving period timestamps before writing. An identical provider read returns the existing row without an update or `state_version` increment. Only a meaningful lifecycle or billing-period change advances `state_version`, so dashboard reads cannot create their own Realtime invalidation loop. Webhook event metadata and stale-period protection remain authoritative.

The Supabase production Auth Site URL must be `https://useformie.com`; retain `form://auth/callback` and the explicitly documented localhost development patterns in the redirect allowlist. The repository `supabase/config.toml` contains that intended configuration, but the hosted project still requires a dashboard/config push and a live OAuth callback check.

In RevenueCat production, create the real App Store and Google Play apps for bundle/package `app.form.coach`, attach both `formie_monthly` and `formie_yearly` to `formie_pro`, place them in the same subscription group, and make `$rc_monthly` and `$rc_annual` available in the default offering before building a store-compatible client.

RevenueCat Test Store timing is provider-controlled: a simulated monthly product renews about every five minutes and stops after roughly 25 minutes. It cannot be changed to an exact 20-minute subscription. Test Store also has no end-user subscription management page. With `SUBSCRIPTION_TEST_CONTROLS_ENABLED=true`, the development-only Settings panel can cancel at period end, undo cancellation, renew, expire, start a new period, advance the annual five-minute quota month, or clear the simulation. These controls require an authenticated Test Store/sandbox entitlement and never mutate a receipt or run for production subscriptions. Settings and subscription surfaces show the exact simulated cutoff time in the device/browser local time zone. Undoing cancellation restores automatic renewal only; it does not replenish the current allowance.

Annual production subscriptions bill once per year but receive a fresh 10-analysis quota on each purchase-anniversary month. Purchase dates on the 29th–31st clamp only for shorter months without moving the original anchor. Annual Test Store subscriptions use five-minute quota subperiods inside the provider's simulated year. Quota never carries over.

## Device QA

- Fresh signed-out user: screens 1–4 are visible without an account; the local preview never calls an AI model.
- `Go Now`: opens login/signup, then returns to the paywall after authentication. A successful purchase marks onboarding complete and routes to the app without logging out.
- Relaunch and foreground: the Supabase access RPC and RevenueCat refresh restore the session and entitlement.
- Restore: an existing store subscription reopens the app without showing login again.
- Quota: ten analyses are allowed per monthly quota period on both plans; active reservations count immediately, retries are idempotent, failed/unable sessions release their reservation, and reanalysis consumes the same quota. Unused analyses never carry over.
- Quota exhaustion keeps the account signed in and saved results readable. Renewing users see when the next allowance begins. Canceled users see their exact access-end time and are never told the exhausted allowance resets on that date.
- Cancellation preserves analysis access through the paid-through timestamp. Undo cancellation changes only the next renewal instruction and preserves the current period and used balance; a verified new quota period replenishes the balance to 10.
- Canceled plus exhausted remains `0/10` through the current period. Record opens the state-aware subscription path; Resume does not grant analyses.
- Renewal pending keeps the authenticated account available while `refresh-entitlement` verifies the provider. The UI does not promise a charge, renewal, or allowance until verification succeeds.
- Expiration keeps the completed account signed in with Home, Settings, and saved results available. Record opens the native monthly/annual repurchase paywall, while the website shows the repurchase panel and Open Formie action.
- A successful repurchase must be confirmed as a new paid period before access and the allowance change. Account authentication is never treated as proof of subscription entitlement.
- Provider/network errors preserve the session and never impersonate expiration.
- Expired account: refresh and scheduled reconciliation persist `expired` even when RevenueCat still returns the historical entitlement object with an ended expiration date.
- Coaching: malformed or unavailable writer prose falls back to the validated full-video analyst result; zero supported corrections is valid and is not a refusal.

Real purchases require an iOS/Android development or release build containing `react-native-purchases`; Expo Go can render the screens but cannot complete a real store transaction.

## Website account portal

`/manage-subscription` calls the authenticated `account-dashboard` function with the caller session. It returns only the account identity, monthly usage summary, and normalized subscription state. The dashboard uses a horizontal `remaining/limit` gauge and local date, time, and time-zone abbreviation. Renewing subscribers see next billing and quota reset separately. Canceled subscribers retain access through the paid-through timestamp, see no reset claim, and receive Resume as the primary action with store billing as a secondary action when available. Renewal-pending users see verification copy without an assumed refill. Expired and never-subscribed users see monthly/annual repurchase information and must complete purchase through the native Formie paywall.

Account deletion is not exposed through the website portal or an Edge Function. Subscription cancellation never deletes the Formie account or its saved results.

## Release build sequence

1. Verify RevenueCat App Store/Google Play products and the production offering.
2. Set the real platform public keys in EAS `preview` and `production`; keep Test Store keys in `development` only.
3. Apply and verify the Supabase migrations/functions and hosted Auth redirect configuration.
4. Build with `eas build --profile preview --platform ios` (and Android), install on physical devices, and test OAuth, purchase, restore, cancellation, logout, and expiry.
5. Build/submit the production-compatible artifact only after both store configurations and the physical-device flows pass. A local Metro run or a passing Jest suite is not a substitute for this build.
## Onboarding acquisition reporting

The approved onboarding flow includes a required `acquisition-source` step immediately after the custom milestone. The app sends only `source`, optional `other_detail`, device platform, and onboarding version to `record_onboarding_acquisition` after authentication. Email, body measurements, goals, and coaching data are not included.

`public.onboarding_acquisition_responses` is the durable source of truth. Each user has one immutable, first-write-wins response. Direct client table access is disabled; authenticated clients can use only the validation RPC. The `onboarding_acquisition_summary` view is restricted to the service role.

The `sync-acquisition-sheet` Edge Function exports these columns to a worksheet tab named `Acquisition`:

`response_id`, `created_at`, `user_id`, `source`, `other_detail`, `platform`, `onboarding_version`

Create that header row, share the spreadsheet with the service-account email as an editor, and set these Supabase function secrets:

```text
GOOGLE_SHEETS_CLIENT_EMAIL
GOOGLE_SHEETS_PRIVATE_KEY
GOOGLE_SHEETS_SPREADSHEET_ID
```

Never expose the service-account private key through an Expo public variable or website variable. If Sheets is not configured or Google is temporarily unavailable, onboarding still completes after the Supabase write and the response remains queued. The exporter deduplicates on `response_id` and retries pending or stale claims on a later authenticated invocation.
