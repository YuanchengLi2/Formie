alter table public.analysis_results
  add column if not exists movement_scores jsonb not null default '[]'::jsonb;

alter table public.analysis_results
  drop constraint if exists analysis_results_movement_scores_array,
  add constraint analysis_results_movement_scores_array
    check (jsonb_typeof(movement_scores) = 'array');

comment on column public.analysis_results.movement_scores is
  'Three to five movement-specific, evidence-grounded coaching scores for current pipeline results; empty for legacy or unable results.';
