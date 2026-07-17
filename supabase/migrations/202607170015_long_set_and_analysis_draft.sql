alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_duration_ms_check;

alter table public.analysis_sessions
  add constraint analysis_sessions_duration_ms_check
  check (duration_ms between 3000 and 90000);

alter table public.analysis_sessions
  add column if not exists analysis_draft jsonb
  check (analysis_draft is null or jsonb_typeof(analysis_draft) = 'object');
