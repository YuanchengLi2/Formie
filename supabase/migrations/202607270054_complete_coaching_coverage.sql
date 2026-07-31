alter table public.analysis_results
  add column if not exists exercise_guide jsonb,
  add column if not exists coaching_coverage jsonb not null default '[]'::jsonb;

alter table public.analysis_results
  drop constraint if exists analysis_results_exercise_guide_shape,
  drop constraint if exists analysis_results_coaching_coverage_shape;

alter table public.analysis_results
  add constraint analysis_results_exercise_guide_shape
    check (exercise_guide is null or jsonb_typeof(exercise_guide) = 'object'),
  add constraint analysis_results_coaching_coverage_shape
    check (jsonb_typeof(coaching_coverage) = 'array');

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
    end
  );

  update public.analysis_results
  set
    exercise_guide = nullif(p_result -> 'exercise_guide', 'null'::jsonb),
    coaching_coverage = coalesce(p_result -> 'coaching_coverage', '[]'::jsonb)
  where session_id = p_session_id;
end;
$$;

comment on column public.analysis_results.exercise_guide is
  'Evidence-grounded setup and execution steps for the analyzed exercise.';

comment on column public.analysis_results.coaching_coverage is
  'Six-domain audit covering surroundings, equipment, grip, start position, execution, and support.';
