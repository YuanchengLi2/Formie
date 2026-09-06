-- Server-owned reporting contracts for the founder and creator portals.
create table if not exists public.business_daily_metrics (
  metric_date date not null,
  metric_key text not null,
  dimension_key text not null default 'all',
  dimension_value text not null default 'all',
  value numeric not null,
  refreshed_at timestamptz not null default now(),
  primary key(metric_date,metric_key,dimension_key,dimension_value)
);
alter table public.business_daily_metrics enable row level security;
revoke all on public.business_daily_metrics from public,anon,authenticated;
grant select,insert,update,delete on public.business_daily_metrics to service_role;

create table if not exists public.business_test_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null,
  marked_by uuid references auth.users(id) on delete set null,
  marked_at timestamptz not null default now()
);
alter table public.business_test_accounts enable row level security;
revoke all on public.business_test_accounts from public,anon,authenticated;
grant select,insert,update,delete on public.business_test_accounts to service_role;

create or replace function public.business_metric(
  p_value numeric,p_unit text,p_quality text,p_settlement text,p_currency text,
  p_numerator numeric,p_denominator numeric,p_observed_since timestamptz,p_definition text
) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('value',p_value,'unit',p_unit,'quality',p_quality,'settlement',p_settlement,
    'currency',p_currency,'numerator',p_numerator,'denominator',p_denominator,'observedSince',p_observed_since,
    'asOf',now(),'definition',p_definition);
$$;

create or replace function public.business_suppress_small_groups(p_counts jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare v_small integer; v_hidden_complement boolean:=false; v_row record; v_result jsonb:='[]'::jsonb;
begin
  select count(*) into v_small from jsonb_to_recordset(coalesce(p_counts,'[]'::jsonb)) as item(label text,users bigint) where users<5;
  for v_row in select label,users from jsonb_to_recordset(coalesce(p_counts,'[]'::jsonb)) as item(label text,users bigint) order by users,label loop
    if v_row.users<5 then continue; end if;
    if v_small=1 and not v_hidden_complement then v_hidden_complement:=true; continue; end if;
    v_result:=v_result||jsonb_build_array(jsonb_build_object('label',v_row.label,'users',v_row.users));
  end loop;
  return v_result;
end $$;

create or replace function public.business_suppress_group_rows(p_rows jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare v_small integer; v_hidden_complement boolean:=false; v_item jsonb; v_result jsonb:='[]'::jsonb;
begin
  select count(*) into v_small from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) item where coalesce((item->>'users')::bigint,0)<5;
  for v_item in select item from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) item order by coalesce((item->>'users')::bigint,0),item->>'label' loop
    if coalesce((v_item->>'users')::bigint,0)<5 then continue; end if;
    if v_small=1 and not v_hidden_complement then v_hidden_complement:=true; continue; end if;
    v_result:=v_result||jsonb_build_array(v_item);
  end loop;
  return v_result;
end $$;

create or replace function public.business_retention_breakdown(p_dimension text,p_start timestamptz,p_end timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_dimension not in ('acquisition','creator','experience','goal') then raise exception 'INVALID_DIMENSION'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'label',label,'users',users,'d7Users',d7_users,'d30Users',d30_users,
    'd7Percent',round(100*d7_users/nullif(users,0),1),'d30Percent',round(100*d30_users/nullif(users,0),1)
  )),'[]'::jsonb) into v_rows from (
    select label,count(*) users,
      count(*) filter(where exists(select 1 from public.product_analytics_events event where event.user_id=cohort.user_id and (event.occurred_at at time zone 'America/New_York')::date=(cohort.signup_at at time zone 'America/New_York')::date+7) or exists(select 1 from public.analysis_attempts attempt where attempt.user_id=cohort.user_id and (attempt.updated_at at time zone 'America/New_York')::date=(cohort.signup_at at time zone 'America/New_York')::date+7)) d7_users,
      count(*) filter(where exists(select 1 from public.product_analytics_events event where event.user_id=cohort.user_id and (event.occurred_at at time zone 'America/New_York')::date=(cohort.signup_at at time zone 'America/New_York')::date+30) or exists(select 1 from public.analysis_attempts attempt where attempt.user_id=cohort.user_id and (attempt.updated_at at time zone 'America/New_York')::date=(cohort.signup_at at time zone 'America/New_York')::date+30)) d30_users
    from (
      select snapshot.user_id,signup.created_at signup_at,
        case p_dimension
          when 'acquisition' then case when referral.user_id is not null then 'creator_referral' else coalesce(snapshot.self_reported_source,'unknown') end
          when 'creator' then creator.display_name
          when 'experience' then coalesce(snapshot.experience,'unknown')
          when 'goal' then coalesce(snapshot.primary_goal,'unknown')
        end label,
        referral.user_id referral_user_id
      from public.onboarding_reporting_snapshots snapshot
      join auth.users signup on signup.id=snapshot.user_id
      left join public.account_referrals referral on referral.user_id=snapshot.user_id and referral.environment='production'
      left join public.creators creator on creator.id=referral.creator_id
      where signup.created_at>=p_start and signup.created_at<p_end-interval '31 days'
        and not exists(select 1 from public.business_test_accounts test where test.user_id=snapshot.user_id)
        and not exists(select 1 from public.creator_memberships membership where membership.user_id=snapshot.user_id)
    ) cohort
    where label is not null and (p_dimension<>'creator' or referral_user_id is not null)
    group by label
  ) grouped;
  return public.business_suppress_group_rows(v_rows);
end $$;

create or replace function public.business_bonus_comparison(p_start timestamptz,p_end timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'label',label,'users',users,'d7Users',d7_users,'d30Users',d30_users,
    'd7Percent',round(100*d7_users/nullif(users,0),1),'d30Percent',round(100*d30_users/nullif(users,0),1),
    'averageFirst30DayAnalyses',round(first_30_analyses/nullif(users,0),2)
  )),'[]'::jsonb) into v_rows from (
    select label,count(*) users,
      count(*) filter(where exists(select 1 from public.product_analytics_events event where event.user_id=cohort.user_id and (event.occurred_at at time zone 'America/New_York')::date=(cohort.first_paid_at at time zone 'America/New_York')::date+7) or exists(select 1 from public.analysis_attempts attempt where attempt.user_id=cohort.user_id and (attempt.updated_at at time zone 'America/New_York')::date=(cohort.first_paid_at at time zone 'America/New_York')::date+7)) d7_users,
      count(*) filter(where exists(select 1 from public.product_analytics_events event where event.user_id=cohort.user_id and (event.occurred_at at time zone 'America/New_York')::date=(cohort.first_paid_at at time zone 'America/New_York')::date+30) or exists(select 1 from public.analysis_attempts attempt where attempt.user_id=cohort.user_id and (attempt.updated_at at time zone 'America/New_York')::date=(cohort.first_paid_at at time zone 'America/New_York')::date+30)) d30_users,
      sum((select count(*) from public.analysis_attempts attempt where attempt.user_id=cohort.user_id and attempt.status in ('complete','partial') and attempt.terminal_at>=cohort.first_paid_at and attempt.terminal_at<cohort.first_paid_at+interval '30 days')) first_30_analyses
    from (
      select firsts.user_id,firsts.first_paid_at,case when bonus.user_id is not null then 'bonus_recipient' else 'non_referred_comparison' end label
      from (select transaction.user_id,min(coalesce(transaction.purchased_at,transaction.created_at)) first_paid_at from public.subscription_transactions transaction where transaction.user_id is not null and transaction.environment='PRODUCTION' and transaction.gross_amount>0 group by transaction.user_id) firsts
      left join public.referral_bonus_grants bonus on bonus.user_id=firsts.user_id
      left join public.account_referrals referral on referral.user_id=firsts.user_id and referral.environment='production'
      where firsts.first_paid_at>=p_start and firsts.first_paid_at<p_end-interval '31 days'
        and (bonus.user_id is not null or referral.user_id is null)
        and not exists(select 1 from public.business_test_accounts test where test.user_id=firsts.user_id)
    ) cohort group by label
  ) grouped;
  return public.business_suppress_group_rows(v_rows);
end $$;

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
    (p_day,'analyses',(select count(*) from public.analysis_attempts attempt where status in ('complete','partial') and terminal_at>=v_start and terminal_at<v_end and not exists(select 1 from public.business_test_accounts test where test.user_id=attempt.user_id))),
    (p_day,'new_paid',(select count(*) from (select transaction.user_id,min(coalesce(transaction.purchased_at,transaction.created_at)) first_paid from public.subscription_transactions transaction where transaction.environment='PRODUCTION' and transaction.gross_amount>0 and transaction.user_id is not null and not exists(select 1 from public.business_test_accounts test where test.user_id=transaction.user_id) group by transaction.user_id) firsts where first_paid>=v_start and first_paid<v_end)),
    (p_day,'gross_revenue',(select coalesce(sum(gross_amount),0) from public.subscription_transactions transaction where environment='PRODUCTION' and currency='USD' and purchased_at>=v_start and purchased_at<v_end and not exists(select 1 from public.business_test_accounts test where test.user_id=transaction.user_id))),
    (p_day,'ai_cost',(select coalesce(sum(telemetry.estimated_cost_usd),0) from public.model_call_telemetry telemetry join public.analysis_sessions session on session.id=telemetry.session_id where telemetry.created_at>=v_start and telemetry.created_at<v_end and not exists(select 1 from public.business_test_accounts test where test.user_id=session.user_id)));
end $$;

create or replace function public.get_founder_business_dashboard(p_section text default 'overview',p_window text default '30d',p_start date default null,p_end date default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_start timestamptz; v_now timestamptz:=now(); v_observed timestamptz; v_analytics_observed timestamptz;
  v_total_users numeric; v_new_users numeric; v_dau numeric; v_wau numeric; v_mau numeric; v_paid numeric; v_analyses numeric; v_active numeric;
  v_gross numeric; v_net numeric; v_referral_revenue numeric; v_commissions numeric; v_ai numeric; v_bonus_ai numeric; v_refunds numeric;
  v_priced_tx numeric; v_total_tx numeric; v_priced_calls numeric; v_total_calls numeric; v_bonus_granted numeric; v_bonus_used numeric; v_bonus_expired numeric;
  v_new_paid numeric; v_cancellations numeric; v_refund_count numeric; v_mrr numeric; v_non_referral_revenue numeric;
  v_pending_commission numeric; v_payable_commission numeric; v_paid_commission numeric; v_bonus_revoked numeric;
  v_helpful numeric; v_unhelpful numeric; v_conversion_num numeric; v_conversion_den numeric; v_observed_conversion_num numeric; v_observed_conversion_den numeric;
  v_visit_count numeric; v_claimed_visits numeric; v_pending_visits numeric; v_expired_visits numeric; v_excluded_visits numeric;
  v_d1_num numeric; v_d1_den numeric; v_d7_num numeric; v_d7_den numeric; v_d30_num numeric; v_d30_den numeric;
  v_creator_conversion_num numeric; v_creator_conversion_den numeric; v_processing_ms numeric; v_quota_denials numeric;
  v_subscriber_retention_num numeric; v_subscriber_retention_den numeric;
  v_metrics jsonb; v_trends jsonb; v_creator_rows jsonb; v_growth jsonb; v_alerts jsonb;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_section not in ('overview','revenue','creators','growth') then raise exception 'INVALID_SECTION'; end if;
  if p_window not in ('24h','7d','30d','90d','all','custom') then raise exception 'INVALID_WINDOW'; end if;
  if p_window='custom' then
    if p_start is null or p_end is null or p_end<p_start or p_end-p_start>366 then raise exception 'INVALID_CUSTOM_RANGE'; end if;
    v_start:=p_start::timestamp at time zone 'America/New_York';
    v_now:=(p_end+1)::timestamp at time zone 'America/New_York';
  else
    v_start:=case p_window when '24h' then v_now-interval '24 hours' when '7d' then v_now-interval '7 days' when '30d' then v_now-interval '30 days' when '90d' then v_now-interval '90 days' else '-infinity'::timestamptz end;
  end if;
  select count(*)::numeric,min(created_at) into v_total_users,v_observed from auth.users where not exists(select 1 from public.creator_memberships membership where membership.user_id=auth.users.id) and not exists(select 1 from public.business_test_accounts test where test.user_id=auth.users.id);
  select observed_since into v_analytics_observed from public.reporting_coverage where source_key='product_analytics_v3';
  select count(*)::numeric into v_new_users from auth.users where created_at>=v_start and not exists(select 1 from public.creator_memberships membership where membership.user_id=auth.users.id) and not exists(select 1 from public.business_test_accounts test where test.user_id=auth.users.id);
  select count(distinct user_id)::numeric into v_dau from (select user_id from public.product_analytics_events where user_id is not null and occurred_at>=v_now-interval '24 hours' union select user_id from public.analysis_attempts where updated_at>=v_now-interval '24 hours') activity where not exists(select 1 from public.business_test_accounts test where test.user_id=activity.user_id);
  select count(distinct user_id)::numeric into v_wau from (select user_id from public.product_analytics_events where user_id is not null and occurred_at>=v_now-interval '7 days' union select user_id from public.analysis_attempts where updated_at>=v_now-interval '7 days') activity where not exists(select 1 from public.business_test_accounts test where test.user_id=activity.user_id);
  select count(distinct user_id)::numeric into v_mau from (select user_id from public.product_analytics_events where user_id is not null and occurred_at>=v_now-interval '30 days' union select user_id from public.analysis_attempts where updated_at>=v_now-interval '30 days') activity where not exists(select 1 from public.business_test_accounts test where test.user_id=activity.user_id);
  select count(*)::numeric into v_paid from public.user_access_entitlements entitlement where status='active' and sandbox=false and entitlement_id is distinct from 'legacy' and coalesce(billing_period_end,current_period_end)>v_now and not exists(select 1 from public.creator_memberships membership where membership.user_id=entitlement.user_id) and not exists(select 1 from public.business_test_accounts test where test.user_id=entitlement.user_id);
  select count(*)::numeric,count(distinct user_id)::numeric into v_analyses,v_active from public.analysis_attempts attempt where status in ('complete','partial') and coalesce(terminal_at,updated_at)>=v_start and not exists(select 1 from public.business_test_accounts test where test.user_id=attempt.user_id);
  select count(*)::numeric,count(gross_amount)::numeric,coalesce(sum(gross_amount) filter(where currency='USD'),0)::numeric,
    coalesce(sum(estimated_net_proceeds) filter(where currency='USD'),0)::numeric,
    coalesce(sum(gross_amount) filter(where currency='USD' and creator_id is not null),0)::numeric,
    coalesce(sum(abs(gross_amount)) filter(where financial_status='refunded' and currency='USD'),0)::numeric
  into v_total_tx,v_priced_tx,v_gross,v_net,v_referral_revenue,v_refunds
  from public.subscription_transactions where environment='PRODUCTION' and coalesce(purchased_at,created_at)>=v_start and not exists(select 1 from public.business_test_accounts test where test.user_id=subscription_transactions.user_id);
  select coalesce(sum(amount),0)::numeric into v_commissions from public.creator_commission_entries entry where currency='USD' and created_at>=v_start and not exists(select 1 from public.business_test_accounts test where test.user_id=entry.referred_user_id);
  select count(*)::numeric,count(telemetry.estimated_cost_usd)::numeric,coalesce(sum(telemetry.estimated_cost_usd),0)::numeric into v_total_calls,v_priced_calls,v_ai from public.model_call_telemetry telemetry join public.analysis_sessions session on session.id=telemetry.session_id where telemetry.created_at>=v_start and not exists(select 1 from public.business_test_accounts test where test.user_id=session.user_id);
  select coalesce(sum(telemetry.estimated_cost_usd),0)::numeric into v_bonus_ai from public.model_call_telemetry telemetry join public.analysis_attempts attempt on attempt.id=telemetry.analysis_attempt_id join public.analysis_credit_reservations reservation on reservation.id=attempt.reservation_id where reservation.funding_source='referral_bonus' and telemetry.created_at>=v_start and not exists(select 1 from public.business_test_accounts test where test.user_id=attempt.user_id);
  select coalesce(sum(units_granted),0)::numeric,coalesce(sum((select count(*) from public.analysis_credit_reservations r where r.bonus_grant_id=g.id and r.status='committed')),0)::numeric,
    coalesce(sum(case when state='expired' then greatest(units_granted-(select count(*) from public.analysis_credit_reservations r where r.bonus_grant_id=g.id and (r.status='committed' or (r.status='reserved' and r.expires_at>now()))),0) else 0 end),0)::numeric
  into v_bonus_granted,v_bonus_used,v_bonus_expired
  from public.referral_bonus_grants g join public.subscription_transactions transaction on transaction.id=g.qualifying_transaction_id
  where g.granted_at>=v_start and transaction.environment='PRODUCTION' and not exists(select 1 from public.business_test_accounts test where test.user_id=g.user_id);
  select coalesce(sum(case when state='revoked' then greatest(units_granted-(select count(*) from public.analysis_credit_reservations r where r.bonus_grant_id=g.id and r.status='committed'),0) else 0 end),0)::numeric into v_bonus_revoked
  from public.referral_bonus_grants g join public.subscription_transactions transaction on transaction.id=g.qualifying_transaction_id
  where g.granted_at>=v_start and transaction.environment='PRODUCTION' and not exists(select 1 from public.business_test_accounts test where test.user_id=g.user_id);
  select count(*)::numeric into v_new_paid from (select transaction.user_id,min(coalesce(transaction.purchased_at,transaction.created_at)) first_paid from public.subscription_transactions transaction where transaction.environment='PRODUCTION' and transaction.gross_amount>0 and transaction.user_id is not null and not exists(select 1 from public.business_test_accounts test where test.user_id=transaction.user_id) group by transaction.user_id) firsts where first_paid>=v_start;
  select count(*)::numeric into v_cancellations from public.revenuecat_webhook_events event where event.environment='PRODUCTION' and event.event_type='CANCELLATION' and coalesce(event.event_timestamp,event.received_at)>=v_start and not exists(select 1 from public.business_test_accounts test where test.user_id=event.user_id);
  select count(*)::numeric into v_refund_count from public.subscription_transactions transaction where transaction.environment='PRODUCTION' and transaction.refunded_at>=v_start and not exists(select 1 from public.business_test_accounts test where test.user_id=transaction.user_id);
  select coalesce(sum(latest.gross_amount),0)::numeric into v_mrr from public.user_access_entitlements entitlement join lateral (select transaction.gross_amount from public.subscription_transactions transaction where transaction.user_id=entitlement.user_id and transaction.environment='PRODUCTION' and transaction.currency='USD' and transaction.gross_amount>0 order by coalesce(transaction.period_end,transaction.purchased_at) desc limit 1) latest on true where entitlement.status='active' and entitlement.sandbox=false and coalesce(entitlement.billing_period_end,entitlement.current_period_end)>v_now and not exists(select 1 from public.business_test_accounts test where test.user_id=entitlement.user_id) and not exists(select 1 from public.creator_memberships membership where membership.user_id=entitlement.user_id);
  v_non_referral_revenue:=v_gross-v_referral_revenue;
  select coalesce(sum(amount) filter(where status='paid'),0),coalesce(sum(amount) filter(where status='payable' or (status='pending' and hold_until<=now() and exists(select 1 from public.transaction_reconciliation_allocations allocation where allocation.transaction_id=creator_commission_entries.transaction_id))),0),coalesce(sum(amount) filter(where status='pending' and not (hold_until<=now() and exists(select 1 from public.transaction_reconciliation_allocations allocation where allocation.transaction_id=creator_commission_entries.transaction_id))),0)
    into v_paid_commission,v_payable_commission,v_pending_commission from public.creator_commission_entries where currency='USD';
  select count(*) filter(where helpful),count(*) filter(where not helpful) into v_helpful,v_unhelpful from public.analysis_feedback feedback join public.analysis_sessions session on session.id=feedback.session_id where feedback.created_at>=v_start and not exists(select 1 from public.business_test_accounts test where test.user_id=session.user_id);
  select count(*)::numeric,count(*) filter(where exists(select 1 from public.subscription_transactions transaction where transaction.user_id=signup.id and transaction.environment='PRODUCTION' and transaction.gross_amount>0 and transaction.purchased_at>=signup.created_at and transaction.purchased_at<=signup.created_at+interval '30 days'))::numeric
    into v_conversion_den,v_conversion_num from auth.users signup where signup.created_at>=v_start and signup.created_at<=v_now-interval '30 days' and not exists(select 1 from public.creator_memberships membership where membership.user_id=signup.id) and not exists(select 1 from public.business_test_accounts test where test.user_id=signup.id);
  select count(*)::numeric,count(*) filter(where exists(select 1 from public.subscription_transactions transaction where transaction.user_id=signup.id and transaction.environment='PRODUCTION' and transaction.gross_amount>0 and transaction.purchased_at>=signup.created_at and transaction.purchased_at<=least(v_now,signup.created_at+interval '30 days')))::numeric
    into v_observed_conversion_den,v_observed_conversion_num from auth.users signup where signup.created_at>=v_start and not exists(select 1 from public.creator_memberships membership where membership.user_id=signup.id) and not exists(select 1 from public.business_test_accounts test where test.user_id=signup.id);
  select count(*)::numeric,count(*) filter(where claimed_at is not null)::numeric,count(*) filter(where claimed_at is null and expires_at>v_now)::numeric,count(*) filter(where claimed_at is null and expires_at<=v_now)::numeric
    into v_visit_count,v_claimed_visits,v_pending_visits,v_expired_visits from public.referral_visits where environment='production' and issued_at>=v_start and excluded_reason is null;
  select count(*)::numeric into v_excluded_visits from public.creator_referral_exclusions where excluded_at>=v_start;
  select count(*)::numeric,count(*) filter(where exists(select 1 from public.product_analytics_events event where event.user_id=signup.id and (event.occurred_at at time zone 'America/New_York')::date=(signup.created_at at time zone 'America/New_York')::date+1) or exists(select 1 from public.analysis_attempts attempt where attempt.user_id=signup.id and (attempt.updated_at at time zone 'America/New_York')::date=(signup.created_at at time zone 'America/New_York')::date+1))::numeric into v_d1_den,v_d1_num from auth.users signup where signup.created_at>=v_start and signup.created_at<v_now-interval '2 days' and not exists(select 1 from public.business_test_accounts test where test.user_id=signup.id) and not exists(select 1 from public.creator_memberships membership where membership.user_id=signup.id);
  select count(*)::numeric,count(*) filter(where exists(select 1 from public.product_analytics_events event where event.user_id=signup.id and (event.occurred_at at time zone 'America/New_York')::date=(signup.created_at at time zone 'America/New_York')::date+7) or exists(select 1 from public.analysis_attempts attempt where attempt.user_id=signup.id and (attempt.updated_at at time zone 'America/New_York')::date=(signup.created_at at time zone 'America/New_York')::date+7))::numeric into v_d7_den,v_d7_num from auth.users signup where signup.created_at>=v_start and signup.created_at<v_now-interval '8 days' and not exists(select 1 from public.business_test_accounts test where test.user_id=signup.id) and not exists(select 1 from public.creator_memberships membership where membership.user_id=signup.id);
  select count(*)::numeric,count(*) filter(where exists(select 1 from public.product_analytics_events event where event.user_id=signup.id and (event.occurred_at at time zone 'America/New_York')::date=(signup.created_at at time zone 'America/New_York')::date+30) or exists(select 1 from public.analysis_attempts attempt where attempt.user_id=signup.id and (attempt.updated_at at time zone 'America/New_York')::date=(signup.created_at at time zone 'America/New_York')::date+30))::numeric into v_d30_den,v_d30_num from auth.users signup where signup.created_at>=v_start and signup.created_at<v_now-interval '31 days' and not exists(select 1 from public.business_test_accounts test where test.user_id=signup.id) and not exists(select 1 from public.creator_memberships membership where membership.user_id=signup.id);
  select count(*)::numeric,count(*) filter(where exists(select 1 from public.subscription_transactions transaction where transaction.user_id=referral.user_id and transaction.environment='PRODUCTION' and transaction.gross_amount>0 and transaction.purchased_at>=referral.attributed_at))::numeric into v_creator_conversion_den,v_creator_conversion_num from public.account_referrals referral where referral.environment='production' and referral.attributed_at>=v_start;
  select avg(extract(epoch from (coalesce(completed_at,updated_at)-created_at))*1000)::numeric into v_processing_ms from public.analysis_sessions where status in ('complete','partial','failed','unable') and coalesce(completed_at,updated_at)>=v_start;
  select count(*)::numeric into v_quota_denials from public.product_analytics_events where event_name='analysis_reservation_denied' and properties->>'errorCategory' in ('ANALYSIS_QUOTA_EXCEEDED','AnalysisApiError') and occurred_at>=v_start;
  select count(*)::numeric,count(*) filter(where exists(select 1 from public.user_access_entitlements entitlement where entitlement.user_id=paid.user_id and entitlement.status='active' and entitlement.sandbox=false and coalesce(entitlement.billing_period_end,entitlement.current_period_end)>v_now))::numeric into v_subscriber_retention_den,v_subscriber_retention_num from (select distinct transaction.user_id from public.subscription_transactions transaction where transaction.user_id is not null and transaction.environment='PRODUCTION' and transaction.gross_amount>0 and transaction.purchased_at<v_now and not exists(select 1 from public.business_test_accounts test where test.user_id=transaction.user_id)) paid;

  v_metrics:=jsonb_build_object(
    'totalUsers',public.business_metric(v_total_users,'count','exact','not_applicable',null,v_total_users,null,v_observed,'App accounts excluding creator-only portal identities'),
    'newUsers',public.business_metric(v_new_users,'count','exact','not_applicable',null,v_new_users,null,v_observed,'New app accounts in the selected window'),
    'dau',public.business_metric(v_dau,'count',case when v_analytics_observed is null then 'incomplete' else 'exact' end,'not_applicable',null,v_dau,null,v_analytics_observed,'Identified users with product activity in the last 24 hours'),
    'wau',public.business_metric(v_wau,'count',case when v_analytics_observed is null then 'incomplete' else 'exact' end,'not_applicable',null,v_wau,null,v_analytics_observed,'Identified users with product activity in the last 7 days'),
    'mau',public.business_metric(v_mau,'count',case when v_analytics_observed is null then 'incomplete' else 'exact' end,'not_applicable',null,v_mau,null,v_analytics_observed,'Identified users with product activity in the last 30 days'),
    'activePaid',public.business_metric(v_paid,'count','exact','not_applicable',null,v_paid,null,v_observed,'Active production paid subscriptions'),
    'newSubscriptions',public.business_metric(v_new_paid,'count','exact','not_applicable',null,v_new_paid,null,v_observed,'Accounts reaching their first positive production payment'),
    'cancellations',public.business_metric(v_cancellations,'count','exact','not_applicable',null,v_cancellations,null,v_observed,'Auto-renew disabled events, separate from expiration and refund'),
    'refundCount',public.business_metric(v_refund_count,'count','exact','not_applicable',null,v_refund_count,null,v_observed,'Production transactions refunded in the selected window'),
    'analyses',public.business_metric(v_analyses,'count','exact','not_applicable',null,v_analyses,null,v_observed,'Completed or partial analysis attempts'),
    'analysesPerActive',public.business_metric(case when v_active=0 then null else round(v_analyses/v_active,2) end,'count',case when v_active=0 then 'unavailable' else 'exact' end,'not_applicable',null,v_analyses,v_active,v_observed,'Delivered attempts per active analysis user'),
    'costPerAnalysis',public.business_metric(case when v_analyses=0 or v_priced_calls=0 then null else round(v_ai/v_analyses,6) end,'money',case when v_analyses=0 or v_total_calls=0 then 'unavailable' when v_priced_calls<v_total_calls then 'incomplete' else 'exact' end,'not_applicable','USD',v_priced_calls,v_analyses,v_observed,'Tracked pipeline cost including failed calls divided by delivered attempts'),
    'helpfulRate',public.business_metric(case when v_helpful+v_unhelpful=0 then null else round(100*v_helpful/(v_helpful+v_unhelpful),1) end,'percent',case when v_helpful+v_unhelpful=0 then 'unavailable' else 'exact' end,'not_applicable',null,v_helpful,v_helpful+v_unhelpful,v_observed,'Helpful saved votes divided by submitted helpful and unhelpful votes'),
    'subscriptionConversion',public.business_metric(case when v_conversion_den=0 then null else round(100*v_conversion_num/v_conversion_den,1) end,'percent',case when v_conversion_den=0 then 'unavailable' else 'exact' end,'not_applicable',null,v_conversion_num,v_conversion_den,v_observed,'Mature signup cohorts reaching first payment within 30 days'),
    'observedSubscriptionConversion',public.business_metric(case when v_observed_conversion_den=0 then null else round(100*v_observed_conversion_num/v_observed_conversion_den,1) end,'percent',case when v_observed_conversion_den=0 then 'unavailable' else 'exact' end,'not_applicable',null,v_observed_conversion_num,v_observed_conversion_den,v_observed,'Observed-to-date first-payment conversion including immature cohorts'),
    'clickToSignup',public.business_metric(case when v_visit_count=0 then null else round(100*v_claimed_visits/v_visit_count,1) end,'percent',case when v_visit_count=0 then 'unavailable' else 'exact' end,'not_applicable',null,v_claimed_visits,v_visit_count,v_observed,'Claimed eligible first-party visits divided by eligible issued visits in the click cohort'),
    'creatorPaidConversion',public.business_metric(case when v_creator_conversion_den=0 then null else round(100*v_creator_conversion_num/v_creator_conversion_den,1) end,'percent',case when v_creator_conversion_den=0 then 'unavailable' else 'exact' end,'not_applicable',null,v_creator_conversion_num,v_creator_conversion_den,v_observed,'Attributed accounts reaching a first positive production payment'),
    'pendingReferralVisits',public.business_metric(v_pending_visits,'count','exact','not_applicable',null,v_pending_visits,v_visit_count,v_observed,'Valid unclaimed visits still inside their 30-day attribution window'),
    'expiredUnmatchedVisits',public.business_metric(v_expired_visits,'count','exact','not_applicable',null,v_expired_visits,v_visit_count,v_observed,'Valid tracked visits that expired without an attributed account'),
    'excludedReferralRequests',public.business_metric(v_excluded_visits,'count','exact','not_applicable',null,v_excluded_visits,null,v_observed,'Preview and prefetch requests excluded before an eligible referral visit was issued'),
    'grossRevenue',public.business_metric(case when v_priced_tx=0 then null else v_gross end,'money',case when v_total_tx=0 then 'unavailable' when v_priced_tx<v_total_tx then 'incomplete' else 'estimated' end,'estimated','USD',v_priced_tx,v_total_tx,v_observed,'RevenueCat gross transaction value'),
    'netProceeds',public.business_metric(case when v_priced_tx=0 then null else v_net end,'money',case when v_total_tx=0 then 'unavailable' when v_priced_tx<v_total_tx then 'incomplete' else 'estimated' end,'estimated','USD',v_priced_tx,v_total_tx,v_observed,'Estimated proceeds after store tax and commission'),
    'referralRevenue',public.business_metric(v_referral_revenue,'money',case when v_total_tx=0 then 'unavailable' else 'estimated' end,'estimated','USD',null,null,v_observed,'Gross first-party transactions from attributed accounts'),
    'nonReferralRevenue',public.business_metric(v_non_referral_revenue,'money',case when v_total_tx=0 then 'unavailable' else 'estimated' end,'estimated','USD',null,null,v_observed,'Gross USD production transactions from accounts without verified creator attribution'),
    'mrr',public.business_metric(case when v_paid=0 then null else v_mrr end,'money',case when v_paid=0 then 'unavailable' else 'estimated' end,'estimated','USD',null,null,v_observed,'Monthly gross recurring value of current production subscriptions with USD transaction coverage'),
    'revenuePerPayingUser',public.business_metric(case when v_paid=0 or v_priced_tx=0 then null else round(v_gross/v_paid,2) end,'money',case when v_paid=0 or v_priced_tx=0 then 'unavailable' when v_priced_tx<v_total_tx then 'incomplete' else 'estimated' end,'estimated','USD',v_gross,v_paid,v_observed,'Selected-window USD gross value divided by current active paid subscribers'),
    'refunds',public.business_metric(v_refunds,'money',case when v_total_tx=0 then 'unavailable' else 'estimated' end,'estimated','USD',null,null,v_observed,'Refunded transaction value'),
    'creatorCommissions',public.business_metric(v_commissions,'money',case when v_total_tx=0 then 'unavailable' else 'estimated' end,'estimated','USD',null,null,v_observed,'First-payment creator commission entries including adjustments'),
    'commissionPending',public.business_metric(v_pending_commission,'money','exact','not_applicable','USD',null,null,v_observed,'Commission entries still in hold or awaiting compatible reconciliation'),
    'commissionPayable',public.business_metric(v_payable_commission,'money','exact','allocated','USD',null,null,v_observed,'Held commission entries eligible for payout after reconciliation'),
    'commissionPaid',public.business_metric(v_paid_commission,'money','exact','allocated','USD',null,null,v_observed,'Commission ledger entries included in paid payout batches'),
    'aiCost',public.business_metric(case when v_priced_calls=0 then null else v_ai end,'money',case when v_total_calls=0 then 'unavailable' when v_priced_calls<v_total_calls then 'incomplete' else 'exact' end,'not_applicable','USD',v_priced_calls,v_total_calls,v_observed,'Tracked model-call cost'),
    'bonusAiCost',public.business_metric(v_bonus_ai,'money',case when v_total_calls=0 then 'unavailable' else 'exact' end,'not_applicable','USD',null,null,v_observed,'Model cost attributed to bonus-funded attempts'),
    'contribution',public.business_metric(case when v_priced_tx=0 or v_priced_calls=0 then null else v_net-v_commissions-v_ai end,'money',case when v_priced_tx<v_total_tx or v_priced_calls<v_total_calls then 'incomplete' else 'estimated' end,'estimated','USD',null,null,v_observed,'Net proceeds less creator commissions and all tracked AI cost'),
    'contributionPerSubscriber',public.business_metric(case when v_paid=0 or v_priced_tx=0 or v_priced_calls=0 then null else round((v_net-v_commissions-v_ai)/v_paid,2) end,'money',case when v_paid=0 or v_priced_tx=0 or v_priced_calls=0 then 'unavailable' when v_priced_tx<v_total_tx or v_priced_calls<v_total_calls then 'incomplete' else 'estimated' end,'estimated','USD',null,v_paid,v_observed,'Contribution divided by active production paid subscribers'),
    'cancellationRate',public.business_metric(case when v_new_paid=0 then null else round(100*v_cancellations/v_new_paid,1) end,'percent',case when v_new_paid=0 then 'unavailable' else 'exact' end,'not_applicable',null,v_cancellations,v_new_paid,v_observed,'Auto-renew disable events divided by first paid conversions in the selected operational window'),
    'refundRate',public.business_metric(case when v_total_tx=0 then null else round(100*v_refund_count/v_total_tx,1) end,'percent',case when v_total_tx=0 then 'unavailable' else 'exact' end,'not_applicable',null,v_refund_count,v_total_tx,v_observed,'Refunded production transactions divided by normalized production transactions'),
    'processingTime',public.business_metric(case when v_processing_ms is null then null else round(v_processing_ms,0) end,'milliseconds',case when v_processing_ms is null then 'unavailable' else 'exact' end,'not_applicable',null,null,null,v_observed,'Average terminal analysis session time from creation to terminal update'),
    'quotaExhaustion',public.business_metric(v_quota_denials,'count',case when v_analytics_observed is null then 'incomplete' else 'exact' end,'not_applicable',null,v_quota_denials,null,v_analytics_observed,'Recorded analysis reservation denials caused by exhausted quota'),
    'subscriberRetention',public.business_metric(case when v_subscriber_retention_den=0 then null else round(100*v_subscriber_retention_num/v_subscriber_retention_den,1) end,'percent',case when v_subscriber_retention_den=0 then 'unavailable' else 'exact' end,'not_applicable',null,v_subscriber_retention_num,v_subscriber_retention_den,v_observed,'Ever-paid production subscribers that still have current paid-through access'),
    'bonusGranted',public.business_metric(v_bonus_granted,'count','exact','not_applicable',null,null,null,v_observed,'Referral bonus units granted'),
    'bonusUsed',public.business_metric(v_bonus_used,'count','exact','not_applicable',null,null,null,v_observed,'Bonus-funded completed attempts'),
    'bonusExpired',public.business_metric(v_bonus_expired,'count','exact','not_applicable',null,null,null,v_observed,'Unused units from expired bonus grants')
    ,'bonusRevoked',public.business_metric(v_bonus_revoked,'count','exact','not_applicable',null,null,null,v_observed,'Unused bonus units removed after access revocation')
    ,'d1Retention',public.business_metric(case when v_d1_den=0 then null else round(100*v_d1_num/v_d1_den,1) end,'percent',case when v_d1_den=0 then 'unavailable' else 'exact' end,'not_applicable',null,v_d1_num,v_d1_den,v_analytics_observed,'Mature signup cohort active on local calendar day 1')
    ,'d7Retention',public.business_metric(case when v_d7_den=0 then null else round(100*v_d7_num/v_d7_den,1) end,'percent',case when v_d7_den=0 then 'unavailable' else 'exact' end,'not_applicable',null,v_d7_num,v_d7_den,v_analytics_observed,'Mature signup cohort active on local calendar day 7')
    ,'d30Retention',public.business_metric(case when v_d30_den=0 then null else round(100*v_d30_num/v_d30_den,1) end,'percent',case when v_d30_den=0 then 'unavailable' else 'exact' end,'not_applicable',null,v_d30_num,v_d30_den,v_analytics_observed,'Mature signup cohort active on local calendar day 30')
  );
  select coalesce(jsonb_agg(day_row order by day_row->>'date'),'[]'::jsonb) into v_trends from (
    select jsonb_build_object('date',metric_date,'newUsers',max(value) filter(where metric_key='new_users'),'activeUsers',max(value) filter(where metric_key='active_users'),'analyses',max(value) filter(where metric_key='analyses'),'newPaid',max(value) filter(where metric_key='new_paid'),'grossRevenue',max(value) filter(where metric_key='gross_revenue'),'aiCost',max(value) filter(where metric_key='ai_cost')) day_row
    from public.business_daily_metrics where metric_date>=greatest(v_start::date,current_date-90) group by metric_date
  ) daily;
  select coalesce(jsonb_agg(row_data order by row_data->>'displayName'),'[]'::jsonb) into v_creator_rows from (
    select jsonb_build_object(
      'id',creator.id,
      'displayName',creator.display_name,
      'status',creator.status,
      'slug',link.public_slug,
      'linkStatus',link.status,
      'rateBasisPoints',rate.commission_basis_points,
      'memberships',(select coalesce(jsonb_agg(jsonb_build_object('userId',membership.user_id,'status',membership.status,'createdAt',membership.created_at) order by membership.created_at),'[]'::jsonb) from public.creator_memberships membership where membership.creator_id=creator.id),
      'visits',(select count(*) from public.referral_visits visit where visit.creator_link_id=link.id and visit.environment='production' and visit.issued_at>=v_start),
      'recovered',(select count(*) from public.referral_visits visit where visit.creator_link_id=link.id and visit.environment='production' and visit.recovered_at>=v_start),
      'pendingVisits',(select count(*) from public.referral_visits visit where visit.creator_link_id=link.id and visit.environment='production' and visit.issued_at>=v_start and visit.claimed_at is null and visit.expires_at>now() and visit.excluded_reason is null),
      'expiredUnmatchedVisits',(select count(*) from public.referral_visits visit where visit.creator_link_id=link.id and visit.environment='production' and visit.issued_at>=v_start and visit.claimed_at is null and visit.expires_at<=now() and visit.excluded_reason is null),
      'excludedRequests',(select count(*) from public.creator_referral_exclusions exclusion where exclusion.creator_link_id=link.id and exclusion.excluded_at>=v_start),
      'accounts',(select count(*) from public.account_referrals referral where referral.creator_id=creator.id and referral.environment='production' and referral.attributed_at>=v_start),
      'paid',(select count(*) from public.account_referrals referral where referral.creator_id=creator.id and referral.environment='production' and exists(select 1 from public.subscription_transactions transaction where transaction.user_id=referral.user_id and transaction.environment='PRODUCTION' and transaction.gross_amount>0 and coalesce(transaction.purchased_at,transaction.created_at)>=v_start and not exists(select 1 from public.subscription_transactions earlier where earlier.user_id=transaction.user_id and earlier.environment='PRODUCTION' and earlier.gross_amount>0 and coalesce(earlier.purchased_at,earlier.created_at)<coalesce(transaction.purchased_at,transaction.created_at)))),
      'grossRevenue',(select coalesce(sum(transaction.gross_amount),0) from public.subscription_transactions transaction where transaction.creator_id=creator.id and transaction.environment='PRODUCTION' and transaction.currency='USD' and coalesce(transaction.purchased_at,transaction.created_at)>=v_start),
      'commission',(select coalesce(sum(entry.amount),0) from public.creator_commission_entries entry where entry.creator_id=creator.id and entry.currency='USD' and entry.created_at>=v_start),
      'pending',(select coalesce(sum(entry.amount),0) from public.creator_commission_entries entry where entry.creator_id=creator.id and entry.currency='USD' and entry.status='pending'),
      'payable',(select coalesce(sum(entry.amount),0) from public.creator_commission_entries entry where entry.creator_id=creator.id and entry.currency='USD' and (entry.status='payable' or (entry.status='pending' and entry.hold_until<=now() and exists(select 1 from public.transaction_reconciliation_allocations allocation where allocation.transaction_id=entry.transaction_id)))),
      'paidAmount',(select coalesce(sum(entry.amount),0) from public.creator_commission_entries entry where entry.creator_id=creator.id and entry.currency='USD' and entry.status='paid'),
      'earningsByCurrency',(select coalesce(jsonb_agg(jsonb_build_object('currency',currency,'pending',pending,'payable',payable,'paid',paid,'adjustments',adjustments) order by currency),'[]'::jsonb) from (select entry.currency,
        coalesce(sum(entry.amount) filter(where entry.status='pending' and not (entry.hold_until<=now() and exists(select 1 from public.transaction_reconciliation_allocations allocation where allocation.transaction_id=entry.transaction_id))),0) pending,
        coalesce(sum(entry.amount) filter(where entry.status='payable' or (entry.status='pending' and entry.hold_until<=now() and exists(select 1 from public.transaction_reconciliation_allocations allocation where allocation.transaction_id=entry.transaction_id))),0) payable,
        coalesce(sum(entry.amount) filter(where entry.status='paid'),0) paid,
        coalesce(sum(entry.amount) filter(where entry.entry_type<>'accrual'),0) adjustments
        from public.creator_commission_entries entry where entry.creator_id=creator.id group by entry.currency) currency_rows),
      'bonusRecipients',(select count(*) from public.referral_bonus_grants grant_row join public.account_referrals referral on referral.user_id=grant_row.user_id where referral.creator_id=creator.id and referral.environment='production' and grant_row.granted_at>=v_start and not exists(select 1 from public.business_test_accounts test where test.user_id=grant_row.user_id)),
      'bonusGranted',(select coalesce(sum(grant_row.units_granted),0) from public.referral_bonus_grants grant_row join public.account_referrals referral on referral.user_id=grant_row.user_id where referral.creator_id=creator.id and referral.environment='production' and grant_row.granted_at>=v_start and not exists(select 1 from public.business_test_accounts test where test.user_id=grant_row.user_id)),
      'bonusUsed',(select count(*) from public.analysis_credit_reservations reservation join public.referral_bonus_grants grant_row on grant_row.id=reservation.bonus_grant_id join public.account_referrals referral on referral.user_id=grant_row.user_id where referral.creator_id=creator.id and referral.environment='production' and reservation.status='committed' and reservation.committed_at>=v_start and not exists(select 1 from public.business_test_accounts test where test.user_id=grant_row.user_id)),
      'bonusAiCost',(select coalesce(sum(telemetry.estimated_cost_usd),0) from public.model_call_telemetry telemetry join public.analysis_attempts attempt on attempt.id=telemetry.analysis_attempt_id join public.analysis_credit_reservations reservation on reservation.id=attempt.reservation_id join public.referral_bonus_grants grant_row on grant_row.id=reservation.bonus_grant_id join public.account_referrals referral on referral.user_id=grant_row.user_id where referral.creator_id=creator.id and referral.environment='production' and telemetry.created_at>=v_start and not exists(select 1 from public.business_test_accounts test where test.user_id=grant_row.user_id)),
      'referrals',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',substr(encode(public.digest(referral.user_id::text,'sha256'),'hex'),1,12),
        'signedUpAt',referral.attributed_at,
        'paidAt',(select min(transaction.purchased_at) from public.subscription_transactions transaction where transaction.user_id=referral.user_id and transaction.environment='PRODUCTION' and transaction.gross_amount>0),
        'commissionStatus',(select entry.status from public.creator_commission_entries entry where entry.referred_user_id=referral.user_id and entry.entry_type='accrual' limit 1),
        'commissionAmount',(select entry.amount from public.creator_commission_entries entry where entry.referred_user_id=referral.user_id and entry.entry_type='accrual' limit 1),
        'commissionCurrency',(select entry.currency from public.creator_commission_entries entry where entry.referred_user_id=referral.user_id and entry.entry_type='accrual' limit 1),
        'bonusState',(select case when grant_row.revoked_at is not null then 'revoked' when grant_row.period_end<=now() then 'expired' else 'active' end from public.referral_bonus_grants grant_row where grant_row.user_id=referral.user_id)
      ) order by referral.attributed_at desc),'[]'::jsonb) from public.account_referrals referral where referral.creator_id=creator.id and referral.environment='production'),
      'payouts',(select coalesce(jsonb_agg(jsonb_build_object('id',payout.id,'currency',payout.currency,'amount',payout.amount,'status',payout.status,'preparedAt',payout.prepared_at,'paidAt',payout.paid_at,'externalReference',payout.external_reference) order by payout.prepared_at desc),'[]'::jsonb) from public.creator_payouts payout where payout.creator_id=creator.id)
    ) row_data
    from public.creators creator
    left join lateral (select creator_link.public_slug,creator_link.status from public.creator_links creator_link where creator_link.creator_id=creator.id order by creator_link.created_at limit 1) link on true
    left join lateral (select version.commission_basis_points from public.creator_rate_versions version where version.creator_id=creator.id and version.effective_to is null order by version.effective_from desc limit 1) rate on true
  ) rows;
  select jsonb_build_object(
    'selfReported',public.business_suppress_small_groups((select coalesce(jsonb_agg(jsonb_build_object('label',self_reported_source,'users',users)),'[]'::jsonb) from (select self_reported_source,count(*) users from public.onboarding_reporting_snapshots where completed_at>=v_start group by self_reported_source) x)),
    'verifiedAcquisition',public.business_suppress_small_groups((select coalesce(jsonb_agg(jsonb_build_object('label',label,'users',users)),'[]'::jsonb) from (select case when referral.user_id is not null then 'creator_referral' else snapshot.self_reported_source end label,count(*) users from public.onboarding_reporting_snapshots snapshot left join public.account_referrals referral on referral.user_id=snapshot.user_id and referral.environment='production' where snapshot.completed_at>=v_start group by 1) x)),
    'ageRanges',public.business_suppress_small_groups((select coalesce(jsonb_agg(jsonb_build_object('label',age_range,'users',users)),'[]'::jsonb) from (select age_range,count(*) users from public.onboarding_reporting_snapshots where completed_at>=v_start group by age_range) x)),
    'gender',public.business_suppress_small_groups((select coalesce(jsonb_agg(jsonb_build_object('label',gender,'users',users)),'[]'::jsonb) from (select gender,count(*) users from public.onboarding_reporting_snapshots where completed_at>=v_start group by gender) x)),
    'experience',public.business_suppress_small_groups((select coalesce(jsonb_agg(jsonb_build_object('label',experience,'users',users)),'[]'::jsonb) from (select experience,count(*) users from public.onboarding_reporting_snapshots where completed_at>=v_start group by experience) x)),
    'frustrations',public.business_suppress_small_groups((select coalesce(jsonb_agg(jsonb_build_object('label',biggest_frustration,'users',users)),'[]'::jsonb) from (select biggest_frustration,count(*) users from public.onboarding_reporting_snapshots where completed_at>=v_start group by biggest_frustration) x)),
    'workoutFrequency',public.business_suppress_small_groups((select coalesce(jsonb_agg(jsonb_build_object('label',workouts_per_week::text,'users',users)),'[]'::jsonb) from (select workouts_per_week,count(*) users from public.onboarding_reporting_snapshots where completed_at>=v_start group by workouts_per_week) x)),
    'goals',public.business_suppress_small_groups((select coalesce(jsonb_agg(jsonb_build_object('label',primary_goal,'users',users)),'[]'::jsonb) from (select primary_goal,count(*) users from public.onboarding_reporting_snapshots where completed_at>=v_start group by primary_goal) x)),
    'milestoneThemes',public.business_suppress_small_groups((select coalesce(jsonb_agg(jsonb_build_object('label',milestone_theme,'users',users)),'[]'::jsonb) from (select milestone_theme,count(*) users from public.onboarding_reporting_snapshots where completed_at>=v_start group by milestone_theme) x)),
    'onboardingScreens',coalesce((select jsonb_agg(jsonb_build_object('label',label,'users',users,'views',views,'exits',greatest(users-cta_users,0),'averageTransitionMs',average_transition_ms) order by first_seen) from (
      select viewed.label,count(distinct viewed.anonymous_id) users,count(*) views,count(distinct cta.anonymous_id) cta_users,min(viewed.occurred_at) first_seen,avg(extract(epoch from (cta.occurred_at-viewed.occurred_at))*1000) filter(where cta.occurred_at>=viewed.occurred_at) average_transition_ms
      from (select anonymous_id,occurred_at,coalesce(properties->>'step',properties->>'screenId','unknown') label from public.product_analytics_events where event_name='onboarding_screen_viewed' and occurred_at>=v_start) viewed
      left join lateral (select event.anonymous_id,event.occurred_at from public.product_analytics_events event where event.event_name='onboarding_cta_tapped' and event.anonymous_id=viewed.anonymous_id and coalesce(event.properties->>'step',event.properties->>'screenId','unknown')=viewed.label and event.occurred_at>=viewed.occurred_at order by event.occurred_at limit 1) cta on true
      group by viewed.label
    ) x),'[]'::jsonb),
    'exercisePopularity',coalesce((select jsonb_agg(jsonb_build_object('label',label,'users',users,'analyses',analyses) order by analyses desc) from (select coalesce(session.detected_label,session.corrected_label,'Unknown') label,count(distinct attempt.user_id) users,count(*) analyses from public.analysis_attempts attempt join public.analysis_sessions session on session.id=attempt.session_id where attempt.status in ('complete','partial') and attempt.terminal_at>=v_start group by 1 limit 25) x),'[]'::jsonb),
    'analysisOutcomes',coalesce((select jsonb_agg(jsonb_build_object('label',status,'users',attempts)) from (select status,count(*) attempts from public.analysis_attempts where coalesce(terminal_at,updated_at)>=v_start group by status) x),'[]'::jsonb),
    'reanalysis',coalesce((select jsonb_agg(jsonb_build_object('label',kind,'users',attempts)) from (select kind,count(*) attempts from public.analysis_attempts where created_at>=v_start group by kind) x),'[]'::jsonb),
    'firstWeekAnalysisDepth',coalesce((select jsonb_agg(jsonb_build_object('label',depth,'users',users) order by depth) from (select case when delivered=0 then 'zero' when delivered=1 then 'one' else 'two_or_more' end depth,count(*) users from (select signup.id,count(attempt.id) filter(where attempt.status in ('complete','partial') and attempt.terminal_at<=signup.created_at+interval '7 days') delivered from auth.users signup left join public.analysis_attempts attempt on attempt.user_id=signup.id and attempt.created_at>=signup.created_at where signup.created_at>=v_start and signup.created_at<=v_now-interval '7 days' and not exists(select 1 from public.business_test_accounts test where test.user_id=signup.id) group by signup.id) cohorts group by 1) depth),'[]'::jsonb),
    'onboardingFunnel',(select jsonb_build_array(
      jsonb_build_object('label','questionnaire_completed','users',count(*)),
      jsonb_build_object('label','account_created','users',count(*) filter(where account_created_at is not null)),
      jsonb_build_object('label','first_payment','users',count(*) filter(where first_paid_at is not null)),
      jsonb_build_object('label','first_analysis','users',count(*) filter(where first_analysis_at is not null)),
      jsonb_build_object('label','second_analysis','users',count(*) filter(where second_analysis_at is not null))
    ) from (
      select snapshot.user_id,snapshot.completed_at,signup.created_at account_created_at,paid.first_paid_at,attempts.first_analysis_at,attempts.second_analysis_at
      from public.onboarding_reporting_snapshots snapshot
      join auth.users signup on signup.id=snapshot.user_id and signup.created_at<=snapshot.completed_at+interval '24 hours'
      left join lateral (select min(coalesce(transaction.purchased_at,transaction.created_at)) first_paid_at from public.subscription_transactions transaction where transaction.user_id=snapshot.user_id and transaction.environment='PRODUCTION' and transaction.gross_amount>0 and coalesce(transaction.purchased_at,transaction.created_at)>=signup.created_at) paid on true
      left join lateral (select min(attempt.terminal_at) filter(where attempt.sequence=1) first_analysis_at,min(attempt.terminal_at) filter(where attempt.sequence=2) second_analysis_at from (select terminal_at,row_number() over(order by terminal_at) sequence from public.analysis_attempts where user_id=snapshot.user_id and status in ('complete','partial') and terminal_at>=coalesce(paid.first_paid_at,signup.created_at)) attempt) attempts on true
      where snapshot.completed_at>=v_start and snapshot.completed_at<v_now and not exists(select 1 from public.business_test_accounts test where test.user_id=snapshot.user_id)
    ) funnel),
    'retentionByAcquisition',public.business_retention_breakdown('acquisition',v_start,v_now),
    'retentionByCreator',public.business_retention_breakdown('creator',v_start,v_now),
    'retentionByExperience',public.business_retention_breakdown('experience',v_start,v_now),
    'retentionByGoal',public.business_retention_breakdown('goal',v_start,v_now),
    'bonusComparison',public.business_bonus_comparison(v_start,v_now),
    'revenueCurrencies',coalesce((select jsonb_agg(jsonb_build_object('label',currency,'gross',gross,'transactions',transactions)) from (select coalesce(currency,'unknown') currency,coalesce(sum(gross_amount),0) gross,count(*) transactions from public.subscription_transactions transaction where environment='PRODUCTION' and coalesce(purchased_at,created_at)>=v_start and not exists(select 1 from public.business_test_accounts test where test.user_id=transaction.user_id) group by currency) x),'[]'::jsonb)
    ,'financialImports',coalesce((select jsonb_agg(jsonb_build_object(
      'id',report.id,'fileName',report.source_file_name,'fiscalPeriodStart',report.fiscal_period_start,
      'fiscalPeriodEnd',report.fiscal_period_end,'currency',report.report_currency,'status',report.status,
      'rows',report.row_count,'allocatedTransactions',coalesce(allocation.allocated_transactions,0),
      'allocatedProceeds',coalesce(allocation.allocated_proceeds,0),'validationError',report.validation_error,
      'createdAt',report.created_at,'reconciledAt',report.reconciled_at
    ) order by report.fiscal_period_end desc,report.created_at desc) from public.apple_financial_imports report
      left join lateral (select count(distinct item.transaction_id) allocated_transactions,sum(item.allocated_proceeds) allocated_proceeds from public.transaction_reconciliation_allocations item where item.import_id=report.id) allocation on true),'[]'::jsonb)
    ,'reconciledProceeds',coalesce((select jsonb_agg(jsonb_build_object('fiscalPeriodStart',fiscal_period_start,'fiscalPeriodEnd',fiscal_period_end,'currency',currency,'proceeds',proceeds,'transactions',transactions) order by fiscal_period_end desc,currency) from (
      select report.fiscal_period_start,report.fiscal_period_end,allocation.currency,sum(allocation.allocated_proceeds) proceeds,count(distinct allocation.transaction_id) transactions
      from public.apple_financial_imports report join public.transaction_reconciliation_allocations allocation on allocation.import_id=report.id
      group by report.fiscal_period_start,report.fiscal_period_end,allocation.currency
    ) reconciled),'[]'::jsonb)
    ,'coverage',coalesce((select jsonb_agg(jsonb_build_object('source',source_key,'observedSince',observed_since,'lastSuccessAt',last_success_at,'status',status,'detail',detail) order by source_key) from public.reporting_coverage),'[]'::jsonb)
  ) into v_growth;
  select coalesce(jsonb_agg(alert),'[]'::jsonb) into v_alerts from (
    select jsonb_build_object('key','analytics_coverage','severity','warning','message','Durable mobile analytics have not reported yet') alert where v_analytics_observed is null
    union all select jsonb_build_object('key','unpriced_ai','severity','warning','message',(v_total_calls-v_priced_calls)::text||' model calls have unavailable cost') where v_priced_calls<v_total_calls
    union all select jsonb_build_object('key','unpriced_revenue','severity','warning','message',(v_total_tx-v_priced_tx)::text||' transactions have unavailable price') where v_priced_tx<v_total_tx
    union all select jsonb_build_object('key','pending_webhooks','severity','error','message',count(*)::text||' billing events need projection') from public.revenuecat_webhook_events where financial_projection_status<>'completed' having count(*)>0
    union all select jsonb_build_object('key','unresolved_receipts','severity','error','message',count(*)::text||' production transactions are waiting for canonical account ownership') from public.subscription_transactions where environment='PRODUCTION' and user_id is null having count(*)>0
    union all select jsonb_build_object('key','missing_financial_report','severity','warning','message','No reconciled Apple financial report covers recent transactions') where exists(select 1 from public.subscription_transactions transaction where transaction.environment='PRODUCTION' and transaction.purchased_at>=now()-interval '60 days') and not exists(select 1 from public.apple_financial_imports report where report.status='reconciled' and report.fiscal_period_end>=current_date-60)
    union all select jsonb_build_object('key','payout_reconciliation','severity','warning','message',count(*)::text||' prepared payout batches have not been marked paid') from public.creator_payouts where status='prepared' having count(*)>0
    union all select jsonb_build_object('key','currency_coverage','severity','warning','message',count(distinct currency)::text||' purchase currencies exist; consolidated cards show USD only') from public.subscription_transactions where environment='PRODUCTION' and currency is not null having count(distinct currency)>1
    union all select jsonb_build_object('key','stale_billing_ingestion','severity','error','message','No RevenueCat webhook has been ingested in the last 48 hours') where exists(select 1 from public.revenuecat_webhook_events) and (select max(received_at) from public.revenuecat_webhook_events)<now()-interval '48 hours'
  ) alerts;
  return jsonb_build_object('generatedAt',now(),'rangeStart',case when v_start='-infinity'::timestamptz then null else v_start end,'rangeEnd',v_now,'section',p_section,'window',p_window,'metrics',v_metrics,'trends',v_trends,'creators',v_creator_rows,'growth',v_growth,'alerts',v_alerts);
end $$;

create or replace function public.run_business_reporting_maintenance()
returns void language plpgsql security definer set search_path='' as $$
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  perform public.expire_analysis_reservations();
  update public.referral_bonus_grants set state='expired' where state='active' and period_end<=now();
  perform public.refresh_business_daily_metrics((now() at time zone 'America/New_York')::date);
end $$;

create or replace function public.get_creator_dashboard_v1(p_window text default '30d')
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_creator uuid; v_start timestamptz; v_row record;
begin
  select creator_id into v_creator from public.creator_memberships where user_id=auth.uid() and status='active';
  if v_creator is null then raise exception 'CREATOR_ACCESS_REQUIRED'; end if;
  if p_window not in ('24h','7d','30d','90d','all') then raise exception 'INVALID_WINDOW'; end if;
  v_start:=case p_window when '24h' then now()-interval '24 hours' when '7d' then now()-interval '7 days' when '30d' then now()-interval '30 days' when '90d' then now()-interval '90 days' else '-infinity'::timestamptz end;
  select creator.display_name,creator.status,link.public_slug,rate.commission_basis_points into v_row
  from public.creators creator join public.creator_links link on link.creator_id=creator.id
  left join public.creator_rate_versions rate on rate.creator_id=creator.id and rate.effective_to is null where creator.id=v_creator;
  return jsonb_build_object('generatedAt',now(),'window',p_window,'creator',jsonb_build_object('displayName',v_row.display_name,'status',v_row.status,'referralUrl','https://useformie.com/r/'||v_row.public_slug,'rateBasisPoints',v_row.commission_basis_points),
    'metrics',jsonb_build_object(
      'visits',(select count(*) from public.referral_visits visit join public.creator_links link on link.id=visit.creator_link_id where link.creator_id=v_creator and visit.environment='production' and visit.issued_at>=v_start),
      'recovered',(select count(*) from public.referral_visits visit join public.creator_links link on link.id=visit.creator_link_id where link.creator_id=v_creator and visit.environment='production' and visit.recovered_at>=v_start),
      'accounts',(select count(*) from public.account_referrals where creator_id=v_creator and environment='production' and attributed_at>=v_start),
      'paid',(select count(*) from public.account_referrals referral where referral.creator_id=v_creator and referral.environment='production' and exists(select 1 from public.subscription_transactions transaction where transaction.user_id=referral.user_id and transaction.environment='PRODUCTION' and transaction.gross_amount>0 and coalesce(transaction.purchased_at,transaction.created_at)>=v_start and not exists(select 1 from public.subscription_transactions earlier where earlier.user_id=transaction.user_id and earlier.environment='PRODUCTION' and earlier.gross_amount>0 and coalesce(earlier.purchased_at,earlier.created_at)<coalesce(transaction.purchased_at,transaction.created_at)))),
      'bonusRecipients',(select count(*) from public.referral_bonus_grants grant_row join public.account_referrals referral on referral.user_id=grant_row.user_id where referral.creator_id=v_creator and referral.environment='production' and grant_row.granted_at>=v_start),
      'pending',(select coalesce(sum(amount),0) from public.creator_commission_entries where creator_id=v_creator and currency='USD' and status='pending'),
      'payable',(select coalesce(sum(amount),0) from public.creator_commission_entries where creator_id=v_creator and currency='USD' and status='payable'),
      'paidAmount',(select coalesce(sum(amount),0) from public.creator_commission_entries where creator_id=v_creator and currency='USD' and status='paid')
    ),
    'earningsByCurrency',coalesce((select jsonb_agg(jsonb_build_object('currency',currency,'pending',pending,'payable',payable,'paid',paid,'adjustments',adjustments) order by currency) from (select currency,
      coalesce(sum(amount) filter(where status='pending' and not (hold_until<=now() and exists(select 1 from public.transaction_reconciliation_allocations allocation where allocation.transaction_id=entry.transaction_id))),0) pending,
      coalesce(sum(amount) filter(where status='payable' or (status='pending' and hold_until<=now() and exists(select 1 from public.transaction_reconciliation_allocations allocation where allocation.transaction_id=entry.transaction_id))),0) payable,
      coalesce(sum(amount) filter(where status='paid'),0) paid,
      coalesce(sum(amount) filter(where entry_type<>'accrual'),0) adjustments
      from public.creator_commission_entries entry where creator_id=v_creator group by currency) balances),'[]'::jsonb),
    'referrals',coalesce((select jsonb_agg(jsonb_build_object('id',substr(encode(public.digest(referral.user_id::text,'sha256'),'hex'),1,12),'signedUpAt',referral.attributed_at,'paidAt',(select min(transaction.purchased_at) from public.subscription_transactions transaction where transaction.user_id=referral.user_id and transaction.gross_amount>0 and transaction.environment='PRODUCTION'),'commissionStatus',(select entry.status from public.creator_commission_entries entry where entry.referred_user_id=referral.user_id and entry.entry_type='accrual' limit 1),'commissionAmount',(select entry.amount from public.creator_commission_entries entry where entry.referred_user_id=referral.user_id and entry.entry_type='accrual' limit 1),'commissionCurrency',(select entry.currency from public.creator_commission_entries entry where entry.referred_user_id=referral.user_id and entry.entry_type='accrual' limit 1)) order by referral.attributed_at desc) from public.account_referrals referral where referral.creator_id=v_creator and referral.environment='production' and referral.attributed_at>=v_start),'[]'::jsonb),
    'payouts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'currency',currency,'amount',amount,'status',status,'preparedAt',prepared_at,'paidAt',paid_at) order by prepared_at desc) from public.creator_payouts where creator_id=v_creator),'[]'::jsonb));
end $$;

do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname='refresh-business-daily-metrics';
    perform cron.schedule('refresh-business-daily-metrics','12 * * * *','select public.refresh_business_daily_metrics((now() at time zone ''America/New_York'')::date)');
    perform cron.unschedule(jobid) from cron.job where jobname='formie-business-maintenance';
    perform cron.schedule('formie-business-maintenance','17 * * * *','select public.run_business_reporting_maintenance()');
  end if;
end $$;

revoke all on function public.business_metric(numeric,text,text,text,text,numeric,numeric,timestamptz,text),public.business_suppress_small_groups(jsonb),public.business_suppress_group_rows(jsonb),public.business_retention_breakdown(text,timestamptz,timestamptz),public.business_bonus_comparison(timestamptz,timestamptz),public.refresh_business_daily_metrics(date),public.run_business_reporting_maintenance(),public.get_founder_business_dashboard(text,text,date,date) from public,anon,authenticated;
grant execute on function public.refresh_business_daily_metrics(date),public.run_business_reporting_maintenance(),public.get_founder_business_dashboard(text,text,date,date) to service_role;
revoke all on function public.get_creator_dashboard_v1(text) from public,anon;
grant execute on function public.get_creator_dashboard_v1(text) to authenticated;
