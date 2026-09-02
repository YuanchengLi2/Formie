drop function if exists public.claim_onboarding_acquisition_sheet_rows(integer);

alter table public.onboarding_acquisition_responses
  drop column if exists sheet_sync_status,
  drop column if exists sheet_sync_attempts,
  drop column if exists sheet_sync_started_at,
  drop column if exists sheet_synced_at,
  drop column if exists sheet_last_error;

comment on table public.onboarding_acquisition_responses is
  'Account-linked onboarding attribution stored only in Supabase and removed by auth-user cascade.';
