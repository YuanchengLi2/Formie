alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_duration_ms_check;

alter table public.analysis_sessions
  add constraint analysis_sessions_duration_ms_check
  check (duration_ms between 3000 and 45000);

alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_requested_fps_check;

alter table public.analysis_sessions
  alter column requested_fps set default 12;

update public.analysis_sessions
set requested_fps = 12
where requested_fps <> 12;

alter table public.analysis_sessions
  add constraint analysis_sessions_requested_fps_check
  check (requested_fps = 12);

create or replace function public.get_progress_metrics(requested_timezone text default 'UTC')
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  safe_timezone text := 'UTC';
  local_today date;
  latest_recording_day date;
  streak integer := 0;
  cursor_day date;
  average_score integer;
  best_exercise jsonb;
  biggest_improvement jsonb;
begin
  if viewer_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = requested_timezone
  ) then
    safe_timezone := requested_timezone;
  end if;

  local_today := (now() at time zone safe_timezone)::date;

  select max((session.created_at at time zone safe_timezone)::date)
  into latest_recording_day
  from public.analysis_sessions session
  where session.user_id = viewer_id
    and session.video_path is not null;

  if latest_recording_day in (local_today, local_today - 1) then
    cursor_day := latest_recording_day;
    while exists (
      select 1
      from public.analysis_sessions session
      where session.user_id = viewer_id
        and session.video_path is not null
        and (session.created_at at time zone safe_timezone)::date = cursor_day
    ) loop
      streak := streak + 1;
      cursor_day := cursor_day - 1;
    end loop;
  end if;

  select round(avg(result.score))::integer
  into average_score
  from public.analysis_sessions session
  join public.analysis_results result on result.session_id = session.id
  where session.user_id = viewer_id
    and result.score is not null;

  with family_scores as (
    select
      session.exercise_family,
      round(avg(result.score))::integer as average_score,
      count(*)::integer as scored_sessions,
      max(session.created_at) as latest_activity
    from public.analysis_sessions session
    join public.analysis_results result on result.session_id = session.id
    where session.user_id = viewer_id
      and session.exercise_family is not null
      and result.score is not null
    group by session.exercise_family
  )
  select jsonb_build_object(
    'family', family_scores.exercise_family,
    'label', initcap(replace(family_scores.exercise_family, '-', ' ')),
    'averageScore', family_scores.average_score,
    'scoredSessions', family_scores.scored_sessions
  )
  into best_exercise
  from family_scores
  order by family_scores.average_score desc, family_scores.scored_sessions desc, family_scores.latest_activity desc, family_scores.exercise_family asc
  limit 1;

  with ordered_scores as (
    select
      session.exercise_family,
      result.score,
      row_number() over (
        partition by session.exercise_family
        order by session.created_at asc, session.id asc
      ) as ascending_position,
      row_number() over (
        partition by session.exercise_family
        order by session.created_at desc, session.id desc
      ) as descending_position,
      count(*) over (partition by session.exercise_family) as scored_sessions,
      max(session.created_at) over (partition by session.exercise_family) as latest_activity
    from public.analysis_sessions session
    join public.analysis_results result on result.session_id = session.id
    where session.user_id = viewer_id
      and session.exercise_family is not null
      and result.score is not null
  ),
  improvements as (
    select
      exercise_family,
      max(score) filter (where ascending_position = 1) as first_score,
      max(score) filter (where descending_position = 1) as latest_score,
      max(scored_sessions) as scored_sessions,
      max(latest_activity) as latest_activity
    from ordered_scores
    group by exercise_family
  )
  select jsonb_build_object(
    'family', improvements.exercise_family,
    'label', initcap(replace(improvements.exercise_family, '-', ' ')),
    'points', round(improvements.latest_score - improvements.first_score)::integer,
    'firstScore', improvements.first_score,
    'latestScore', improvements.latest_score
  )
  into biggest_improvement
  from improvements
  where scored_sessions >= 2
    and latest_score > first_score
  order by
    (latest_score - first_score) desc,
    latest_activity desc,
    exercise_family asc
  limit 1;

  return jsonb_build_object(
    'currentStreakDays', streak,
    'averageScore', average_score,
    'bestExercise', best_exercise,
    'biggestImprovement', biggest_improvement
  );
end;
$$;

revoke all on function public.get_progress_metrics(text) from public;
revoke all on function public.get_progress_metrics(text) from anon;
grant execute on function public.get_progress_metrics(text) to authenticated;
