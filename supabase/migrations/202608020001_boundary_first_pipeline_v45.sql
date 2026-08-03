-- Boundary-first Gemini pipeline. Historical migrations remain immutable;
-- this migration removes only retired runtime state.

alter table public.model_call_telemetry
  add column if not exists estimated_cost_usd numeric;

alter table public.model_call_telemetry
  drop constraint if exists model_call_telemetry_estimated_cost_usd_check,
  add constraint model_call_telemetry_estimated_cost_usd_check
    check (estimated_cost_usd is null or estimated_cost_usd >= 0);

update public.analysis_sessions
set status = 'failed',
    stage = 'failed',
    failure_code = 'LEGACY_PIPELINE_RETIRED',
    updated_at = now()
where status in ('uploading', 'queued', 'processing')
  and pipeline_version is not null
  and pipeline_version <> 'gemini-whole-video-v45';

delete from public.analysis_stage_runs
where stage not in ('analyzing', 'correcting_boundaries', 'finalizing');

alter table public.analysis_stage_runs
  drop constraint if exists analysis_stage_runs_stage_check,
  add constraint analysis_stage_runs_stage_check
    check (stage in ('analyzing', 'correcting_boundaries', 'finalizing'));

alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_analysis_timing_metrics_check;

alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_analysis_review_request_v1_object,
  drop constraint if exists analysis_sessions_analysis_review_result_v1_object,
  drop constraint if exists analysis_sessions_correction_audit_v1_check,
  drop constraint if exists analysis_sessions_writer_result_v2_object,
  drop constraint if exists analysis_sessions_analysis_contradictions_check,
  drop column if exists analysis_review_request_v1,
  drop column if exists analysis_review_result_v1,
  drop column if exists correction_audit_v1,
  drop column if exists writer_result_v2,
  drop column if exists analysis_contradictions,
  drop column if exists analysis_optimization_count;

alter table public.analysis_sessions
  add constraint analysis_sessions_analysis_timing_metrics_check check (
    (analysis_input_preparation_ms is null or analysis_input_preparation_ms >= 0)
    and (analysis_upload_duration_ms is null or analysis_upload_duration_ms >= 0)
    and (analysis_total_duration_ms is null or analysis_total_duration_ms >= 0)
    and (analysis_model_call_count is null or analysis_model_call_count >= 0)
    and (analysis_correction_count is null or analysis_correction_count >= 0)
  );

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

comment on column public.model_call_telemetry.estimated_cost_usd is
  'Paid-tier Gemini 3.6 Flash estimate using prompt tokens plus output and thinking tokens.';
comment on column public.analysis_sessions.analysis_model_call_count is
  'One initial Gemini call, plus at most one targeted boundary-correction call.';
