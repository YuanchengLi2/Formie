alter table public.analysis_results
  drop constraint if exists analysis_results_muscle_focus_array,
  drop constraint if exists analysis_results_muscle_focus_shape;

alter table public.analysis_results
  add constraint analysis_results_muscle_focus_shape
    check (jsonb_typeof(muscle_focus) in ('array', 'object'));
