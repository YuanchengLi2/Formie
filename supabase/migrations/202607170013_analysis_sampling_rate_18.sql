alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_requested_fps_check;

alter table public.analysis_sessions
  alter column requested_fps set default 18;

update public.analysis_sessions
set requested_fps = 18
where requested_fps <> 18;

alter table public.analysis_sessions
  add constraint analysis_sessions_requested_fps_check
  check (requested_fps = 18);
