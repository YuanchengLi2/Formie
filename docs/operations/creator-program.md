# Formie creator program operations

## Program terms

Creator attribution uses a permanent, case-insensitive code. During onboarding, the user chooses **Affiliated creator**, enters the code on the next screen, and must receive a valid result before continuing. The server looks up the active creator and issues a 256-bit bearer claim, storing only its SHA-256 hash. The claim expires after 30 days and can be attached only to the new account created by that onboarding attempt. Attribution locks to that account and cannot be changed by a later code.

An attributed account receives three bonus analyses after its first positive production monthly payment. The bonus uses that provider transaction's paid period and expires at its actual period end. Base quota is consumed first. Renewals return to the ordinary allowance of ten and do not create another creator commission.

Creator commission applies to the first successful payment only. The account records the creator's applicable rate version at attribution. The default is 15%; a founder can set a future rate from 0% through 20%. The basis is estimated net proceeds after reported store commission and transaction tax until a compatible Apple financial report is reconciled.

## Provisioning and access

1. Sign into the founder Creators section.
2. Enter the creator display name, portal email, and future commission rate.
3. Copy the generated one-time Supabase invitation and share it through the normal creator communication channel.
4. The creator opens the invite, sets a password of at least 12 characters, and signs into the creator portal.
5. Copy the permanent creator code from either dashboard and validate it in a fresh signed-out onboarding attempt.

Pausing a code prevents new validations. Claims issued before a pause can still be attached until they expire. Pausing a creator preserves portal access, existing attribution, earnings, and ledger history. Revoke the creator membership to remove portal access without deleting business records.

The founder Creators page also owns the database rollout switches. Turning off code validation stops new claims while preserving existing codes and records. Turning off rewards affects only accounts attributed after the change because reward eligibility is copied onto the account attribution. It does not remove a bonus or commission already promised to an eligible attributed account.

## Monthly reconciliation and payout

1. Download Apple's detailed financial report for one fiscal period and settlement currency.
2. In the founder Revenue section, upload the original tab-separated report. The file is stored in the private apple-financial-reports bucket under its SHA-256 fingerprint.
3. Review rejected rows, incompatible currency, product, and storefront buckets, and quantity differences. Missing foreign-exchange compatibility remains pending.
4. Accept reconciliation only when compatible bucket quantity and proceeds reconcile. Per-creator proceeds are shown as a weighted allocation for that report period, rather than an individual Apple receipt.
5. Wait until each qualifying payment is at least 30 days old.
6. Open the creator detail page and prepare one payout per native currency. Preparation locks exact commission ledger entries and does not mean money was sent.
7. Export the creator statement, pay through the external payment method, then mark the batch paid with the payment date and external reference.

Refunds before payout reduce the payable balance. Refunds after payout create a negative ledger adjustment carried against future earnings. Disabling auto-renew does not reverse a commission and does not remove paid-through access.

## Incident handling

- Unmapped RevenueCat transactions stay pending. Resolve canonical receipt ownership, then rerun entitlement reconciliation.
- A delayed bonus projection can coexist briefly with active subscription access. The app displays that the referral bonus is syncing and does not invent three credits.
- Invalid or unavailable codes do not block ordinary onboarding: the user can go back and choose another acquisition source. Do not manually attribute an account from a survey answer, IP address, or an unclaimed code validation.
- Never edit a historical commission rate, grant another acquisition reward for a restore or transfer, or combine different currencies without a recorded conversion source.
