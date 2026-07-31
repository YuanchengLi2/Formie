alter table public.analysis_sessions
  add column if not exists analysis_fallback_video_path text,
  add column if not exists analysis_input_variant text not null default 'primary';

alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_input_variant_check;

alter table public.analysis_sessions
  add constraint analysis_sessions_input_variant_check
  check (
    analysis_input_variant = 'primary'
    or (
      analysis_input_variant = 'privacy_safe_upper_body'
      and analysis_fallback_video_path is not null
    )
  );

comment on column public.analysis_sessions.analysis_fallback_video_path is
  'Optional full-duration privacy-safe analysis artifact; the original and primary analysis input remain unchanged.';
comment on column public.analysis_sessions.analysis_input_variant is
  'Persisted Gemini input choice. It changes only after a precise provider content block.';

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
  if target.video_path is null or target.duration_ms is null then return 'video_missing'; end if;
  if target.status in ('uploading', 'queued', 'processing') then return 'busy'; end if;

  effective_declaration := coalesce(p_declaration, target.set_declaration);
  if effective_declaration is null then return 'declaration_required'; end if;

  delete from public.analysis_results where session_id = p_session_id;
  delete from public.analysis_stage_runs where session_id = p_session_id;
  delete from public.model_call_telemetry where session_id = p_session_id;

  update public.analysis_sessions
  set
    status = 'queued',
    stage = 'video_check',
    pipeline_version = null,
    stage_attempts_v3 = '{}'::jsonb,
    set_declaration = effective_declaration,
    exercise_id = null,
    exercise_family = null,
    exercise_variant_v2_id = case
      when effective_declaration #>> '{exercise,source}' = 'catalog'
        then (effective_declaration #>> '{exercise,catalogExerciseId}')::integer
      else null
    end,
    camera_view = null,
    detected_label = effective_declaration #>> '{exercise,label}',
    detected_variation = null,
    detected_equipment = '[]'::jsonb,
    recognition_confidence = 1,
    recognition_alternatives = '[]'::jsonb,
    corrected_label = null,
    corrected_exercise_id = null,
    analysis_input_variant = 'primary',
    gemini_file_name = null,
    gemini_file_uri = null,
    gemini_file_state = null,
    model_name = null,
    preflight_check = null,
    preflight_checked_at = null,
    analysis_draft = null,
    correction_audit_v1 = null,
    video_index_v2 = null,
    resolved_rubric_v2 = null,
    candidate_findings_v2 = null,
    criterion_assessments_v2 = null,
    verification_decisions_v2 = null,
    verified_findings_v2 = null,
    writer_result_v2 = null,
    exact_frame_requests = '[]'::jsonb,
    exact_frame_manifest = '[]'::jsonb,
    exact_frames_requested_at = null,
    tutorial_video = null,
    failure_code = null,
    completed_at = null,
    analysis_started_at = now(),
    updated_at = now()
  where id = p_session_id and user_id = p_user_id;

  return 'ready';
end;
$$;

revoke all on function public.reset_analysis_for_reanalysis(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reset_analysis_for_reanalysis(uuid, uuid, jsonb) to service_role;

comment on function public.reset_analysis_for_reanalysis(uuid, uuid, jsonb) is
  'Atomically requeues a saved upload from its primary input with fresh result, retry, telemetry, and timing state while preserving all saved video artifacts and declaration.';
