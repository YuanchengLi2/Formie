alter table public.analysis_results
  add column if not exists set_context jsonb not null
    default '{"cameraView":null,"visibleReferences":[],"sequenceSummary":null,"changeAcrossSet":null,"coachingBasis":null}'::jsonb;

alter table public.analysis_results
  drop constraint if exists analysis_results_set_context_object,
  add constraint analysis_results_set_context_object
    check (jsonb_typeof(set_context) = 'object');

comment on column public.analysis_results.set_context is
  'Whole-recording context used to ground set-level analysis and coaching.';
