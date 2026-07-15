drop table if exists public.pose_artifacts cascade;
drop table if exists public.analysis_jobs cascade;

alter table public.analysis_sessions
  add column if not exists capture_orientation text,
  add column if not exists camera_facing text,
  add column if not exists camera_lens text,
  add column if not exists requested_fps integer not null default 24 check (requested_fps = 24),
  add column if not exists gemini_file_name text,
  add column if not exists gemini_file_uri text,
  add column if not exists gemini_file_state text check (gemini_file_state in ('PROCESSING', 'ACTIVE', 'FAILED')),
  add column if not exists analysis_attempts integer not null default 0 check (analysis_attempts between 0 and 3),
  add column if not exists cleanup_pending boolean not null default false,
  add column if not exists model_name text;
