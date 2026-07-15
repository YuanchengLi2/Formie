create extension if not exists pgcrypto;

create table public.exercises (
  id integer primary key,
  slug text not null unique,
  name text not null,
  category text not null check (category in ('Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core')),
  equipment text[] not null default '{}',
  aliases text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.exercise_profiles (
  exercise_id integer not null references public.exercises(id) on delete cascade,
  version integer not null check (version > 0),
  profile jsonb not null check (jsonb_typeof(profile) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (exercise_id, version)
);

create table public.analysis_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id integer references public.exercises(id),
  status text not null default 'created' check (status in ('created', 'uploading', 'queued', 'processing', 'complete', 'partial', 'unable', 'failed')),
  stage text,
  video_path text,
  duration_ms integer check (duration_ms between 3000 and 60000),
  camera_view text,
  detected_label text,
  detected_variation text,
  detected_equipment jsonb not null default '[]'::jsonb check (jsonb_typeof(detected_equipment) = 'array'),
  recognition_confidence numeric not null default 0 check (recognition_confidence between 0 and 1),
  recognition_alternatives jsonb not null default '[]'::jsonb check (jsonb_typeof(recognition_alternatives) = 'array'),
  corrected_label text,
  corrected_exercise_id integer references public.exercises(id),
  previous_session_id uuid references public.analysis_sessions(id) on delete set null,
  failure_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index analysis_sessions_user_created_idx on public.analysis_sessions(user_id, created_at desc);
create index analysis_sessions_exercise_idx on public.analysis_sessions(user_id, exercise_id, created_at desc);
create index analysis_sessions_previous_idx on public.analysis_sessions(user_id, previous_session_id);

create table public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.analysis_sessions(id) on delete cascade,
  stage text not null default 'queued',
  attempt integer not null default 0 check (attempt between 0 and 3),
  lease_until timestamptz,
  worker_version text,
  profile_version integer,
  model_name text,
  error_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index analysis_jobs_lease_idx on public.analysis_jobs(stage, lease_until);

create table public.analysis_results (
  session_id uuid primary key references public.analysis_sessions(id) on delete cascade,
  status text not null check (status in ('complete', 'partial', 'unable')),
  video_check jsonb not null check (jsonb_typeof(video_check) = 'object'),
  overall_assessment text,
  score numeric check (score between 0 and 100),
  score_rationale jsonb not null default '[]'::jsonb check (jsonb_typeof(score_rationale) = 'array'),
  did_well jsonb not null default '[]'::jsonb check (jsonb_typeof(did_well) = 'array'),
  priority_corrections jsonb not null default '[]'::jsonb check (jsonb_typeof(priority_corrections) = 'array'),
  coaching_cues jsonb not null default '[]'::jsonb check (jsonb_typeof(coaching_cues) = 'array'),
  view_note text,
  comparison jsonb check (comparison is null or jsonb_typeof(comparison) = 'object'),
  analysis_version text not null,
  created_at timestamptz not null default now()
);

create table public.pose_artifacts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions(id) on delete cascade,
  storage_path text not null,
  sample_rate numeric not null check (sample_rate = 15),
  visibility_summary jsonb not null check (jsonb_typeof(visibility_summary) = 'object'),
  rep_boundaries jsonb not null check (jsonb_typeof(rep_boundaries) = 'array'),
  measurements jsonb not null default '{}'::jsonb check (jsonb_typeof(measurements) = 'object'),
  candidate_events jsonb not null default '[]'::jsonb check (jsonb_typeof(candidate_events) = 'array'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index pose_artifacts_expiry_idx on public.pose_artifacts(expires_at);

alter table public.exercises enable row level security;
alter table public.exercise_profiles enable row level security;
alter table public.analysis_sessions enable row level security;
alter table public.analysis_jobs enable row level security;
alter table public.analysis_results enable row level security;
alter table public.pose_artifacts enable row level security;

create policy "Catalog is publicly readable"
on public.exercises for select
to anon, authenticated
using (is_active = true);

create policy "Active profiles are publicly readable"
on public.exercise_profiles for select
to anon, authenticated
using (is_active = true);

create policy "Users can read own analysis sessions"
on public.analysis_sessions for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create own analysis sessions"
on public.analysis_sessions for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can delete own analysis sessions"
on public.analysis_sessions for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read own analysis results"
on public.analysis_results for select
to authenticated
using (
  exists (
    select 1 from public.analysis_sessions session
    where session.id = analysis_results.session_id
      and session.user_id = (select auth.uid())
  )
);

create policy "Users can read own pose artifact metadata"
on public.pose_artifacts for select
to authenticated
using (
  exists (
    select 1 from public.analysis_sessions session
    where session.id = pose_artifacts.session_id
      and session.user_id = (select auth.uid())
  )
);

grant select on public.exercises, public.exercise_profiles to anon, authenticated;
grant select, insert, delete on public.analysis_sessions to authenticated;
grant select on public.analysis_results, public.pose_artifacts to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('analysis-videos', 'analysis-videos', false, 262144000, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload own analysis videos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'analysis-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can read own analysis videos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'analysis-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete own analysis videos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'analysis-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
