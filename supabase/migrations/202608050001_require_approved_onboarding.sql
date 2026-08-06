-- The temporary mock-membership rollout changed these defaults to completed.
-- New profiles must start at Welcome; only an explicit approved-v1 profile write
-- may mark onboarding complete.
alter table public.user_profiles
  alter column onboarding_step set default 'welcome',
  alter column onboarding_completed set default false,
  alter column onboarding_completed_at drop default;
