alter table public.analysis_results
  add column if not exists premium_runs_used integer not null default 0
    check (premium_runs_used between 0 and 3),
  add column if not exists precision_review jsonb;

alter table public.analysis_results
  drop constraint if exists analysis_results_precision_review_object,
  add constraint analysis_results_precision_review_object
    check (precision_review is null or jsonb_typeof(precision_review) = 'object');
