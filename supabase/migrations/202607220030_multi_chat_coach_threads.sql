alter table public.coach_threads
  drop constraint if exists coach_threads_user_id_session_id_key;

alter table public.coach_threads
  add column if not exists title text
  check (title is null or char_length(title) between 1 and 120);

create index if not exists coach_threads_user_session_updated_idx
  on public.coach_threads (user_id, session_id, updated_at desc);

grant update, delete on public.coach_threads to authenticated;

create or replace function public.reset_analysis_for_reanalysis(p_session_id uuid, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare target public.analysis_sessions%rowtype;
begin
  select * into target
  from public.analysis_sessions
  where id = p_session_id and user_id = p_user_id
  for update;

  if not found then return 'not_found'; end if;
  if target.video_path is null or target.duration_ms is null then return 'video_missing'; end if;
  if target.status in ('uploading', 'queued', 'processing') then return 'busy'; end if;

  delete from public.analysis_results where session_id = p_session_id;
  delete from public.analysis_stage_runs where session_id = p_session_id;
  delete from public.model_call_telemetry where session_id = p_session_id;

  update public.analysis_sessions
  set
    status = 'queued', stage = 'video_processing', pipeline_version = null,
    exercise_id = null, exercise_family = null, exercise_variant_v2_id = null,
    camera_view = null, detected_label = null, detected_variation = null,
    detected_equipment = '[]'::jsonb, recognition_confidence = 0,
    recognition_alternatives = '[]'::jsonb, corrected_label = null,
    corrected_exercise_id = null, gemini_file_name = null, gemini_file_uri = null,
    gemini_file_state = null, model_name = null, preflight_check = null,
    preflight_checked_at = null, analysis_draft = null,
    video_index_v2 = null, resolved_rubric_v2 = null,
    candidate_findings_v2 = null, criterion_assessments_v2 = null,
    verification_decisions_v2 = null, verified_findings_v2 = null,
    writer_result_v2 = null,
    exact_frame_requests = '[]'::jsonb, exact_frame_manifest = '[]'::jsonb,
    exact_frames_requested_at = null, analysis_input_strategy = 'video',
    tutorial_video = null, failure_code = null, completed_at = null, updated_at = now()
  where id = p_session_id and user_id = p_user_id;

  return 'ready';
end;
$$;

revoke all on function public.reset_analysis_for_reanalysis(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reset_analysis_for_reanalysis(uuid, uuid) to service_role;
