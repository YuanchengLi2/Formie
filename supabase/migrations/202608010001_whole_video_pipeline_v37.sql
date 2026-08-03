-- Fixed 12 FPS whole-video pipeline state and single-worker leases.
alter table public.analysis_sessions
  add column if not exists analysis_review_request_v1 jsonb,
  add column if not exists analysis_review_result_v1 jsonb,
  add column if not exists analysis_input_byte_length integer,
  add column if not exists analysis_input_transport text,
  add column if not exists analysis_input_preparation_ms integer,
  add column if not exists analysis_upload_duration_ms integer,
  add column if not exists analysis_total_duration_ms integer,
  add column if not exists analysis_model_call_count integer,
  add column if not exists analysis_correction_count integer,
  add column if not exists analysis_optimization_count integer;

-- Reanalysis must reuse the retained Supabase video and start at the new input-ready stage.
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
begin
  select * into target from public.analysis_sessions where id = p_session_id and user_id = p_user_id for update;
  if not found then return 'not_found'; end if;
  if target.duration_ms is null or (target.video_path is null and target.analysis_video_path is null) then return 'video_missing'; end if;
  if target.status in ('uploading', 'queued', 'processing') then return 'busy'; end if;
  effective_declaration := coalesce(p_declaration, target.set_declaration);
  if effective_declaration is null then return 'declaration_required'; end if;

  delete from public.analysis_results where session_id = p_session_id;
  delete from public.analysis_stage_runs where session_id = p_session_id;
  delete from public.model_call_telemetry where session_id = p_session_id;

  update public.analysis_sessions
  set status = 'queued',
      stage = 'input_ready',
      pipeline_version = null,
      gemini_file_name = null,
      gemini_file_uri = null,
      gemini_file_state = null,
      set_declaration = effective_declaration,
      detected_label = effective_declaration #>> '{exercise,label}',
      detected_variation = null,
      detected_equipment = '[]'::jsonb,
      recognition_confidence = 1,
      recognition_alternatives = '[]'::jsonb,
      analysis_draft = null,
      analysis_review_request_v1 = null,
      analysis_review_result_v1 = null,
      correction_audit_v1 = null,
      writer_result_v2 = null,
      stage_attempts_v3 = '{}'::jsonb,
      exact_frame_requests = '[]'::jsonb,
      exact_frame_manifest = '[]'::jsonb,
      exact_frames_requested_at = null,
      analysis_input_transport = null,
      analysis_input_byte_length = null,
      analysis_input_preparation_ms = null,
      analysis_upload_duration_ms = null,
      analysis_total_duration_ms = null,
      analysis_model_call_count = null,
      analysis_correction_count = null,
      analysis_optimization_count = null,
      failure_code = null,
      completed_at = null,
      analysis_started_at = null,
      updated_at = now()
  where id = p_session_id and user_id = p_user_id;
  return 'ready';
end;
$$;

revoke all on function public.reset_analysis_for_reanalysis(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reset_analysis_for_reanalysis(uuid, uuid, jsonb) to service_role;

alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_analysis_review_request_v1_object,
  add constraint analysis_sessions_analysis_review_request_v1_object
    check (analysis_review_request_v1 is null or jsonb_typeof(analysis_review_request_v1) = 'object'),
  drop constraint if exists analysis_sessions_analysis_review_result_v1_object,
  add constraint analysis_sessions_analysis_review_result_v1_object
    check (analysis_review_result_v1 is null or jsonb_typeof(analysis_review_result_v1) = 'object'),
  drop constraint if exists analysis_sessions_analysis_input_byte_length_check,
  add constraint analysis_sessions_analysis_input_byte_length_check
    check (analysis_input_byte_length is null or analysis_input_byte_length > 0),
  drop constraint if exists analysis_sessions_analysis_input_transport_check,
  add constraint analysis_sessions_analysis_input_transport_check
    check (analysis_input_transport is null or analysis_input_transport in ('inline', 'file')),
  drop constraint if exists analysis_sessions_analysis_timing_metrics_check,
  add constraint analysis_sessions_analysis_timing_metrics_check check (
    (analysis_input_preparation_ms is null or analysis_input_preparation_ms >= 0)
    and (analysis_upload_duration_ms is null or analysis_upload_duration_ms >= 0)
    and (analysis_total_duration_ms is null or analysis_total_duration_ms >= 0)
    and (analysis_model_call_count is null or analysis_model_call_count >= 0)
    and (analysis_correction_count is null or analysis_correction_count >= 0)
    and (analysis_optimization_count is null or analysis_optimization_count >= 0)
  );

alter table public.analysis_stage_runs
  drop constraint if exists analysis_stage_runs_stage_check,
  add constraint analysis_stage_runs_stage_check
    check (stage in ('indexing', 'rubric_ready', 'analyzing', 'validating_candidates', 'verifying', 'extracting_display_frames', 'scoring', 'writing_coaching', 'reviewing_clip', 'finalizing')),
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz;

-- The single-upload client records the compact full-duration artifact as a
-- capture-ready input. Extend the pre-existing strategy/check pair before
-- complete-upload attempts to persist that value.
alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_input_strategy_check,
  drop constraint if exists analysis_sessions_preprocessing_consistency;

alter table public.analysis_sessions
  add constraint analysis_sessions_input_strategy_check
    check (analysis_input_strategy in ('video', 'trimmed_crop', 'upright_video', 'capture_ready_video')),
  add constraint analysis_sessions_preprocessing_consistency check (
    (
      analysis_input_strategy = 'video'
      and analysis_video_path is null
      and analysis_duration_ms is null
      and analysis_source_start_ms is null
      and analysis_source_end_ms is null
      and analysis_crop is null
      and analysis_preprocessing_confidence is null
    )
    or
    (
      analysis_input_strategy = 'trimmed_crop'
      and analysis_video_path is not null
      and analysis_duration_ms between 3000 and 45000
      and analysis_source_start_ms >= 0
      and analysis_source_end_ms > analysis_source_start_ms
      and analysis_duration_ms = analysis_source_end_ms - analysis_source_start_ms
      and jsonb_typeof(analysis_crop) = 'object'
      and analysis_preprocessing_confidence between 0.9 and 1
    )
    or
    (
      analysis_input_strategy in ('upright_video', 'capture_ready_video')
      and analysis_video_path is not null
      and analysis_duration_ms = duration_ms
      and analysis_source_start_ms = 0
      and analysis_source_end_ms = duration_ms
      and analysis_crop is null
      and analysis_preprocessing_confidence = 1
    )
  );

create index if not exists analysis_stage_runs_active_lease_idx
  on public.analysis_stage_runs(session_id, pipeline_version, stage, status, lease_expires_at);

create or replace function public.claim_analysis_stage(
  p_session_id uuid,
  p_pipeline_version text,
  p_stage text,
  p_input_checksum text,
  p_lease_seconds integer default 60
)
returns table(result_status text, stage_run_id uuid, lease_token uuid, output jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.analysis_stage_runs%rowtype;
  next_token uuid := gen_random_uuid();
begin
  if p_lease_seconds < 5 or p_lease_seconds > 300 then
    raise exception 'invalid lease duration';
  end if;

  -- Attempt the insert first. ON CONFLICT waits for a concurrent claimant
  -- and then falls through to the locked row, so polling cannot turn a race
  -- into a unique-constraint failure or a duplicate model call.
  insert into public.analysis_stage_runs(
    session_id, pipeline_version, stage, input_checksum, status, attempt,
    lease_token, lease_expires_at, started_at, updated_at
  ) values (
    p_session_id, p_pipeline_version, p_stage, p_input_checksum, 'running', 0,
    next_token, now() + make_interval(secs => p_lease_seconds), now(), now()
  )
  on conflict (session_id, pipeline_version, stage, input_checksum) do nothing
  returning * into existing;

  if found then
    return query select 'claimed', existing.id, next_token, null::jsonb;
    return;
  end if;

  select * into existing
  from public.analysis_stage_runs
  where session_id = p_session_id
    and pipeline_version = p_pipeline_version
    and stage = p_stage
    and input_checksum = p_input_checksum
  for update;

  if found and existing.status = 'succeeded' then
    return query select 'succeeded', existing.id, existing.lease_token, existing.output;
    return;
  end if;

  if found
    and existing.status = 'running'
    and existing.lease_expires_at is not null
    and existing.lease_expires_at > now()
  then
    return query select 'busy', existing.id, existing.lease_token, existing.output;
    return;
  end if;

  if found then
    update public.analysis_stage_runs
    set status = 'running',
        attempt = least(attempt + 1, 2),
        lease_token = next_token,
        lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        started_at = now(),
        completed_at = null,
        error_code = null,
        updated_at = now()
    where id = existing.id;
    return query select 'claimed', existing.id, next_token, null::jsonb;
    return;
  end if;

  raise exception 'analysis stage claim row disappeared';
end;
$$;

create or replace function public.complete_analysis_stage(
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
  update public.analysis_stage_runs
  set status = 'succeeded',
      output = p_output,
      completed_at = now(),
      lease_expires_at = null,
      updated_at = now()
  where id = p_stage_run_id
    and status = 'running'
    and lease_token = p_lease_token;
  return found;
end;
$$;

revoke all on function public.claim_analysis_stage(uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.complete_analysis_stage(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.claim_analysis_stage(uuid, text, text, text, integer) to service_role;
grant execute on function public.complete_analysis_stage(uuid, uuid, jsonb) to service_role;

comment on column public.analysis_sessions.analysis_input_transport is 'v37 transport: retained video uploaded through the Gemini Files API.';
comment on column public.analysis_sessions.analysis_review_request_v1 is 'At most one model-selected 1-4 second replay request for the v37 whole-video analyst.';
comment on column public.analysis_sessions.analysis_input_preparation_ms is 'Elapsed server time to download the retained video, upload it to Gemini Files, and reach an active input.';
comment on column public.analysis_sessions.analysis_upload_duration_ms is 'Server-observed upload lifecycle duration from session creation to complete-upload.';
comment on column public.analysis_sessions.analysis_total_duration_ms is 'Elapsed analysis duration from analysis_started_at through final result persistence.';
comment on column public.analysis_sessions.analysis_model_call_count is 'Count of analyst, replay, and writer model calls recorded for this run.';
comment on column public.analysis_sessions.analysis_correction_count is 'Number of genuine correction cards in the persisted result.';
comment on column public.analysis_sessions.analysis_optimization_count is 'Number of independently supported video-specific optimization cards in the persisted result.';
