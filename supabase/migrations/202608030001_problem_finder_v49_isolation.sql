-- Isolated Gemini problem-finder pipeline. Historical result rows remain intact.

create table public.analysis_v49_runs (
  run_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('primary', 'shadow')),
  pipeline_version text not null default 'gemini-problem-finder-v49'
    check (pipeline_version = 'gemini-problem-finder-v49'),
  declaration_snapshot jsonb not null check (jsonb_typeof(declaration_snapshot) = 'object'),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'complete', 'unable', 'failed')),
  stage text not null default 'input_ready'
    check (stage in ('input_ready', 'video_processing', 'problem_finding', 'coaching', 'committing', 'complete', 'unable', 'failed')),
  failure_code text,
  failure_reason jsonb check (failure_reason is null or jsonb_typeof(failure_reason) = 'object'),
  raw_problem_output jsonb check (raw_problem_output is null or jsonb_typeof(raw_problem_output) = 'object'),
  raw_writer_output jsonb check (raw_writer_output is null or jsonb_typeof(raw_writer_output) = 'object'),
  public_result jsonb check (public_result is null or jsonb_typeof(public_result) = 'object'),
  model_call_count integer not null default 0 check (model_call_count >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index analysis_v49_runs_session_idx
  on public.analysis_v49_runs(session_id, created_at desc);
create index analysis_v49_runs_retry_idx
  on public.analysis_v49_runs(status, stage, updated_at)
  where status in ('queued', 'processing');

create table public.analysis_v49_stage_runs (
  stage_run_id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.analysis_v49_runs(run_id) on delete cascade,
  stage text not null check (stage in ('problem_finder', 'coaching_writer', 'commit')),
  input_hash text not null check (length(input_hash) = 64),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  lease_token uuid,
  lease_expires_at timestamptz,
  attempt integer not null default 0 check (attempt >= 0),
  output jsonb,
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (run_id, stage)
);

alter table public.analysis_sessions
  add column if not exists active_v49_run_id uuid references public.analysis_v49_runs(run_id) on delete set null;

alter table public.model_call_telemetry
  add column if not exists v49_run_id uuid references public.analysis_v49_runs(run_id) on delete cascade;

create index model_call_telemetry_v49_run_idx
  on public.model_call_telemetry(v49_run_id, created_at);

alter table public.analysis_v49_runs enable row level security;
alter table public.analysis_v49_stage_runs enable row level security;
revoke all on table public.analysis_v49_runs from anon, authenticated;
revoke all on table public.analysis_v49_stage_runs from anon, authenticated;
grant all on table public.analysis_v49_runs to service_role;
grant all on table public.analysis_v49_stage_runs to service_role;

create or replace function public.start_analysis_v49(
  p_session_id uuid,
  p_user_id uuid,
  p_mode text default 'primary'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.analysis_sessions%rowtype;
  p_run_id uuid := gen_random_uuid();
begin
  if p_mode not in ('primary', 'shadow') then raise exception 'invalid v49 run mode'; end if;
  select * into target from public.analysis_sessions
  where id = p_session_id and user_id = p_user_id
  for update;
  if not found then raise exception 'analysis session not found'; end if;
  if target.set_declaration is null then raise exception 'set declaration required'; end if;
  if target.duration_ms is null or (target.video_path is null and target.analysis_video_path is null) then
    raise exception 'analysis video missing';
  end if;

  insert into public.analysis_v49_runs(run_id, session_id, user_id, mode, declaration_snapshot)
  values (p_run_id, p_session_id, p_user_id, p_mode, target.set_declaration);

  if p_mode = 'primary' then
    update public.analysis_sessions
    set active_v49_run_id = p_run_id,
        pipeline_version = 'gemini-problem-finder-v49',
        status = 'processing',
        stage = 'input_ready',
        failure_code = null,
        analysis_started_at = null,
        analysis_next_retry_at = null,
        analysis_last_error_code = null,
        updated_at = now()
    where id = p_session_id and user_id = p_user_id;
  end if;
  return p_run_id;
end;
$$;

create or replace function public.claim_analysis_v49_stage(
  p_run_id uuid,
  p_stage text,
  p_input_hash text,
  p_lease_seconds integer default 90
)
returns table(result_status text, stage_run_id uuid, lease_token uuid, output jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.analysis_v49_stage_runs%rowtype;
  next_token uuid := gen_random_uuid();
begin
  if p_stage not in ('problem_finder', 'coaching_writer', 'commit') then raise exception 'invalid v49 stage'; end if;
  if length(p_input_hash) <> 64 then raise exception 'invalid v49 input hash'; end if;
  if p_lease_seconds < 5 or p_lease_seconds > 300 then raise exception 'invalid v49 lease duration'; end if;

  insert into public.analysis_v49_stage_runs(run_id, stage, input_hash, status, lease_token, lease_expires_at)
  values (p_run_id, p_stage, p_input_hash, 'running', next_token, now() + make_interval(secs => p_lease_seconds))
  on conflict (run_id, stage) do nothing
  returning * into existing;
  if found then
    return query select 'claimed', existing.stage_run_id, next_token, null::jsonb;
    return;
  end if;

  select * into existing from public.analysis_v49_stage_runs
  where run_id = p_run_id and stage = p_stage for update;
  if existing.input_hash <> p_input_hash then raise exception 'v49 stage input hash changed'; end if;
  if existing.status = 'succeeded' then
    return query select 'succeeded', existing.stage_run_id, existing.lease_token, existing.output;
    return;
  end if;
  if existing.status = 'failed' and existing.error_code = 'ANALYSIS_CONTRACT_INVALID' then
    return query select 'failed', existing.stage_run_id, existing.lease_token, existing.output;
    return;
  end if;
  if existing.status = 'running' and existing.lease_expires_at > now() then
    return query select 'busy', existing.stage_run_id, existing.lease_token, existing.output;
    return;
  end if;

  update public.analysis_v49_stage_runs
  set status = 'running', attempt = attempt + 1, lease_token = next_token,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      error_code = null, completed_at = null, started_at = now(), updated_at = now()
  where analysis_v49_stage_runs.stage_run_id = existing.stage_run_id;
  return query select 'claimed', existing.stage_run_id, next_token, null::jsonb;
end;
$$;

create or replace function public.complete_analysis_v49_stage(
  p_stage_run_id uuid,
  p_lease_token uuid,
  p_output jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.analysis_v49_stage_runs
  set status = 'succeeded', output = p_output, lease_expires_at = null,
      completed_at = now(), updated_at = now()
  where stage_run_id = p_stage_run_id and status = 'running' and lease_token = p_lease_token;
  return found;
end;
$$;

create or replace function public.fail_analysis_v49_stage(
  p_stage_run_id uuid,
  p_lease_token uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.analysis_v49_stage_runs
  set status = 'failed', error_code = left(p_error_code, 64), lease_expires_at = null,
      completed_at = now(), updated_at = now()
  where stage_run_id = p_stage_run_id and status = 'running' and lease_token = p_lease_token;
  return found;
end;
$$;

create or replace function public.mark_analysis_v49_unable(
  p_run_id uuid,
  p_reason jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_run public.analysis_v49_runs%rowtype;
begin
  select * into target_run from public.analysis_v49_runs where run_id = p_run_id for update;
  if not found then raise exception 'v49 run not found'; end if;
  update public.analysis_v49_runs
  set status = 'unable', stage = 'unable', failure_code = 'ANALYSIS_UNABLE',
      failure_reason = p_reason, completed_at = now(), updated_at = now()
  where run_id = p_run_id;
  if target_run.mode = 'primary' then
    update public.analysis_sessions
    set status = 'failed', stage = 'failed', failure_code = 'ANALYSIS_UNABLE',
        updated_at = now()
    where id = target_run.session_id and active_v49_run_id = p_run_id;
  end if;
end;
$$;

create or replace function public.fail_analysis_v49_run(
  p_run_id uuid,
  p_error_code text,
  p_reason jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_run public.analysis_v49_runs%rowtype;
begin
  select * into target_run from public.analysis_v49_runs where run_id = p_run_id for update;
  if not found then raise exception 'v49 run not found'; end if;
  if target_run.status in ('complete', 'unable') then return; end if;
  update public.analysis_v49_runs
  set status = 'failed', stage = 'failed', failure_code = left(p_error_code, 64),
      failure_reason = p_reason, completed_at = now(), updated_at = now()
  where run_id = p_run_id;
  if target_run.mode = 'primary' then
    update public.analysis_sessions
    set status = 'failed', stage = 'failed', failure_code = left(p_error_code, 64), updated_at = now()
    where id = target_run.session_id and active_v49_run_id = p_run_id;
  end if;
end;
$$;

create or replace function public.commit_analysis_v49_result(
  p_run_id uuid,
  p_problem_output jsonb,
  p_writer_output jsonb,
  p_public_result jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare target_run public.analysis_v49_runs%rowtype;
begin
  select * into target_run from public.analysis_v49_runs where run_id = p_run_id for update;
  if not found then raise exception 'v49 run not found'; end if;

  update public.analysis_v49_runs
  set status = 'complete', stage = 'complete', raw_problem_output = p_problem_output,
      raw_writer_output = p_writer_output, public_result = p_public_result,
      completed_at = now(), updated_at = now()
  where run_id = p_run_id;

  if target_run.mode = 'primary' then
    update public.analysis_sessions
    set status = 'complete', stage = 'complete', pipeline_version = 'gemini-problem-finder-v49',
        failure_code = null, completed_at = now(), updated_at = now()
    where id = target_run.session_id
      and active_v49_run_id = p_run_id;
    if not found then raise exception 'stale v49 run cannot commit'; end if;
  end if;
  return true;
end;
$$;

create or replace function public.reset_analysis_for_reanalysis(
  p_session_id uuid,
  p_user_id uuid,
  p_declaration jsonb default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.analysis_sessions%rowtype;
  effective_declaration jsonb;
  next_run_id uuid;
begin
  select * into target from public.analysis_sessions
  where id = p_session_id and user_id = p_user_id for update;
  if not found then return 'not_found'; end if;
  if target.duration_ms is null or (target.video_path is null and target.analysis_video_path is null) then return 'video_missing'; end if;
  if target.status in ('uploading', 'queued', 'processing') then return 'busy'; end if;
  effective_declaration := coalesce(p_declaration, target.set_declaration);
  if effective_declaration is null then return 'declaration_required'; end if;

  update public.analysis_sessions
  set status = 'queued', stage = 'input_ready', pipeline_version = 'gemini-problem-finder-v49',
      set_declaration = effective_declaration,
      detected_label = effective_declaration #>> '{exercise,label}', detected_variation = null,
      detected_equipment = '[]'::jsonb, recognition_confidence = 1,
      recognition_alternatives = '[]'::jsonb, gemini_file_name = null,
      gemini_file_uri = null, gemini_file_state = null, analysis_draft = null,
      analysis_input_transport = null, analysis_input_byte_length = null,
      analysis_input_preparation_ms = null, analysis_upload_duration_ms = null,
      analysis_total_duration_ms = null, analysis_model_call_count = null,
      analysis_correction_count = null, analysis_retry_count = 0,
      analysis_next_retry_at = null, analysis_last_error_code = null,
      failure_code = null, completed_at = null, analysis_started_at = null,
      active_v49_run_id = null, updated_at = now()
  where id = p_session_id and user_id = p_user_id;

  next_run_id := public.start_analysis_v49(p_session_id, p_user_id, 'primary');
  return 'ready';
end;
$$;

revoke all on function public.start_analysis_v49(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.claim_analysis_v49_stage(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.complete_analysis_v49_stage(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.fail_analysis_v49_stage(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.mark_analysis_v49_unable(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.fail_analysis_v49_run(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.commit_analysis_v49_result(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.reset_analysis_for_reanalysis(uuid, uuid, jsonb) from public, anon, authenticated;

grant execute on function public.start_analysis_v49(uuid, uuid, text) to service_role;
grant execute on function public.claim_analysis_v49_stage(uuid, text, text, integer) to service_role;
grant execute on function public.complete_analysis_v49_stage(uuid, uuid, jsonb) to service_role;
grant execute on function public.fail_analysis_v49_stage(uuid, uuid, text) to service_role;
grant execute on function public.mark_analysis_v49_unable(uuid, jsonb) to service_role;
grant execute on function public.fail_analysis_v49_run(uuid, text, jsonb) to service_role;
grant execute on function public.commit_analysis_v49_result(uuid, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.reset_analysis_for_reanalysis(uuid, uuid, jsonb) to service_role;

-- The old runtime RPCs/table are intentionally not removed in this migration.
-- Their destructive retirement is a separate post-release migration, created
-- only after no active legacy runs remain and device cutover is verified.
