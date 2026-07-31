-- criteria-pipeline-v2 storage accepts the original video and exact display frames only.
update storage.buckets
set allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg']
where id = 'analysis-videos';

alter table public.analysis_sessions
  add column if not exists pipeline_version text,
  add column if not exists exercise_variant_v2_id integer references public.exercise_variants_v2(id),
  add column if not exists video_index_v2 jsonb,
  add column if not exists resolved_rubric_v2 jsonb,
  add column if not exists candidate_findings_v2 jsonb,
  add column if not exists criterion_assessments_v2 jsonb,
  add column if not exists verification_decisions_v2 jsonb,
  add column if not exists verified_findings_v2 jsonb,
  add column if not exists writer_result_v2 jsonb,
  add column if not exists analysis_input_strategy text not null default 'video',
  add column if not exists exact_frame_requests jsonb not null default '[]'::jsonb,
  add column if not exists exact_frame_manifest jsonb not null default '[]'::jsonb,
  add column if not exists exact_frames_requested_at timestamptz;

alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_video_index_v2_object,
  add constraint analysis_sessions_video_index_v2_object check (video_index_v2 is null or jsonb_typeof(video_index_v2) = 'object'),
  drop constraint if exists analysis_sessions_resolved_rubric_v2_object,
  add constraint analysis_sessions_resolved_rubric_v2_object check (resolved_rubric_v2 is null or jsonb_typeof(resolved_rubric_v2) = 'object'),
  drop constraint if exists analysis_sessions_candidate_findings_v2_array,
  add constraint analysis_sessions_candidate_findings_v2_array check (candidate_findings_v2 is null or jsonb_typeof(candidate_findings_v2) = 'array'),
  drop constraint if exists analysis_sessions_criterion_assessments_v2_array,
  add constraint analysis_sessions_criterion_assessments_v2_array check (criterion_assessments_v2 is null or jsonb_typeof(criterion_assessments_v2) = 'array'),
  drop constraint if exists analysis_sessions_verification_decisions_v2_array,
  add constraint analysis_sessions_verification_decisions_v2_array check (verification_decisions_v2 is null or jsonb_typeof(verification_decisions_v2) = 'array'),
  drop constraint if exists analysis_sessions_verified_findings_v2_object,
  add constraint analysis_sessions_verified_findings_v2_object check (verified_findings_v2 is null or jsonb_typeof(verified_findings_v2) = 'object'),
  drop constraint if exists analysis_sessions_writer_result_v2_object,
  add constraint analysis_sessions_writer_result_v2_object check (writer_result_v2 is null or jsonb_typeof(writer_result_v2) = 'object');

alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_input_strategy_check;

update public.analysis_sessions
set analysis_input_strategy = 'video'
where analysis_input_strategy is distinct from 'video';

alter table public.analysis_sessions
  add constraint analysis_sessions_input_strategy_check check (analysis_input_strategy = 'video');

alter table public.analysis_results
  add column if not exists equipment_observations jsonb not null default '[]'::jsonb,
  add column if not exists empty_correction_message text,
  add column if not exists rubric_coverage jsonb,
  add column if not exists pipeline_version text not null default 'criteria-pipeline-v2';

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

  delete from public.coach_threads where session_id = p_session_id and user_id = p_user_id;
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

comment on column public.analysis_sessions.pipeline_version is 'Set to criteria-pipeline-v2 for the staged exact-rubric analysis path.';
comment on column public.analysis_sessions.verification_decisions_v2 is 'Internal claim-only decisions; never rendered as customer accepted, rejected, or unknown rows.';
