-- v46 removes movement boundaries from the public analysis contract.
-- Historical rows remain readable through the legacy result adapter.

alter table public.analysis_sessions
  add column if not exists analysis_retry_count integer not null default 0,
  add column if not exists analysis_next_retry_at timestamptz,
  add column if not exists analysis_last_error_code text;

alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_analysis_retry_count_check,
  add constraint analysis_sessions_analysis_retry_count_check
    check (analysis_retry_count >= 0);

alter table public.analysis_results
  add column if not exists analysis_basis text not null default 'observed',
  add column if not exists view_notes jsonb not null default '[]'::jsonb,
  add column if not exists general_guidance jsonb not null default '[]'::jsonb;

alter table public.analysis_results
  drop constraint if exists analysis_results_analysis_basis_check,
  add constraint analysis_results_analysis_basis_check
    check (analysis_basis in ('observed', 'mixed', 'declared_only')),
  drop constraint if exists analysis_results_view_notes_array,
  add constraint analysis_results_view_notes_array
    check (jsonb_typeof(view_notes) = 'array'),
  drop constraint if exists analysis_results_general_guidance_array,
  add constraint analysis_results_general_guidance_array
    check (jsonb_typeof(general_guidance) = 'array');

alter table public.analysis_stage_runs
  drop constraint if exists analysis_stage_runs_stage_check,
  add constraint analysis_stage_runs_stage_check
    check (stage in ('analyzing', 'finalizing'));

-- Replace the historical two-attempt lease cap.  A retryable provider or
-- contract failure keeps the session in processing/retry_wait and can be
-- reclaimed indefinitely by the durable retry worker.
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
as $function$
declare
  existing public.analysis_stage_runs%rowtype;
  next_token uuid := gen_random_uuid();
begin
  if p_lease_seconds < 5 or p_lease_seconds > 300 then
    raise exception 'invalid lease duration';
  end if;

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
        attempt = attempt + 1,
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
$function$;

revoke all on function public.claim_analysis_stage(uuid, text, text, text, integer)
from public, anon, authenticated;
grant execute on function public.claim_analysis_stage(uuid, text, text, text, integer)
to service_role;

comment on function public.claim_analysis_stage(uuid, text, text, text, integer) is
  'Claims analyzing/finalizing leases with unbounded v46 retry attempts.';

-- The retry worker uses the same pg_cron/pg_net/vault infrastructure as the
-- existing retention worker. Call this once with the project URL and a
-- 32-character secret after deploying the edge function.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function public.configure_analysis_retry_worker(
  p_project_url text,
  p_cron_secret text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  project_secret_id uuid;
  cron_secret_id uuid;
  existing_job_id bigint;
begin
  if p_project_url !~ '^https://[a-z0-9-]+\.supabase\.co$' then
    raise exception 'Invalid project URL';
  end if;
  if char_length(p_cron_secret) < 32 then
    raise exception 'Retry secret is too short';
  end if;

  -- Reuse the retention worker's vault values so the deployed edge function
  -- can validate the same RETENTION_CLEANUP_SECRET without a second secret.
  select id into project_secret_id
  from vault.decrypted_secrets
  where name = 'form_retention_project_url'
  limit 1;
  if project_secret_id is null then
    perform vault.create_secret(p_project_url, 'form_retention_project_url', 'FORM retention cleanup project URL');
  else
    perform vault.update_secret(project_secret_id, p_project_url, 'form_retention_project_url', 'FORM retention cleanup project URL');
  end if;

  select id into cron_secret_id
  from vault.decrypted_secrets
  where name = 'form_retention_cron_secret'
  limit 1;
  if cron_secret_id is null then
    perform vault.create_secret(p_cron_secret, 'form_retention_cron_secret', 'FORM retention cleanup authentication');
  else
    perform vault.update_secret(cron_secret_id, p_cron_secret, 'form_retention_cron_secret', 'FORM retention cleanup authentication');
  end if;

      for existing_job_id in
        select jobid from cron.job where jobname in ('form-analysis-retry-minute', 'form-analysis-retry-fast')
      loop
        perform cron.unschedule(existing_job_id);
      end loop;

      perform cron.schedule(
        'form-analysis-retry-fast',
        '5 seconds',
    $command$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'form_retention_project_url')
          || '/functions/v1/retry-analysis',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'form_retention_cron_secret')
        ),
        body := '{}'::jsonb
      ) as request_id;
    $command$
  );
end;
$function$;

revoke all on function public.configure_analysis_retry_worker(text, text)
from public, anon, authenticated;
grant execute on function public.configure_analysis_retry_worker(text, text)
to service_role;

-- New v46 writes are always complete. Keep the old status values in the table
-- so historical sessions can still be opened and migrated deliberately.
comment on column public.analysis_sessions.analysis_retry_count is
  'Durable v46 retry count. It has no terminal attempt limit.';
comment on column public.analysis_sessions.analysis_next_retry_at is
  'Next retry time for provider or contract failures; null after completion.';
comment on column public.analysis_sessions.analysis_last_error_code is
  'Private diagnostic code for the latest retryable analysis failure.';

create or replace function public.commit_analysis_result_v2(
  p_session_id uuid,
  p_session jsonb,
  p_result jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.commit_analysis_result(
    p_session_id,
    p_session,
    case
      when p_result -> 'comparison' = 'null'::jsonb then p_result - 'comparison'
      else p_result
    end || jsonb_build_object(
      -- These legacy storage columns remain only so historical rows can be
      -- opened. v46 never exposes them or accepts them from the analyst.
      'video_check', jsonb_build_object(
        'outcome', 'usable',
        'usableObservations', '[]'::jsonb,
        'limitations', '[]'::jsonb,
        'retryReason', null,
        'retryInstruction', null
      ),
      'rep_timeline', '[]'::jsonb
    )
  );

  update public.analysis_results
  set
    exercise_guide = nullif(p_result -> 'exercise_guide', 'null'::jsonb),
    coaching_coverage = coalesce(p_result -> 'coaching_coverage', '[]'::jsonb),
    analysis_basis = coalesce(p_result ->> 'analysis_basis', 'observed'),
    view_notes = coalesce(p_result -> 'view_notes', '[]'::jsonb),
    general_guidance = coalesce(p_result -> 'general_guidance', '[]'::jsonb)
  where session_id = p_session_id;

  update public.analysis_sessions
  set stage = 'finalizing', updated_at = now()
  where id = p_session_id;
end;
$$;

revoke all on function public.commit_analysis_result_v2(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_analysis_result_v2(uuid, jsonb, jsonb) to service_role;

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
  select * into target
  from public.analysis_sessions
  where id = p_session_id and user_id = p_user_id
  for update;
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
      analysis_input_transport = null,
      analysis_input_byte_length = null,
      analysis_input_preparation_ms = null,
      analysis_upload_duration_ms = null,
      analysis_total_duration_ms = null,
      analysis_model_call_count = null,
      analysis_correction_count = null,
      analysis_retry_count = 0,
      analysis_next_retry_at = null,
      analysis_last_error_code = null,
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

-- These fields are no longer read by the active v46 runtime. They are dropped
-- only after the v46 reset function above no longer references them.
-- The old bounded retry RPC is no longer callable by the v46 runtime and its
-- only state column is removed below.
drop function if exists public.record_analysis_stage_failure(uuid, text, text, integer);

alter table public.analysis_sessions
  drop column if exists foundation_result,
  drop column if exists tracker_status,
  drop column if exists keyframe_manifest,
  drop column if exists stage_attempts_v3,
  drop column if exists exact_frame_requests,
  drop column if exists exact_frame_manifest,
  drop column if exists exact_frames_requested_at,
  drop column if exists pose_artifact_path,
  drop column if exists pose_manifest,
  drop column if exists pose_query_plan,
  drop column if exists pose_query_results,
  drop column if exists pose_queries_completed_at,
  drop column if exists video_index_v2,
  drop column if exists resolved_rubric_v2,
  drop column if exists candidate_findings_v2,
  drop column if exists criterion_assessments_v2,
  drop column if exists verification_decisions_v2,
  drop column if exists verified_findings_v2,
  drop column if exists catalog_match_v3;

comment on function public.commit_analysis_result_v2(uuid, jsonb, jsonb) is
  'Atomically persists a validated boundary-free v46 result.';

comment on column public.analysis_sessions.analysis_input_transport is
  'v46 transport for the retained recording uploaded through the Gemini Files API.';
comment on column public.analysis_sessions.analysis_input_preparation_ms is
  'Elapsed server time to prepare the retained recording and reach an active Gemini input.';
comment on column public.analysis_sessions.analysis_upload_duration_ms is
  'Server-observed upload lifecycle duration from session creation to complete-upload.';
comment on column public.analysis_sessions.analysis_total_duration_ms is
  'Elapsed time from the first v46 analysis invocation through durable result persistence.';
comment on column public.analysis_sessions.analysis_model_call_count is
  'Number of v46 full-video and declaration-only fallback model calls, including retries.';
comment on column public.analysis_sessions.analysis_correction_count is
  'Number of evidence-backed correction cards in the persisted v46 result.';
