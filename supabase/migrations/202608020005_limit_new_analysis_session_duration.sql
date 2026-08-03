-- Enforce the v45 input window for new or changed session metadata without
-- invalidating historical completed results that used the older 45-second cap.

alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_v45_duration_ms_check,
  add constraint analysis_sessions_v45_duration_ms_check
    check (duration_ms is null or duration_ms between 3000 and 15000)
    not valid;
