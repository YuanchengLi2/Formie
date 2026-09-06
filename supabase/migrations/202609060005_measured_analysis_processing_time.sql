-- Processing time is a worker-runtime metric. Session wall time includes upload,
-- retries, backgrounding, and abandoned sessions, so it can overstate runtime by
-- days. Prefer the server-observed analysis duration and expose its coverage.
create or replace function public.get_founder_business_dashboard_v10(
  p_section text default 'overview',p_window text default '30d',p_start date default null,p_end date default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  result jsonb;
  growth jsonb;
  start_at timestamptz;
  end_at timestamptz;
  observed timestamptz;
  eligible_sessions numeric;
  measured_sessions numeric;
  processing_ms numeric;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;

  result:=public.get_founder_business_dashboard_v9(p_section,p_window,p_start,p_end);
  growth:=coalesce(result->'growth','{}'::jsonb);
  growth:=jsonb_set(growth,'{retentionByAcquisition}',public.business_recalculate_cohort_percentages(growth->'retentionByAcquisition'));
  growth:=jsonb_set(growth,'{retentionByCreator}',public.business_recalculate_cohort_percentages(growth->'retentionByCreator'));
  growth:=jsonb_set(growth,'{retentionByExperience}',public.business_recalculate_cohort_percentages(growth->'retentionByExperience'));
  growth:=jsonb_set(growth,'{retentionByGoal}',public.business_recalculate_cohort_percentages(growth->'retentionByGoal'));
  growth:=jsonb_set(growth,'{bonusComparison}',public.business_recalculate_cohort_percentages(growth->'bonusComparison'));
  growth:=jsonb_set(growth,'{firstWeekAnalysisDepth}',public.business_recalculate_cohort_percentages(growth->'firstWeekAnalysisDepth'));
  result:=jsonb_set(result,'{growth}',growth);

  start_at:=coalesce((result->>'rangeStart')::timestamptz,'-infinity'::timestamptz);
  end_at:=(result->>'rangeEnd')::timestamptz;
  observed:=nullif(result#>>'{metrics,processingTime,observedSince}','')::timestamptz;

  select count(*),count(session.analysis_total_duration_ms),avg(session.analysis_total_duration_ms)
    into eligible_sessions,measured_sessions,processing_ms
  from public.analysis_sessions session
  join public.business_customer_accounts account on account.id=session.user_id
  where session.status in ('complete','partial')
    and coalesce(session.completed_at,session.updated_at)>=start_at
    and coalesce(session.completed_at,session.updated_at)<end_at
    and not exists(select 1 from public.business_test_accounts test where test.user_id=session.user_id);

  result:=jsonb_set(result,'{metrics,processingTime}',public.business_metric(
    case when measured_sessions=0 then null else round(processing_ms,0) end,
    'milliseconds',
    case when measured_sessions=0 then 'unavailable' when measured_sessions<eligible_sessions then 'incomplete' else 'exact' end,
    'not_applicable',null,measured_sessions,eligible_sessions,observed,
    'Average server-observed analysis runtime for successful sessions in the selected window.'
  ));
  return result;
end $$;

revoke all on function public.get_founder_business_dashboard_v10(text,text,date,date) from public,anon,authenticated;
grant execute on function public.get_founder_business_dashboard_v10(text,text,date,date) to service_role;
