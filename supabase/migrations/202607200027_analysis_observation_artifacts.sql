alter table public.analysis_sessions
  add column if not exists analyst_set_summary_v2 jsonb,
  add column if not exists equipment_observations_v2 jsonb not null default '[]'::jsonb;

comment on column public.analysis_sessions.analyst_set_summary_v2 is 'Validated visible set summary from the criteria analyst.';
comment on column public.analysis_sessions.equipment_observations_v2 is 'Validated literal equipment observations retained for final coaching.';
