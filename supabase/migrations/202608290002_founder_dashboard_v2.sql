create table if not exists public.founder_reporting_config (
  key text not null,
  effective_from timestamptz not null,
  numeric_value numeric not null,
  primary key (key, effective_from)
);
insert into public.founder_reporting_config(key,effective_from,numeric_value)
values ('app_store_commission_rate','2026-08-29T00:00:00Z',0.15)
on conflict (key,effective_from) do update set numeric_value=excluded.numeric_value;
alter table public.founder_reporting_config enable row level security;
revoke all on public.founder_reporting_config from public,anon,authenticated;
grant select on public.founder_reporting_config to service_role;

create or replace function public.founder_metric_v2(
  p_value numeric,p_quality text,p_numerator numeric,p_denominator numeric,
  p_observed_since timestamptz,p_detail text,p_scope text default 'filtered'
) returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object(
    'value',p_value,'quality',p_quality,'numerator',p_numerator,
    'denominator',p_denominator,'observedSince',p_observed_since,
    'detail',p_detail,'scope',p_scope
  );
$$;

create or replace function public.get_founder_dashboard_snapshot_v2(
  p_window text,p_exercise_id integer default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_start timestamptz;
  v_mobile_observed constant timestamptz := '2026-08-29T00:00:00Z';
  v_old jsonb;
  v_result jsonb;
  v_funnel jsonb := '[]'::jsonb;
  v_helpfulness jsonb := '[]'::jsonb;
  v_exercises jsonb := '[]'::jsonb;
  v_row record;
  v_signups numeric; v_total_users numeric; v_delivered numeric; v_active numeric;
  v_recordings numeric; v_recording_delivered numeric; v_signup_latency numeric;
  v_second_den numeric; v_same_session numeric;
  v_n7 numeric; v_y7 numeric; v_n14 numeric; v_y14 numeric; v_n30 numeric; v_y30 numeric;
  v_feedback_total numeric; v_helpful numeric;
  v_calls numeric; v_priced_calls numeric; v_ai_cost numeric;
  v_paid numeric; v_priced_paid numeric; v_mrr numeric; v_cancelling numeric;
  v_terminal numeric; v_failed numeric; v_unable numeric; v_median_latency numeric; v_p95_latency numeric;
  v_observed_since timestamptz;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_window not in ('24h','7d','30d','90d','all') then raise exception 'INVALID_WINDOW'; end if;
  if p_exercise_id is not null and p_exercise_id<=0 then raise exception 'INVALID_EXERCISE'; end if;
  v_start:=case p_window when '24h' then now()-interval '24 hours' when '7d' then now()-interval '7 days' when '30d' then now()-interval '30 days' when '90d' then now()-interval '90 days' else '-infinity'::timestamptz end;
  v_old:=public.get_founder_dashboard_snapshot();

  select count(*)::numeric,min(created_at) into v_total_users,v_observed_since from auth.users;
  select count(*)::numeric into v_signups from auth.users where created_at>=v_start;
  select count(*)::numeric,count(distinct user_id)::numeric into v_delivered,v_active
  from public.analysis_sessions
  where status in ('complete','partial') and coalesce(completed_at,created_at)>=v_start
    and (p_exercise_id is null or exercise_variant_v2_id=p_exercise_id);

  select count(distinct capture_flow_id)::numeric into v_recordings
  from public.product_analytics_events
  where event_name='recording_started' and occurred_at>=greatest(v_start,v_mobile_observed);
  select count(distinct event.capture_flow_id)::numeric into v_recording_delivered
  from public.product_analytics_events event
  where event.event_name='recording_started' and event.occurred_at>=greatest(v_start,v_mobile_observed)
    and exists(select 1 from public.analysis_sessions session where session.capture_flow_id=event.capture_flow_id and session.status in ('complete','partial') and (p_exercise_id is null or session.exercise_variant_v2_id=p_exercise_id));

  with first_analysis as (
    select distinct on (session.user_id) session.user_id,coalesce(session.completed_at,session.created_at) delivered_at
    from public.analysis_sessions session
    where session.status in ('complete','partial') and (p_exercise_id is null or session.exercise_variant_v2_id=p_exercise_id)
    order by session.user_id,coalesce(session.completed_at,session.created_at),session.id
  )
  select percentile_cont(.5) within group(order by extract(epoch from(first_analysis.delivered_at-user_row.created_at))*1000)::numeric
  into v_signup_latency from first_analysis join auth.users user_row on user_row.id=first_analysis.user_id where first_analysis.delivered_at>=v_start;

  with ranked as (
    select session.id,session.user_id,session.previous_session_id,session.app_session_id,
      row_number() over(partition by session.user_id order by coalesce(session.completed_at,session.created_at),session.id) rank
    from public.analysis_sessions session
    where session.status in ('complete','partial') and (p_exercise_id is null or session.exercise_variant_v2_id=p_exercise_id)
  ), pairs as (
    select first_row.user_id,first_row.id first_id,first_row.app_session_id first_app,
      second_row.id second_id,second_row.previous_session_id second_previous,second_row.app_session_id second_app
    from ranked first_row join ranked second_row on second_row.user_id=first_row.user_id and second_row.rank=2 where first_row.rank=1
  )
  select count(*)::numeric,count(*) filter(where second_previous=first_id and second_app=first_app and first_app is not null)::numeric
  into v_second_den,v_same_session from pairs;

  with delivered as (
    select session.id,session.user_id,coalesce(session.completed_at,session.created_at) delivered_at,
      (coalesce(session.completed_at,session.created_at) at time zone 'America/New_York')::date workout_day,
      row_number() over(partition by session.user_id order by coalesce(session.completed_at,session.created_at),session.id) rank
    from public.analysis_sessions session where session.status in ('complete','partial')
      and (p_exercise_id is null or session.exercise_variant_v2_id=p_exercise_id)
  ), cohort as (
    select first_row.user_id,first_row.delivered_at first_at,first_row.workout_day first_day,
      count(other.id) filter(where other.delivered_at>first_row.delivered_at and other.delivered_at<=first_row.delivered_at+interval '7 days') repeat7,
      count(other.id) filter(where other.delivered_at>=first_row.delivered_at and other.delivered_at<=first_row.delivered_at+interval '14 days') analyses14,
      count(distinct other.workout_day) filter(where other.delivered_at>=first_row.delivered_at and other.delivered_at<=first_row.delivered_at+interval '14 days') days14,
      count(other.id) filter(where other.delivered_at>first_row.delivered_at+interval '7 days' and other.delivered_at<=first_row.delivered_at+interval '30 days' and other.workout_day<>first_row.workout_day) repeat30
    from delivered first_row left join delivered other on other.user_id=first_row.user_id
    where first_row.rank=1 and first_row.delivered_at>=v_start group by first_row.user_id,first_row.delivered_at,first_row.workout_day
  ) select
    count(*) filter(where first_at<=now()-interval '7 days')::numeric,
    count(*) filter(where first_at<=now()-interval '7 days' and repeat7>0)::numeric,
    count(*) filter(where first_at<=now()-interval '14 days')::numeric,
    count(*) filter(where first_at<=now()-interval '14 days' and analyses14>=3 and days14>=2)::numeric,
    count(*) filter(where first_at<=now()-interval '30 days')::numeric,
    count(*) filter(where first_at<=now()-interval '30 days' and repeat30>0)::numeric
  into v_n7,v_y7,v_n14,v_y14,v_n30,v_y30 from cohort;

  select count(*)::numeric,count(*) filter(where feedback.helpful)::numeric into v_feedback_total,v_helpful
  from public.analysis_feedback feedback join public.analysis_sessions session on session.id=feedback.session_id
  where coalesce(session.completed_at,session.created_at)>=v_start and (p_exercise_id is null or session.exercise_variant_v2_id=p_exercise_id);
  select count(*)::numeric,count(telemetry.estimated_cost_usd)::numeric,coalesce(sum(telemetry.estimated_cost_usd),0)::numeric
  into v_calls,v_priced_calls,v_ai_cost from public.model_call_telemetry telemetry join public.analysis_sessions session on session.id=telemetry.session_id
  where telemetry.created_at>=v_start and (p_exercise_id is null or session.exercise_variant_v2_id=p_exercise_id);

  with paid as (
    select entitlement.lifecycle_state,pricing.gross_price/pricing.billing_months monthly
    from public.user_access_entitlements entitlement left join lateral(
      select estimate.gross_price,estimate.billing_months from public.subscription_price_estimates estimate
      where estimate.product_identifier=entitlement.store_product_id and estimate.effective_from<=now() and (estimate.effective_to is null or estimate.effective_to>now())
      order by estimate.effective_from desc limit 1
    ) pricing on true
    where entitlement.status='active' and entitlement.sandbox=false and entitlement.entitlement_id is distinct from 'legacy'
      and coalesce(entitlement.billing_period_end,entitlement.current_period_end)>now()
  ) select count(*)::numeric,count(monthly)::numeric,coalesce(sum(monthly),0)::numeric,count(*) filter(where lifecycle_state='active_cancelled')::numeric
  into v_paid,v_priced_paid,v_mrr,v_cancelling from paid;

  select count(*)::numeric,count(*) filter(where status='failed')::numeric,count(*) filter(where status='unable')::numeric,
    percentile_cont(.5) within group(order by analysis_total_duration_ms) filter(where analysis_total_duration_ms is not null)::numeric,
    percentile_cont(.95) within group(order by analysis_total_duration_ms) filter(where analysis_total_duration_ms is not null)::numeric
  into v_terminal,v_failed,v_unable,v_median_latency,v_p95_latency
  from public.analysis_sessions where created_at>=v_start and status in ('complete','partial','failed','unable')
    and (p_exercise_id is null or exercise_variant_v2_id=p_exercise_id);

  select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',name) order by name),'[]'::jsonb) into v_exercises
  from public.exercise_variants_v2 where is_active=true;
  for v_row in select value item,ordinality ord from jsonb_array_elements(v_old->'funnel') with ordinality loop
    v_funnel:=v_funnel||jsonb_build_array(jsonb_build_object(
      'key',v_row.item->>'key','label',v_row.item->>'label',
      'users',public.founder_metric_v2((v_row.item->>'users')::numeric,'exact',(v_row.item->>'users')::numeric,null,v_mobile_observed,'Ordered unique users','filtered'),
      'conversion',public.founder_metric_v2((v_row.item->>'conversionFromPrevious')::numeric,case when v_row.item->>'key' in ('signup','onboarding','first_analysis') then 'exact' else 'incomplete' end,null,null,v_mobile_observed,'Conversion from previous step','filtered'),
      'medianTransitionMs',public.founder_metric_v2(null,'unavailable',null,null,v_mobile_observed,'Timing begins with the instrumented build','filtered')
    ));
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('key',key,'label',label,'metrics',jsonb_build_object('helpful_rate',public.founder_metric_v2(case when total=0 then null else round(100*helpful/total,1) end,case when total=0 then 'unavailable' else 'exact' end,helpful,total,observed,'Submitted helpfulness votes','filtered'))) order by label),'[]'::jsonb)
  into v_helpfulness from (
    select coalesce(session.exercise_variant_v2_id::text,'custom') key,coalesce(exercise.name,'Custom / other') label,
      count(*)::numeric total,count(*) filter(where feedback.helpful)::numeric helpful,min(feedback.created_at) observed
    from public.analysis_feedback feedback join public.analysis_sessions session on session.id=feedback.session_id
    left join public.exercise_variants_v2 exercise on exercise.id=session.exercise_variant_v2_id
    where feedback.created_at>=v_start and (p_exercise_id is null or session.exercise_variant_v2_id=p_exercise_id)
    group by 1,2
  ) breakdown;

  v_result:=jsonb_build_object(
    'generatedAt',now(),
    'filters',jsonb_build_object('window',p_window,'exerciseId',p_exercise_id,'exerciseLabel',(select name from public.exercise_variants_v2 where id=p_exercise_id),'exerciseOptions',v_exercises),
    'headline',jsonb_build_object(
      'newSignups',public.founder_metric_v2(v_signups,'exact',v_signups,null,v_observed_since,'Global signups in selected window','global'),
      'firstRecordingDeliveryRate',public.founder_metric_v2(case when v_recordings=0 then null else round(100*v_recording_delivered/v_recordings,1) end,case when v_recordings=0 then 'incomplete' else 'exact' end,v_recording_delivered,v_recordings,v_mobile_observed,'Instrumented capture flows','filtered'),
      'medianSignupToFirstAnalysisMs',public.founder_metric_v2(v_signup_latency,'exact',null,null,v_observed_since,'Median signup to first delivered analysis','filtered'),
      'analysesPerActiveUser',public.founder_metric_v2(case when v_active=0 then null else round(v_delivered/v_active,2) end,'exact',v_delivered,v_active,v_observed_since,'Delivered analyses per active user','filtered'),
      'sameSessionSecondAnalysisRate',public.founder_metric_v2(case when v_second_den=0 then null else round(100*v_same_session/v_second_den,1) end,case when v_second_den=0 then 'incomplete' else 'exact' end,v_same_session,v_second_den,v_mobile_observed,'Linked second analysis in one app session','filtered'),
      'sevenDayRepeatRate',public.founder_metric_v2(case when v_n7=0 then null else round(100*v_y7/v_n7,1) end,case when v_n7=0 then 'incomplete' else 'exact' end,v_y7,v_n7,v_observed_since,'Matured first-analysis users','filtered'),
      'thirtyDayRetentionRate',public.founder_metric_v2(case when v_n30=0 then null else round(100*v_y30/v_n30,1) end,case when v_n30=0 then 'incomplete' else 'exact' end,v_y30,v_n30,v_observed_since,'Different workout day during days 8–30','filtered'),
      'helpfulRate',public.founder_metric_v2(case when v_feedback_total=0 then null else round(100*v_helpful/v_feedback_total,1) end,case when v_feedback_total=0 then 'unavailable' else 'exact' end,v_helpful,v_feedback_total,v_observed_since,'Submitted analysis ratings','filtered'),
      'freeToPaidConversionRate',public.founder_metric_v2(case when v_total_users=0 then null else round(100*v_paid/v_total_users,1) end,'exact',v_paid,v_total_users,v_observed_since,'Active production paid over all signups','global'),
      'aiCostPerDeliveredAnalysis',public.founder_metric_v2(case when v_delivered=0 then null else round(v_ai_cost/v_delivered,4) end,case when v_priced_calls<v_calls then 'incomplete' else 'exact' end,v_priced_calls,v_calls,v_observed_since,'Tracked AI cost per delivered analysis','filtered'),
      'estimatedMrr',public.founder_metric_v2(case when v_priced_paid=0 then null else round(v_mrr,2) end,case when v_paid=0 then 'unavailable' when v_priced_paid<v_paid then 'incomplete' else 'estimated' end,v_priced_paid,v_paid,v_observed_since,'Estimated gross monthly run rate','global')
    ),
    'cohorts',jsonb_build_object(
      'northStar',public.founder_metric_v2(case when v_n7=0 then null else round(100*v_y7/v_n7,1) end,case when v_n7=0 then 'incomplete' else 'exact' end,v_y7,v_n7,v_observed_since,'Another delivered analysis within seven days','filtered'),
      'habit14d',public.founder_metric_v2(case when v_n14=0 then null else round(100*v_y14/v_n14,1) end,case when v_n14=0 then 'incomplete' else 'exact' end,v_y14,v_n14,v_observed_since,'3+ analyses across 2+ workout days','filtered'),
      'retention30d',public.founder_metric_v2(case when v_n30=0 then null else round(100*v_y30/v_n30,1) end,case when v_n30=0 then 'incomplete' else 'exact' end,v_y30,v_n30,v_observed_since,'Matured 30-day cohort','filtered')
    ),
    'activity',jsonb_build_object(
      'dau',public.founder_metric_v2((select count(distinct user_id) from public.analysis_sessions where status in ('complete','partial') and coalesce(completed_at,created_at)>=now()-interval '24 hours' and (p_exercise_id is null or exercise_variant_v2_id=p_exercise_id)),'exact',null,null,v_observed_since,'24-hour active users','filtered'),
      'wau',public.founder_metric_v2((select count(distinct user_id) from public.analysis_sessions where status in ('complete','partial') and coalesce(completed_at,created_at)>=now()-interval '7 days' and (p_exercise_id is null or exercise_variant_v2_id=p_exercise_id)),'exact',null,null,v_observed_since,'7-day active users','filtered'),
      'mau',public.founder_metric_v2((select count(distinct user_id) from public.analysis_sessions where status in ('complete','partial') and coalesce(completed_at,created_at)>=now()-interval '30 days' and (p_exercise_id is null or exercise_variant_v2_id=p_exercise_id)),'exact',null,null,v_observed_since,'30-day active users','filtered')
    ),
    'funnel',v_funnel,
    'breakdowns',jsonb_build_object('helpfulness',v_helpfulness,'loop','[]'::jsonb),
    'operations',jsonb_build_object(
      'reliability',jsonb_build_object(
        'technical_failure_rate',public.founder_metric_v2(case when v_terminal=0 then null else round(100*v_failed/v_terminal,1) end,'exact',v_failed,v_terminal,v_start,'Failed terminal attempts','filtered'),
        'unable_result_rate',public.founder_metric_v2(case when v_terminal=0 then null else round(100*v_unable/v_terminal,1) end,'exact',v_unable,v_terminal,v_start,'Unable terminal results','filtered'),
        'median_latency_ms',public.founder_metric_v2(v_median_latency,'exact',null,null,v_start,'Median terminal latency','filtered'),
        'p95_latency_ms',public.founder_metric_v2(v_p95_latency,'exact',null,null,v_start,'P95 terminal latency','filtered')
      ),
      'billing',jsonb_build_object(
        'active_paid',public.founder_metric_v2(v_paid,'exact',v_paid,null,v_observed_since,'Production non-legacy entitlements','global'),
        'currently_cancelling',public.founder_metric_v2(v_cancelling,'exact',v_cancelling,v_paid,v_observed_since,'Active plans set not to renew','global'),
        'estimated_mrr',public.founder_metric_v2(case when v_priced_paid=0 then null else round(v_mrr,2) end,case when v_priced_paid<v_paid then 'incomplete' else 'estimated' end,v_priced_paid,v_paid,v_observed_since,'Effective price estimate','global')
      ),
      'economics',jsonb_build_object(
        'ai_cost',public.founder_metric_v2(v_ai_cost,case when v_priced_calls<v_calls then 'incomplete' else 'exact' end,v_priced_calls,v_calls,v_start,'Tracked model telemetry cost','filtered'),
        'estimated_30d_revenue',public.founder_metric_v2(null,'incomplete',null,null,v_start,'Distinct production purchase and refund coverage is still maturing','global'),
        'estimated_contribution_margin',public.founder_metric_v2(null,'incomplete',null,null,v_start,'Revenue less 15% commission, refunds, and AI cost','global')
      )
    ),
    'recentUsers',coalesce(v_old->'recentUsers','[]'::jsonb),
    'recentAnalyses',coalesce(v_old->'recentAnalyses','[]'::jsonb)
  );
  return v_result;
end;
$$;

revoke all on function public.founder_metric_v2(numeric,text,numeric,numeric,timestamptz,text,text) from public,anon,authenticated;
revoke all on function public.get_founder_dashboard_snapshot_v2(text,integer) from public,anon,authenticated;
grant execute on function public.get_founder_dashboard_snapshot_v2(text,integer) to service_role;
