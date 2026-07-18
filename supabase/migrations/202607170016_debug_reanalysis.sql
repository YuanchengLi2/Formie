create or replace function public.reset_analysis_for_reanalysis(
  p_session_id uuid,
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.analysis_sessions%rowtype;
begin
  select *
  into target
  from public.analysis_sessions
  where id = p_session_id and user_id = p_user_id
  for update;

  if not found then
    return 'not_found';
  end if;

  if target.video_path is null or target.duration_ms is null then
    return 'video_missing';
  end if;

  if target.status in ('uploading', 'queued', 'processing') then
    return 'busy';
  end if;

  delete from public.coach_threads where session_id = p_session_id and user_id = p_user_id;
  delete from public.pose_artifacts where session_id = p_session_id;
  delete from public.analysis_jobs where session_id = p_session_id;
  delete from public.analysis_results where session_id = p_session_id;

  update public.analysis_sessions
  set
    status = 'queued',
    stage = 'video_check',
    exercise_id = null,
    exercise_family = null,
    camera_view = null,
    detected_label = null,
    detected_variation = null,
    detected_equipment = '[]'::jsonb,
    recognition_confidence = 0,
    recognition_alternatives = '[]'::jsonb,
    corrected_label = null,
    corrected_exercise_id = null,
    gemini_file_name = null,
    gemini_file_uri = null,
    gemini_file_state = null,
    model_name = null,
    preflight_check = null,
    preflight_checked_at = null,
    analysis_draft = null,
    pose_summary = null,
    tutorial_video = null,
    failure_code = null,
    completed_at = null,
    updated_at = now()
  where id = p_session_id and user_id = p_user_id;

  return 'ready';
end;
$$;

revoke all on function public.reset_analysis_for_reanalysis(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reset_analysis_for_reanalysis(uuid, uuid) to service_role;

comment on function public.reset_analysis_for_reanalysis(uuid, uuid) is
  'Atomically clears derived coaching data while preserving the original saved video for development reanalysis.';
