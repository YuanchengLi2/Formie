alter table public.analysis_sessions
  add column if not exists pose_summary jsonb;

alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_pose_summary_object;

alter table public.analysis_sessions
  add constraint analysis_sessions_pose_summary_object
  check (pose_summary is null or jsonb_typeof(pose_summary) = 'object');
