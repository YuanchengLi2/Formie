alter table public.analysis_sessions
  add column if not exists analysis_contradictions jsonb not null default '[]'::jsonb;

alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_analysis_contradictions_check;

alter table public.analysis_sessions
  add constraint analysis_sessions_analysis_contradictions_check
  check (jsonb_typeof(analysis_contradictions) = 'array');

comment on column public.analysis_sessions.analysis_contradictions is
  'Factual contradictions carried between bounded analysis pipeline invocations.';
