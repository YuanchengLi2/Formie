# Formie business data verification

## Source ownership

The founder and creator dashboards read bounded reporting RPCs. They do not download full operational tables into Next.js. The founder RPC runs through the service role after founder email authentication. The creator RPC derives the creator tenant from the authenticated membership; no request parameter selects another creator.

| Source | Authoritative records | Coverage check |
|---|---|---|
| Accounts and onboarding | Auth users, profiles, onboarding snapshots | Onboarding snapshot coverage |
| Product activity | Product events, analysis attempts, saved feedback | Durable analytics coverage |
| Referral attribution | Code validation visits and account referrals | Validated, claimed, pending, and expired reconcile separately |
| Subscription access | Entitlements and normalized transactions | Pending projections and unresolved ownership are zero |
| AI cost | Model telemetry joined to exact analysis attempts | Every priced call has usage and a pricing version |
| Final proceeds | Apple imports, report lines, and allocations | The report is reconciled and compatible buckets have no discrepancy |
| Creator payout | Commission entries, payout batches, and payout items | Every paid batch has an external reference and exact items |

## Verification procedure

1. Confirm the local project reference and compare the local and hosted Supabase migration lists.
2. Run the Supabase database push dry run with all migrations. Resolve migration order or authentication problems before applying anything.
3. Start the local stack, reset the local database, then run all database tests. The referral, bonus, finance, reporting, subscription, onboarding, deletion, and RLS suites must pass.
4. Run the root typecheck, release-critical tests, referral tests, and lint.
5. In the website directory, run its typecheck, tests, lint, production build, and Playwright dashboard suite.
6. Apply migrations to the linked project. Deploy the referral context, product analytics, RevenueCat webhook, entitlement refresh and reconciliation, account dashboard, analysis creation and reanalysis, and analysis worker functions from the same commit.
7. Verify server configuration: RevenueCat webhook and history credentials, receipt and analytics salts, `REFERRAL_ENVIRONMENT=production`, report bucket, Supabase service role, and founder allowlist.
8. Create a real internal creator, choose Affiliated creator on a fresh signed-out onboarding attempt, enter the production creator code, and confirm the server-derived creator label appears.
9. Create a new account and verify one locked account referral and rate version with no raw code or token stored on the attribution row. Attempt another code after authentication and confirm attribution does not change.
10. Complete a sandbox purchase only for sandbox flow testing. Production financial acceptance requires a real production first payment, transaction projection, three-unit grant, 13-credit effective first period, base-first consumption, one commission accrual, and no renewal accrual.
11. Test a valid refund and revocation and a verified reversal against the same transaction and grant. Confirm unused bonus holds cannot be committed by a delayed worker.
12. Load all four founder pages and all creator pages. Confirm true zeros appear only with complete coverage, missing sources show alerts, privacy suppression hides groups under five, and native currencies remain separate.

## Metric checks

- DAU, WAU, and MAU use identified foreground sessions plus authoritative product activity.
- Subscription conversion uses signup cohorts mature for 30 days; observed-to-date conversion is separate.
- D1, D7, and D30 use America/New_York calendar days and mature cohorts.
- Completed analyses come from immutable attempt outcomes, with reanalysis recorded as a separate kind.
- Contribution equals net proceeds minus creator commission expense minus all tracked AI cost. Bonus AI cost is a subset and is not subtracted twice.
- Expired unclaimed validations are valid code claims that reached expiry without account attribution. Pending validations under 30 days are separate.
- Final creator proceeds are labeled reconciled allocations with report period and method.

Record the release commit, migration list, deployed Edge Function versions, dashboard observation dates, production creator-code test build, RevenueCat event IDs, Apple fiscal report import ID, and TestFlight build evidence. Migration parity alone does not prove Edge Function parity, and a TestFlight upload does not prove App Store Review submission.

`ANALYTICS_IP_HASH_SALT` is required by `record-product-analytics`; a missing value makes the endpoint return `ANALYTICS_INGEST_FAILED`. Verify it with an anonymous event, resend the same event ID, and confirm one stored row before enabling reporting alerts. Never print the salt value.

Referral rollout has two independent database gates. The `referral_program_settings` row controls code validation and locks reward eligibility on new attributions. Enable validation and rewards only after the production app build, the deployed referral-context function, and the creator-code migration pass an end-to-end signup test.
