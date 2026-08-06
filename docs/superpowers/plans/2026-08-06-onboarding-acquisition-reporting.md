# Onboarding Acquisition Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. This repository explicitly requires one agent; do not dispatch subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required acquisition-source onboarding question, store one authenticated first-touch response in Supabase, and provide a retryable server-only Google Sheets export.

**Architecture:** The signed-out onboarding store collects the answer locally and migrates existing version-2 state to version 3. The authenticated profile-sync path records the final answer through a security-definer RPC into a locked reporting table. A separate authenticated Edge Function exports pending rows to Google Sheets using service-account credentials; missing credentials or provider failure never loses the Supabase response or blocks onboarding.

**Tech Stack:** Expo Router, React Native, TypeScript, Zod, Supabase Postgres/RLS/RPC, Supabase Edge Functions/Deno, Google Sheets API v4, Jest, React Native Testing Library.

---

### Task 1: Version the onboarding answer contract

**Files:**
- Modify: `src/features/onboarding/types.ts`
- Modify: `src/features/onboarding/onboarding-schema.ts`
- Modify: `src/features/onboarding/onboarding-store.test.ts`
- Modify: `src/features/onboarding/onboarding-schema.test.ts` if present; otherwise create focused migration coverage in `onboarding-store.test.ts`

- [ ] Write failing tests requiring `acquisition-source` between `custom-milestone` and `long-term-value`, `acquisitionSource: null`, `acquisitionSourceOther: ""`, and version-2-to-version-3 parsing that preserves completed status and current step.
- [ ] Run `npx jest --runInBand src/features/onboarding/onboarding-store.test.ts` and confirm RED because the step and fields do not exist.
- [ ] Add `AcquisitionSource` with values `tiktok`, `instagram`, `youtube`, `app_store_search`, `google_search`, `friend_trainer_coach`, and `other`; add the two answer fields; change `OnboardingState.schemaVersion` to `3`; insert the new step; and initialize empty acquisition answers.
- [ ] Split schema parsing into a current version-3 schema and a legacy version-2 schema. Convert a valid v2 state by adding the empty acquisition fields and schema version 3. Do not reset completed users or change their route/status.
- [ ] Re-run focused tests and require GREEN.

### Task 2: Build the responsive native question

**Files:**
- Modify: `src/screens/onboarding/approved-onboarding.tsx`
- Modify: `src/screens/onboarding/approved-onboarding.test.tsx`

- [ ] Add a failing test that renders `acquisition-source`, asserts the native title and seven labels, asserts no page `ScrollView`, requires a selection before Continue, and requires nonblank Other detail with `maxLength={80}`.
- [ ] Run `npx jest --runInBand src/screens/onboarding/approved-onboarding.test.tsx` and confirm RED for the missing step UI.
- [ ] Add title/subtitle metadata, compact two-column radio cards, selected/accessibility states, the conditional Other `TextInput`, and validation. Add `acquisition-source` to control steps and enable keyboard avoidance only when Other is selected.
- [ ] Add bounded styles that fit four compact rows plus the conditional input inside the existing fixed Scaffold geometry; retain the measured 68/60-point CTA and never introduce a page scroll container.
- [ ] Re-run the onboarding screen tests and require GREEN.

### Task 3: Create the secure acquisition ledger and reporting view

**Files:**
- Create: `supabase/migrations/202608060001_onboarding_acquisition_reporting.sql`
- Create: `supabase/tests/onboarding-acquisition-reporting.sql`

- [ ] Write pgTAP/SQL assertions for allowed sources, Other-detail consistency, one row per user, RLS enabled, no authenticated direct table access, authenticated RPC ownership, first-write-wins behavior, claim lease recovery, and service-role-only summary reporting.
- [ ] Add `onboarding_acquisition_responses` with immutable attribution fields and `sheet_sync_status`, `sheet_sync_attempts`, `sheet_sync_started_at`, `sheet_synced_at`, and sanitized `sheet_last_error` operational fields.
- [ ] Add `record_onboarding_acquisition(text,text,text,text)` as `security definer`, derive the user from `auth.uid()`, validate platform/source/detail, insert on conflict without changing the first response, and return the response ID.
- [ ] Add `claim_onboarding_acquisition_sheet_rows(integer)`, restricted to `service_role`, using `FOR UPDATE SKIP LOCKED` and reclaiming `syncing` rows older than 15 minutes.
- [ ] Add a service-role-only `onboarding_acquisition_summary` view grouped by source; revoke table/view/function privileges from public, anon, and authenticated except execute on the recording RPC.
- [ ] Run the project SQL test workflow if local database support is available; otherwise validate through `supabase db push --dry-run`/migration lint and targeted live RPC tests after deployment.

### Task 4: Record acquisition during authenticated profile sync

**Files:**
- Modify: `src/features/profile/profile-repository.ts`
- Modify: `src/features/profile/profile-repository.test.ts`
- Modify: `src/features/profile/profile-provider.tsx`
- Modify: `src/features/profile/profile-provider.test.tsx`

- [ ] Write failing repository tests for valid acquisition RPC arguments and no call when an answer is absent. Write provider tests proving the profile is not marked synced until acquisition recording succeeds and that Sheets triggering cannot block successful profile completion.
- [ ] Run the focused profile tests and confirm RED.
- [ ] Extend the typed profile client with `rpc("record_onboarding_acquisition", ...)` and add `recordOnboardingAcquisition()` that normalizes blank Other detail and uses `Platform.OS` at the provider boundary.
- [ ] Update profile completeness to require a source and valid Other detail for version-3 onboarding.
- [ ] In `ProfileProvider`, after profile upsert and before `markProfileSynced`, await the acquisition RPC. After it succeeds, invoke `sync-acquisition-sheet` best-effort; ignore only the export trigger failure because the database row is durable.
- [ ] Re-run focused profile tests and require GREEN.

### Task 5: Implement the idempotent Google Sheets exporter

**Files:**
- Create: `supabase/functions/sync-acquisition-sheet/handler.ts`
- Create: `supabase/functions/sync-acquisition-sheet/index.ts`
- Create: `supabase/functions/sync-acquisition-sheet/handler.test.ts`
- Modify: `supabase/config.toml`

- [ ] Write failing tests for sheet row formatting, existing-response-ID deduplication, append payload shape, missing configuration returning `queued`, successful sync IDs, and provider failure releasing claimed IDs with a sanitized message.
- [ ] Implement pure helpers for PKCS8 PEM conversion, RS256 JWT assertion creation, Google OAuth token exchange, range encoding, existing ID loading, and `values.append`. Keep raw keys, tokens, Google response bodies, and user emails out of responses/logs.
- [ ] Implement an injectable handler that authenticates the caller, returns 202 queued if Google configuration is absent, claims at most 100 rows, skips IDs already in the sheet, appends the remaining rows as `[response_id, created_at, user_id, source, other_detail, platform, onboarding_version]`, and marks all claimed rows synced only after successful dedupe/append.
- [ ] On provider failure, return claimed rows to pending, increment attempts, save a bounded generic last error, and return 502 without exposing secrets.
- [ ] Register `[functions.sync-acquisition-sheet] verify_jwt = true` in `supabase/config.toml` and run the focused Deno/Jest-compatible function tests.

### Task 6: Documentation, full verification, and deployment

**Files:**
- Modify: `.env.example`
- Modify: `docs/FORMIE_ONBOARDING_REVENUECAT_SETUP.md`
- Verify all files above

- [ ] Document `GOOGLE_SHEETS_CLIENT_EMAIL`, `GOOGLE_SHEETS_PRIVATE_KEY`, and `GOOGLE_SHEETS_SPREADSHEET_ID`, the required sheet tab/header order, service-account sharing, first-touch semantics, Supabase fallback reporting, retry behavior, and the fact that coaching/profile fields are excluded from Sheets.
- [ ] Run focused tests: `npx jest --runInBand src/features/onboarding/onboarding-store.test.ts src/screens/onboarding/approved-onboarding.test.tsx src/features/profile/profile-repository.test.ts src/features/profile/profile-provider.test.tsx supabase/functions/sync-acquisition-sheet/handler.test.ts`.
- [ ] Run `npx tsc --noEmit` and `npm run lint`.
- [ ] Apply migration `202608060001_onboarding_acquisition_reporting.sql` to the linked Supabase project, deploy `sync-acquisition-sheet`, and confirm the function is ACTIVE with JWT verification.
- [ ] Run an authenticated live insert with a disposable/test account only if one is already available, verify one Supabase row and first-write-wins behavior, and avoid inserting fabricated production attribution for a real user.
- [ ] If Google secrets are already available, configure them, share the target spreadsheet with the service account, invoke the exporter, and verify a single deduplicated row. If they are not available, report Sheets as configuration-blocked while confirming Supabase capture and the service-role summary are live.
- [ ] Verify the restarted Metro session remains healthy and that the updated iOS bundle is served after implementation.
