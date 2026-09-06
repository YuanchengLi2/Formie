create or replace function public.refresh_business_daily_metrics(p_day date default (now() at time zone 'America/New_York')::date)
returns void language plpgsql security definer set search_path='' as $$
declare v_start timestamptz:=p_day::timestamp at time zone 'America/New_York'; v_end timestamptz:=(p_day+1)::timestamp at time zone 'America/New_York';
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  delete from public.business_daily_metrics where metric_date=p_day;
  insert into public.business_daily_metrics(metric_date,metric_key,value)
  values
    (p_day,'new_users',(select count(*) from auth.users where created_at>=v_start and created_at<v_end and not exists(select 1 from public.creator_memberships membership where membership.user_id=auth.users.id) and not exists(select 1 from public.business_test_accounts test where test.user_id=auth.users.id))),
    (p_day,'active_users',(select count(distinct user_id) from (select user_id from public.product_analytics_events where user_id is not null and occurred_at>=v_start and occurred_at<v_end union select user_id from public.analysis_attempts where updated_at>=v_start and updated_at<v_end) activity where not exists(select 1 from public.creator_memberships membership where membership.user_id=activity.user_id) and not exists(select 1 from public.business_test_accounts test where test.user_id=activity.user_id))),
    (p_day,'active_paid',(select count(distinct transaction.user_id) from public.subscription_transactions transaction where transaction.user_id is not null and transaction.environment='PRODUCTION' and transaction.gross_amount>0 and coalesce(transaction.period_start,transaction.purchased_at,transaction.created_at)<v_end and transaction.period_end>=v_end and (transaction.refunded_at is null or transaction.refunded_at>=v_end) and not exists(select 1 from public.creator_memberships membership where membership.user_id=transaction.user_id) and not exists(select 1 from public.business_test_accounts test where test.user_id=transaction.user_id))),
    (p_day,'analyses',(select count(*) from public.analysis_attempts attempt where status in ('complete','partial') and terminal_at>=v_start and terminal_at<v_end and not exists(select 1 from public.business_test_accounts test where test.user_id=attempt.user_id))),
    (p_day,'new_paid',(select count(*) from (select transaction.user_id,min(coalesce(transaction.purchased_at,transaction.created_at)) first_paid from public.subscription_transactions transaction where transaction.environment='PRODUCTION' and transaction.gross_amount>0 and transaction.user_id is not null and not exists(select 1 from public.business_test_accounts test where test.user_id=transaction.user_id) group by transaction.user_id) firsts where first_paid>=v_start and first_paid<v_end)),
    (p_day,'gross_revenue',(select coalesce(sum(gross_amount),0) from public.subscription_transactions transaction where environment='PRODUCTION' and currency='USD' and purchased_at>=v_start and purchased_at<v_end and not exists(select 1 from public.business_test_accounts test where test.user_id=transaction.user_id))),
    (p_day,'ai_cost',(select coalesce(sum(telemetry.estimated_cost_usd),0) from public.model_call_telemetry telemetry join public.analysis_sessions session on session.id=telemetry.session_id where telemetry.created_at>=v_start and telemetry.created_at<v_end and not exists(select 1 from public.business_test_accounts test where test.user_id=session.user_id)));
end $$;

create or replace function public.get_founder_business_dashboard_v3(
  p_section text default 'overview',p_window text default '30d',p_start date default null,p_end date default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_start date; v_trends jsonb;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  v_result:=public.get_founder_business_dashboard_v2(p_section,p_window,p_start,p_end);
  v_start:=greatest(coalesce((v_result->>'rangeStart')::timestamptz,now()-interval '90 days')::date,(now() at time zone 'America/New_York')::date-90);
  select coalesce(jsonb_agg(day_row order by day_row->>'date'),'[]'::jsonb) into v_trends from (
    select jsonb_build_object(
      'date',metric_date,
      'newUsers',max(value) filter(where metric_key='new_users'),
      'activeUsers',max(value) filter(where metric_key='active_users'),
      'activePaid',max(value) filter(where metric_key='active_paid'),
      'analyses',max(value) filter(where metric_key='analyses'),
      'newPaid',max(value) filter(where metric_key='new_paid'),
      'grossRevenue',max(value) filter(where metric_key='gross_revenue'),
      'aiCost',max(value) filter(where metric_key='ai_cost')
    ) day_row from public.business_daily_metrics where metric_date>=v_start group by metric_date
  ) daily;
  return jsonb_set(v_result,'{trends}',v_trends);
end $$;

do $$ declare v_day date; begin
  for v_day in select generate_series((now() at time zone 'America/New_York')::date-90,(now() at time zone 'America/New_York')::date,'1 day')::date loop
    perform public.refresh_business_daily_metrics(v_day);
  end loop;
end $$;

revoke all on function public.get_founder_business_dashboard_v3(text,text,date,date) from public,anon,authenticated;
grant execute on function public.get_founder_business_dashboard_v3(text,text,date,date) to service_role;
