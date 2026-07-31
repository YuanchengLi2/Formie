alter table public.analysis_results
  add column if not exists muscle_focus jsonb not null default '[]'::jsonb,
  add column if not exists coach_note text;

alter table public.analysis_results
  drop constraint if exists analysis_results_muscle_focus_array,
  add constraint analysis_results_muscle_focus_array
    check (jsonb_typeof(muscle_focus) = 'array');
