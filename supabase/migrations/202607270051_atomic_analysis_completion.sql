create or replace function public.commit_analysis_result(
  p_session_id uuid,
  p_session jsonb,
  p_result jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.analysis_sessions%rowtype;
  result_status text;
begin
  if jsonb_typeof(p_session) <> 'object' or jsonb_typeof(p_result) <> 'object' then
    raise exception 'analysis completion payloads must be objects';
  end if;

  result_status := p_result ->> 'status';
  if result_status not in ('complete', 'partial', 'unable') then
    raise exception 'invalid analysis result status';
  end if;

  select * into target
  from public.analysis_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'analysis session not found';
  end if;

  insert into public.analysis_results (
    session_id,
    status,
    video_check,
    overall_assessment,
    muscle_focus,
    coach_note,
    score,
    score_rationale,
    movement_scores,
    equipment_observations,
    did_well,
    priority_corrections,
    coaching_cues,
    set_context,
    set_summary,
    rep_timeline,
    next_set_plan,
    empty_correction_message,
    rubric_coverage,
    pipeline_version,
    comparison,
    analysis_version
  )
  values (
    p_session_id,
    result_status,
    p_result -> 'video_check',
    p_result ->> 'overall_assessment',
    coalesce(p_result -> 'muscle_focus', '{}'::jsonb),
    p_result ->> 'coach_note',
    nullif(p_result ->> 'score', '')::numeric,
    coalesce(p_result -> 'score_rationale', '[]'::jsonb),
    coalesce(p_result -> 'movement_scores', '[]'::jsonb),
    coalesce(p_result -> 'equipment_observations', '[]'::jsonb),
    coalesce(p_result -> 'did_well', '[]'::jsonb),
    coalesce(p_result -> 'priority_corrections', '[]'::jsonb),
    coalesce(p_result -> 'coaching_cues', '[]'::jsonb),
    coalesce(p_result -> 'set_context', '{}'::jsonb),
    coalesce(p_result -> 'set_summary', '{}'::jsonb),
    coalesce(p_result -> 'rep_timeline', '[]'::jsonb),
    coalesce(p_result -> 'next_set_plan', '[]'::jsonb),
    p_result ->> 'empty_correction_message',
    p_result -> 'rubric_coverage',
    p_result ->> 'pipeline_version',
    p_result -> 'comparison',
    p_result ->> 'analysis_version'
  )
  on conflict (session_id) do update set
    status = excluded.status,
    video_check = excluded.video_check,
    overall_assessment = excluded.overall_assessment,
    muscle_focus = excluded.muscle_focus,
    coach_note = excluded.coach_note,
    score = excluded.score,
    score_rationale = excluded.score_rationale,
    movement_scores = excluded.movement_scores,
    equipment_observations = excluded.equipment_observations,
    did_well = excluded.did_well,
    priority_corrections = excluded.priority_corrections,
    coaching_cues = excluded.coaching_cues,
    set_context = excluded.set_context,
    set_summary = excluded.set_summary,
    rep_timeline = excluded.rep_timeline,
    next_set_plan = excluded.next_set_plan,
    empty_correction_message = excluded.empty_correction_message,
    rubric_coverage = excluded.rubric_coverage,
    pipeline_version = excluded.pipeline_version,
    comparison = excluded.comparison,
    analysis_version = excluded.analysis_version;

  update public.analysis_sessions
  set
    status = result_status,
    stage = 'coaching',
    pipeline_version = p_session ->> 'pipeline_version',
    exercise_family = p_session ->> 'exercise_family',
    exercise_variant_v2_id = nullif(p_session ->> 'exercise_variant_v2_id', '')::integer,
    detected_label = p_session ->> 'detected_label',
    detected_variation = p_session ->> 'detected_variation',
    detected_equipment = coalesce(p_session -> 'detected_equipment', '[]'::jsonb),
    recognition_confidence = coalesce((p_session ->> 'recognition_confidence')::numeric, 0),
    recognition_alternatives = coalesce(p_session -> 'recognition_alternatives', '[]'::jsonb),
    model_name = p_session ->> 'model_name',
    failure_code = null,
    completed_at = now(),
    updated_at = now()
  where id = p_session_id;
end;
$$;

revoke all on function public.commit_analysis_result(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_analysis_result(uuid, jsonb, jsonb) to service_role;

comment on function public.commit_analysis_result(uuid, jsonb, jsonb) is
  'Atomically persists a validated public analysis result before exposing the session as complete.';
