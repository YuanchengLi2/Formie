# Onboarding Acquisition Reporting Design

## Goal

Add a required, responsive `Where did you hear about Formie?` question to the approved onboarding flow and reliably retain the acquisition response for reporting. Supabase is the durable source of truth; a server-only exporter can mirror the minimal reporting fields into Google Sheets without exposing Google credentials or personal coaching-profile answers to the mobile app.

## Mobile experience

The new `acquisition-source` step appears after `custom-milestone` and before `long-term-value`. It uses compact native radio cards in two columns so the heading, all seven choices, optional detail field, and existing 68-point Continue button fit without a page `ScrollView` at 320x568 and larger sizes.

The required choices are `TikTok`, `Instagram`, `YouTube`, `App Store search`, `Google search`, `Friend, trainer, or coach`, and `Other`. Choosing `Other` reveals an 80-character native text field and requires nonblank detail. Keyboard accommodation is enabled only while that conditional field is visible.

The local onboarding schema advances from version 2 to version 3. A parser migration adds the new nullable answer fields to existing version-2 state so completed users are not returned to onboarding. New users cannot continue past the acquisition step without a valid choice.

## Durable data path

After social authentication, profile synchronization writes the normal coaching profile and then invokes an authenticated `record_onboarding_acquisition` database function. The function derives `user_id` from `auth.uid()`, validates the source and `Other` consistency, and inserts one immutable first-touch response per user. Only the acquisition source, optional detail, platform, onboarding version, response ID, and timestamp are stored in the reporting table. Email, age, gender, height, weight, goals, and frustration answers are not copied into the acquisition export.

The profile is not marked synchronized until the Supabase acquisition write succeeds. A Sheets export failure never blocks onboarding because the Supabase row is already durable.

## Google Sheets export

`sync-acquisition-sheet` is an authenticated Edge Function invoked after a successful acquisition write. It claims pending rows with a database lease, obtains a Google service-account OAuth token, reads existing response IDs from the configured sheet, appends only missing rows, and marks rows synchronized. A failed or interrupted export returns rows to `pending`; stale `syncing` leases are reclaimable. Reading response IDs before append makes retries idempotent at the spreadsheet layer.

The function requires server-only secrets: `GOOGLE_SHEETS_CLIENT_EMAIL`, `GOOGLE_SHEETS_PRIVATE_KEY`, and `GOOGLE_SHEETS_SPREADSHEET_ID`. Until they are configured, the function returns an accepted `queued` result and leaves rows pending. This means Supabase reporting works immediately and Sheets delivery activates without a mobile release once the sheet is shared with the service account.

## Reporting and privacy

The migration adds a service-role-only aggregate view containing source and response count, so acquisition performance is usable in Supabase before Sheets is configured. Row-level security prevents mobile clients from reading or directly modifying acquisition rows. The authenticated recording function is first-write-wins, preventing later profile edits or repeated onboarding launches from rewriting attribution.

## Error handling and verification

- Invalid or missing acquisition answers block Continue locally.
- An authenticated database write failure keeps profile sync retryable and does not falsely complete onboarding.
- Missing Google configuration queues data without losing it or blocking the user.
- Google API failures release claimed rows back to pending with a sanitized error and incremented attempt count.
- Tests cover step order, schema migration, validation, native no-scroll rendering, profile synchronization, SQL security/constraints, sheet-row formatting, deduplication, retry behavior, and missing configuration.
