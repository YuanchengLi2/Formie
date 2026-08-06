alter table public.user_profiles
  add column if not exists age_years integer check (age_years is null or age_years between 13 and 100),
  add column if not exists gender text check (gender is null or gender in ('male', 'female', 'prefer_not_to_say')),
  add column if not exists height_cm numeric(5, 2) check (height_cm is null or height_cm between 100 and 250),
  add column if not exists weight_kg numeric(6, 2) check (weight_kg is null or weight_kg between 25 and 400),
  add column if not exists measurement_system text check (measurement_system is null or measurement_system in ('imperial', 'metric')),
  add column if not exists biggest_frustration text check (biggest_frustration is null or biggest_frustration in ('plateau', 'unsure_form', 'discomfort', 'lack_confidence')),
  add column if not exists workouts_per_week integer check (workouts_per_week is null or workouts_per_week between 1 and 7),
  add column if not exists custom_milestone text check (custom_milestone is null or char_length(custom_milestone) between 1 and 60),
  add column if not exists onboarding_version text;

alter table public.user_profiles
  drop constraint if exists user_profiles_primary_goal_check;

alter table public.user_profiles
  add constraint user_profiles_primary_goal_check check (
    primary_goal is null
    or primary_goal in ('improve_technique', 'build_muscle', 'get_stronger', 'lose_weight', 'train_safely')
  );

update public.user_profiles
set onboarding_version = 'legacy-complete-v1'
where onboarding_completed = true
  and onboarding_version is null;
