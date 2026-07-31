alter table public.analysis_sessions
  add column if not exists correction_audit_v1 jsonb;

alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_correction_audit_v1_check;

alter table public.analysis_sessions
  add constraint analysis_sessions_correction_audit_v1_check
  check (
    correction_audit_v1 is null
    or (
      jsonb_typeof(correction_audit_v1) = 'object'
      and correction_audit_v1 ?& array['status', 'initialCorrectionCount', 'supplementalCorrectionCount', 'result']
      and (correction_audit_v1 - array['status', 'initialCorrectionCount', 'supplementalCorrectionCount', 'result']::text[]) = '{}'::jsonb
      and correction_audit_v1->>'status' in ('skipped', 'complete')
      and jsonb_typeof(correction_audit_v1->'initialCorrectionCount') = 'number'
      and jsonb_typeof(correction_audit_v1->'supplementalCorrectionCount') = 'number'
      and (correction_audit_v1->>'initialCorrectionCount')::integer >= 0
      and (correction_audit_v1->>'supplementalCorrectionCount')::integer >= 0
      and (
        (correction_audit_v1->>'status' = 'skipped' and correction_audit_v1->'result' = 'null'::jsonb)
        or (correction_audit_v1->>'status' = 'complete' and jsonb_typeof(correction_audit_v1->'result') = 'object')
      )
    )
  );

comment on column public.analysis_sessions.correction_audit_v1 is
  'Validated conditional correction-coverage audit metadata for gemini-coverage-audit-v2.';

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
    preflight_checked_at = null, analysis_draft = null, correction_audit_v1 = null,
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
