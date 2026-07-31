create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (
    char_length(trim(display_name)) between 2 and 60
  ),
  experience text check (
    experience is null
    or experience in ('beginner', 'intermediate', 'advanced')
  ),
  primary_goal text check (
    primary_goal is null
    or primary_goal in ('improve_technique', 'build_muscle', 'get_stronger', 'train_safely')
  ),
  onboarding_step text not null default 'welcome' check (
    onboarding_step in (
      'welcome',
      'how_it_works',
      'experience',
      'primary_goal',
      'first_analysis',
      'complete'
    )
  ),
  onboarding_completed boolean not null default false,
  legal_accepted_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (onboarding_completed = false and onboarding_step <> 'complete' and onboarding_completed_at is null)
    or
    (onboarding_completed = true and onboarding_step = 'complete' and onboarding_completed_at is not null)
  )
);

alter table public.user_profiles enable row level security;

create policy "Users can read own profile"
on public.user_profiles for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create own profile"
on public.user_profiles for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own profile"
on public.user_profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.user_profiles to authenticated;

create function public.touch_user_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_user_profile_updated_at
before update on public.user_profiles
for each row execute function public.touch_user_profile_updated_at();
