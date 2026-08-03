-- Restore the pre-v49 reanalysis contract while retaining v49 runs as
-- read-only rollback evidence. New work is routed to analyze-video v48.
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
  if target.duration_ms > 15000 then return 'video_too_long'; end if;
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
      active_v49_run_id = null,
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
