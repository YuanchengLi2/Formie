alter table public.analysis_results
  add column if not exists set_summary jsonb not null
    default '{"totalReps":null,"consistentReps":null,"verdict":null}'::jsonb,
  add column if not exists rep_timeline jsonb not null default '[]'::jsonb,
  add column if not exists next_set_plan jsonb not null default '[]'::jsonb,
  add column if not exists verification jsonb;

alter table public.analysis_results
  drop constraint if exists analysis_results_set_summary_object,
  add constraint analysis_results_set_summary_object
    check (jsonb_typeof(set_summary) = 'object'),
  drop constraint if exists analysis_results_rep_timeline_array,
  add constraint analysis_results_rep_timeline_array
    check (jsonb_typeof(rep_timeline) = 'array'),
  drop constraint if exists analysis_results_next_set_plan_array,
  add constraint analysis_results_next_set_plan_array
    check (jsonb_typeof(next_set_plan) = 'array'),
  drop constraint if exists analysis_results_verification_object,
  add constraint analysis_results_verification_object
    check (verification is null or jsonb_typeof(verification) = 'object');
