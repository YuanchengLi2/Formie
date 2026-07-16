alter table public.analysis_sessions
  add column if not exists preflight_check jsonb,
  add column if not exists preflight_checked_at timestamptz;

comment on column public.analysis_sessions.preflight_check is
  'Gemini low-frame-rate usability gate completed before full coaching analysis.';
