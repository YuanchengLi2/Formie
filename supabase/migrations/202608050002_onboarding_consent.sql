alter table public.user_profiles
  add column if not exists marketing_opt_in boolean not null default false;

comment on column public.user_profiles.marketing_opt_in is
  'Optional Formie product and marketing updates consent collected during approved onboarding.';
