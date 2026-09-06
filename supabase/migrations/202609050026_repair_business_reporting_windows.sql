-- Apply the selected reporting cutoff consistently and build the ordered
-- onboarding funnel from durable transition events rather than profile rows.
create or replace function public.get_founder_business_dashboard_v6(
  p_section text default 'overview',p_window text default '30d',p_start date default null,p_end date default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  result jsonb; growth jsonb; start_at timestamptz; end_at timestamptz; observed timestamptz; analytics_observed timestamptz;
  new_users numeric; analyses numeric; analysis_users numeric; total_calls numeric; priced_calls numeric; ai_cost numeric;
  helpful numeric; unhelpful numeric; new_paid numeric; cancellations numeric; refund_count numeric;
  conversion_den numeric; conversion_num numeric; observed_den numeric; observed_num numeric;
  visits numeric; claimed numeric; pending numeric; expired numeric; excluded numeric;
  creator_den numeric; creator_num numeric; processing_ms numeric; quota_denials numeric;
  d1_den numeric; d1_num numeric; d7_den numeric; d7_num numeric; d30_den numeric; d30_num numeric;
  bonus_granted numeric; bonus_used numeric; bonus_expired numeric; bonus_revoked numeric; funnel jsonb; trends jsonb;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  result:=public.get_founder_business_dashboard_v5(p_section,p_window,p_start,p_end);
  start_at:=coalesce((result->>'rangeStart')::timestamptz,'-infinity'::timestamptz);
  end_at:=(result->>'rangeEnd')::timestamptz;
  observed:=nullif(result#>>'{metrics,newUsers,observedSince}','')::timestamptz;
  analytics_observed:=nullif(result#>>'{metrics,dau,observedSince}','')::timestamptz;

  select count(*) into new_users from auth.users account
  where account.created_at>=start_at and account.created_at<end_at
    and not exists(select 1 from public.creator_memberships membership where membership.user_id=account.id)
    and not exists(select 1 from public.business_test_accounts test where test.user_id=account.id);
  select count(*),count(distinct attempt.user_id) into analyses,analysis_users
  from public.analysis_attempts attempt where attempt.status in ('complete','partial')
    and coalesce(attempt.terminal_at,attempt.updated_at)>=start_at and coalesce(attempt.terminal_at,attempt.updated_at)<end_at
    and not exists(select 1 from public.business_test_accounts test where test.user_id=attempt.user_id);
  select count(*),count(telemetry.estimated_cost_usd),coalesce(sum(telemetry.estimated_cost_usd),0)
    into total_calls,priced_calls,ai_cost
  from public.model_call_telemetry telemetry join public.analysis_sessions session on session.id=telemetry.session_id
  where telemetry.created_at>=start_at and telemetry.created_at<end_at
    and not exists(select 1 from public.business_test_accounts test where test.user_id=session.user_id);
  select count(*) filter(where feedback.helpful),count(*) filter(where not feedback.helpful) into helpful,unhelpful
  from public.analysis_feedback feedback join public.analysis_sessions session on session.id=feedback.session_id
  where feedback.created_at>=start_at and feedback.created_at<end_at
    and not exists(select 1 from public.business_test_accounts test where test.user_id=session.user_id);
  select count(*) into new_paid from (
    select transaction.user_id,min(coalesce(transaction.purchased_at,transaction.created_at)) first_paid
    from public.subscription_transactions transaction where transaction.environment='PRODUCTION' and transaction.gross_amount>0
      and transaction.user_id is not null and not exists(select 1 from public.business_test_accounts test where test.user_id=transaction.user_id)
    group by transaction.user_id
  ) firsts where first_paid>=start_at and first_paid<end_at;
  select count(*) into cancellations from public.revenuecat_webhook_events event
  where event.environment='PRODUCTION' and event.event_type='CANCELLATION'
    and coalesce(event.event_timestamp,event.received_at)>=start_at and coalesce(event.event_timestamp,event.received_at)<end_at
    and not exists(select 1 from public.business_test_accounts test where test.user_id=event.user_id);
  select count(*) into refund_count from public.subscription_transactions transaction
  where transaction.environment='PRODUCTION' and transaction.refunded_at>=start_at and transaction.refunded_at<end_at
    and not exists(select 1 from public.business_test_accounts test where test.user_id=transaction.user_id);

  select count(*),count(*) filter(where exists(
    select 1 from public.subscription_transactions transaction where transaction.user_id=signup.id
      and transaction.environment='PRODUCTION' and transaction.gross_amount>0
      and coalesce(transaction.purchased_at,transaction.created_at)>=signup.created_at
      and coalesce(transaction.purchased_at,transaction.created_at)<=signup.created_at+interval '30 days'
  )) into conversion_den,conversion_num from auth.users signup
  where signup.created_at>=start_at and signup.created_at<least(end_at,end_at-interval '30 days')
    and not exists(select 1 from public.creator_memberships membership where membership.user_id=signup.id)
    and not exists(select 1 from public.business_test_accounts test where test.user_id=signup.id);
  -- Mature cohorts are bounded by the selected end, even when that end is historical.
  select count(*),count(*) filter(where exists(
    select 1 from public.subscription_transactions transaction where transaction.user_id=signup.id
      and transaction.environment='PRODUCTION' and transaction.gross_amount>0
      and coalesce(transaction.purchased_at,transaction.created_at)>=signup.created_at
      and coalesce(transaction.purchased_at,transaction.created_at)<=least(end_at,signup.created_at+interval '30 days')
  )) into observed_den,observed_num from auth.users signup
  where signup.created_at>=start_at and signup.created_at<end_at
    and not exists(select 1 from public.creator_memberships membership where membership.user_id=signup.id)
    and not exists(select 1 from public.business_test_accounts test where test.user_id=signup.id);

  select count(*),count(*) filter(where visit.claimed_at is not null),
    count(*) filter(where visit.claimed_at is null and visit.expires_at>end_at),
    count(*) filter(where visit.claimed_at is null and visit.expires_at<=end_at)
  into visits,claimed,pending,expired from public.referral_visits visit
  where visit.environment='production' and visit.issued_at>=start_at and visit.issued_at<end_at and visit.excluded_reason is null;
  select count(*) into excluded from public.creator_referral_exclusions exclusion
    where exclusion.excluded_at>=start_at and exclusion.excluded_at<end_at;
  select count(*),count(*) filter(where exists(
    select 1 from public.subscription_transactions transaction where transaction.user_id=referral.user_id
      and transaction.environment='PRODUCTION' and transaction.gross_amount>0
      and coalesce(transaction.purchased_at,transaction.created_at)>=referral.attributed_at
      and coalesce(transaction.purchased_at,transaction.created_at)<end_at
  )) into creator_den,creator_num from public.account_referrals referral
  where referral.environment='production' and referral.attributed_at>=start_at and referral.attributed_at<end_at
    and not exists(select 1 from public.business_test_accounts test where test.user_id=referral.user_id);
  select avg(extract(epoch from (coalesce(session.completed_at,session.updated_at)-session.created_at))*1000)
    into processing_ms from public.analysis_sessions session
    where session.status in ('complete','partial','failed','unable')
      and coalesce(session.completed_at,session.updated_at)>=start_at and coalesce(session.completed_at,session.updated_at)<end_at;
  select count(*) into quota_denials from public.product_analytics_events event
    where event.event_name='analysis_reservation_denied' and event.properties->>'errorCategory' in ('ANALYSIS_QUOTA_EXCEEDED','AnalysisApiError')
      and event.occurred_at>=start_at and event.occurred_at<end_at;

  select coalesce(sum(grant_row.units_granted),0),
    coalesce(sum((select count(*) from public.analysis_credit_reservations reservation where reservation.bonus_grant_id=grant_row.id and reservation.status='committed' and reservation.committed_at<end_at)),0),
    coalesce(sum(case when grant_row.period_end<=end_at and grant_row.revoked_at is null then greatest(grant_row.units_granted-(select count(*) from public.analysis_credit_reservations reservation where reservation.bonus_grant_id=grant_row.id and reservation.status='committed' and reservation.committed_at<end_at),0) else 0 end),0),
    coalesce(sum(case when grant_row.revoked_at is not null and grant_row.revoked_at<end_at then greatest(grant_row.units_granted-(select count(*) from public.analysis_credit_reservations reservation where reservation.bonus_grant_id=grant_row.id and reservation.status='committed' and reservation.committed_at<end_at),0) else 0 end),0)
  into bonus_granted,bonus_used,bonus_expired,bonus_revoked
  from public.referral_bonus_grants grant_row join public.subscription_transactions transaction on transaction.id=grant_row.qualifying_transaction_id
  where grant_row.granted_at>=start_at and grant_row.granted_at<end_at and transaction.environment='PRODUCTION'
    and not exists(select 1 from public.business_test_accounts test where test.user_id=grant_row.user_id);

  select count(*),count(*) filter(where exists(select 1 from public.product_analytics_events event where event.user_id=signup.id and (event.occurred_at at time zone 'America/New_York')::date=(signup.created_at at time zone 'America/New_York')::date+1 and event.occurred_at<end_at) or exists(select 1 from public.analysis_attempts attempt where attempt.user_id=signup.id and (attempt.updated_at at time zone 'America/New_York')::date=(signup.created_at at time zone 'America/New_York')::date+1 and attempt.updated_at<end_at)) into d1_den,d1_num
    from auth.users signup where signup.created_at>=start_at and signup.created_at<end_at-interval '2 days' and not exists(select 1 from public.business_test_accounts test where test.user_id=signup.id) and not exists(select 1 from public.creator_memberships membership where membership.user_id=signup.id);
  select count(*),count(*) filter(where exists(select 1 from public.product_analytics_events event where event.user_id=signup.id and (event.occurred_at at time zone 'America/New_York')::date=(signup.created_at at time zone 'America/New_York')::date+7 and event.occurred_at<end_at) or exists(select 1 from public.analysis_attempts attempt where attempt.user_id=signup.id and (attempt.updated_at at time zone 'America/New_York')::date=(signup.created_at at time zone 'America/New_York')::date+7 and attempt.updated_at<end_at)) into d7_den,d7_num
    from auth.users signup where signup.created_at>=start_at and signup.created_at<end_at-interval '8 days' and not exists(select 1 from public.business_test_accounts test where test.user_id=signup.id) and not exists(select 1 from public.creator_memberships membership where membership.user_id=signup.id);
  select count(*),count(*) filter(where exists(select 1 from public.product_analytics_events event where event.user_id=signup.id and (event.occurred_at at time zone 'America/New_York')::date=(signup.created_at at time zone 'America/New_York')::date+30 and event.occurred_at<end_at) or exists(select 1 from public.analysis_attempts attempt where attempt.user_id=signup.id and (attempt.updated_at at time zone 'America/New_York')::date=(signup.created_at at time zone 'America/New_York')::date+30 and attempt.updated_at<end_at)) into d30_den,d30_num
    from auth.users signup where signup.created_at>=start_at and signup.created_at<end_at-interval '31 days' and not exists(select 1 from public.business_test_accounts test where test.user_id=signup.id) and not exists(select 1 from public.creator_memberships membership where membership.user_id=signup.id);

  result:=jsonb_set(result,'{metrics,newUsers}',public.business_metric(new_users,'count','exact','not_applicable',null,new_users,null,observed,'New app accounts in the selected window.'));
  result:=jsonb_set(result,'{metrics,newSubscriptions}',public.business_metric(new_paid,'count','exact','not_applicable',null,new_paid,null,observed,'Accounts reaching their first positive production payment in the selected window.'));
  result:=jsonb_set(result,'{metrics,cancellations}',public.business_metric(cancellations,'count','exact','not_applicable',null,cancellations,null,observed,'Auto-renew disabled events in the selected window.'));
  result:=jsonb_set(result,'{metrics,refundCount}',public.business_metric(refund_count,'count','exact','not_applicable',null,refund_count,null,observed,'Production transactions refunded in the selected window.'));
  result:=jsonb_set(result,'{metrics,analyses}',public.business_metric(analyses,'count','exact','not_applicable',null,analyses,null,observed,'Completed or partial analysis attempts in the selected window.'));
  result:=jsonb_set(result,'{metrics,analysesPerActive}',public.business_metric(case when analysis_users=0 then null else round(analyses/analysis_users,2) end,'count',case when analysis_users=0 then 'unavailable' else 'exact' end,'not_applicable',null,analyses,analysis_users,observed,'Delivered attempts per active analysis user in the selected window.'));
  result:=jsonb_set(result,'{metrics,costPerAnalysis}',public.business_metric(case when analyses=0 or priced_calls=0 then null else round(ai_cost/analyses,6) end,'money',case when analyses=0 or total_calls=0 then 'unavailable' when priced_calls<total_calls then 'incomplete' else 'exact' end,'not_applicable','USD',priced_calls,analyses,observed,'Tracked pipeline cost including failed calls divided by delivered attempts in the same selected window.'));
  result:=jsonb_set(result,'{metrics,helpfulRate}',public.business_metric(case when helpful+unhelpful=0 then null else round(100*helpful/(helpful+unhelpful),1) end,'percent',case when helpful+unhelpful=0 then 'unavailable' else 'exact' end,'not_applicable',null,helpful,helpful+unhelpful,observed,'Helpful saved votes divided by submitted helpful and unhelpful votes in the selected window.'));
  result:=jsonb_set(result,'{metrics,subscriptionConversion}',public.business_metric(case when conversion_den=0 then null else round(100*conversion_num/conversion_den,1) end,'percent',case when conversion_den=0 then 'unavailable' else 'exact' end,'not_applicable',null,conversion_num,conversion_den,observed,'Mature selected signup cohorts reaching first payment within 30 days.'));
  result:=jsonb_set(result,'{metrics,observedSubscriptionConversion}',public.business_metric(case when observed_den=0 then null else round(100*observed_num/observed_den,1) end,'percent',case when observed_den=0 then 'unavailable' else 'exact' end,'not_applicable',null,observed_num,observed_den,observed,'Observed-to-date first-payment conversion for selected signup cohorts.'));
  result:=jsonb_set(result,'{metrics,clickToSignup}',public.business_metric(case when visits=0 then null else round(100*claimed/visits,1) end,'percent',case when visits=0 then 'unavailable' else 'exact' end,'not_applicable',null,claimed,visits,observed,'Claimed eligible first-party visits divided by eligible issued visits in the selected click cohort.'));
  result:=jsonb_set(result,'{metrics,creatorPaidConversion}',public.business_metric(case when creator_den=0 then null else round(100*creator_num/creator_den,1) end,'percent',case when creator_den=0 then 'unavailable' else 'exact' end,'not_applicable',null,creator_num,creator_den,observed,'Selected attributed signup cohort members reaching a positive production payment by the selected cutoff.'));
  result:=jsonb_set(result,'{metrics,pendingReferralVisits}',public.business_metric(pending,'count','exact','not_applicable',null,pending,visits,observed,'Selected valid unclaimed visits that had not expired by the selected cutoff.'));
  result:=jsonb_set(result,'{metrics,expiredUnmatchedVisits}',public.business_metric(expired,'count','exact','not_applicable',null,expired,visits,observed,'Selected valid tracked visits expired without an attributed account by the selected cutoff.'));
  result:=jsonb_set(result,'{metrics,excludedReferralRequests}',public.business_metric(excluded,'count','exact','not_applicable',null,excluded,null,observed,'Requests excluded during the selected window.'));
  result:=jsonb_set(result,'{metrics,processingTime}',public.business_metric(case when processing_ms is null then null else round(processing_ms,0) end,'milliseconds',case when processing_ms is null then 'unavailable' else 'exact' end,'not_applicable',null,null,null,observed,'Average terminal processing time for sessions ending in the selected window.'));
  result:=jsonb_set(result,'{metrics,quotaExhaustion}',public.business_metric(quota_denials,'count',case when analytics_observed is null then 'incomplete' else 'exact' end,'not_applicable',null,quota_denials,null,analytics_observed,'Recorded quota denials in the selected window.'));
  result:=jsonb_set(result,'{metrics,bonusGranted}',public.business_metric(bonus_granted,'count','exact','not_applicable',null,null,null,observed,'Referral bonus units granted in the selected window.'));
  result:=jsonb_set(result,'{metrics,bonusUsed}',public.business_metric(bonus_used,'count','exact','not_applicable',null,null,null,observed,'Bonus-funded attempts committed by the selected cutoff.'));
  result:=jsonb_set(result,'{metrics,bonusExpired}',public.business_metric(bonus_expired,'count','exact','not_applicable',null,null,null,observed,'Unused selected grant units expired by the selected cutoff.'));
  result:=jsonb_set(result,'{metrics,bonusRevoked}',public.business_metric(bonus_revoked,'count','exact','not_applicable',null,null,null,observed,'Unused selected grant units revoked by the selected cutoff.'));
  result:=jsonb_set(result,'{metrics,d1Retention}',public.business_metric(case when d1_den=0 then null else round(100*d1_num/d1_den,1) end,'percent',case when d1_den=0 then 'unavailable' else 'exact' end,'not_applicable',null,d1_num,d1_den,analytics_observed,'Selected mature signup cohort active on local calendar day 1.'));
  result:=jsonb_set(result,'{metrics,d7Retention}',public.business_metric(case when d7_den=0 then null else round(100*d7_num/d7_den,1) end,'percent',case when d7_den=0 then 'unavailable' else 'exact' end,'not_applicable',null,d7_num,d7_den,analytics_observed,'Selected mature signup cohort active on local calendar day 7.'));
  result:=jsonb_set(result,'{metrics,d30Retention}',public.business_metric(case when d30_den=0 then null else round(100*d30_num/d30_den,1) end,'percent',case when d30_den=0 then 'unavailable' else 'exact' end,'not_applicable',null,d30_num,d30_den,analytics_observed,'Selected mature signup cohort active on local calendar day 30.'));

  select jsonb_build_array(
    jsonb_build_object('label','questionnaire_completed','users',count(*)),
    jsonb_build_object('label','account_created','users',count(*) filter(where account_created_at is not null)),
    jsonb_build_object('label','first_payment','users',count(*) filter(where first_paid_at is not null)),
    jsonb_build_object('label','first_analysis','users',count(*) filter(where first_analysis_at is not null)),
    jsonb_build_object('label','second_analysis','users',count(*) filter(where second_analysis_at is not null))
  ) into funnel from (
    select cohort.user_id,account.created_at account_created_at,paid.first_paid_at,attempts.first_analysis_at,attempts.second_analysis_at
    from (
      select distinct on (coalesce(event.user_id::text,event.anonymous_id::text)) event.user_id,event.occurred_at
      from public.product_analytics_events event
      where event.event_name='onboarding_questionnaire_completed' and event.occurred_at>=start_at and event.occurred_at<end_at
      order by coalesce(event.user_id::text,event.anonymous_id::text),event.occurred_at
    ) cohort
    left join auth.users account on account.id=cohort.user_id and account.created_at>=cohort.occurred_at and account.created_at<end_at
    left join lateral (
      select min(coalesce(transaction.purchased_at,transaction.created_at)) first_paid_at
      from public.subscription_transactions transaction where transaction.user_id=account.id and transaction.environment='PRODUCTION'
        and transaction.gross_amount>0 and coalesce(transaction.purchased_at,transaction.created_at)>=account.created_at
        and coalesce(transaction.purchased_at,transaction.created_at)<end_at
    ) paid on account.id is not null
    left join lateral (
      select min(ordered.terminal_at) filter(where ordered.sequence=1) first_analysis_at,
        min(ordered.terminal_at) filter(where ordered.sequence=2) second_analysis_at
      from (
        select attempt.terminal_at,row_number() over(order by attempt.terminal_at,attempt.id) sequence
        from public.analysis_attempts attempt where attempt.user_id=account.id and attempt.status in ('complete','partial')
          and paid.first_paid_at is not null and attempt.terminal_at>=paid.first_paid_at and attempt.terminal_at<end_at
      ) ordered
    ) attempts on paid.first_paid_at is not null
    where cohort.user_id is null or not exists(select 1 from public.business_test_accounts test where test.user_id=cohort.user_id)
  ) ordered_funnel;
  growth:=jsonb_set(coalesce(result->'growth','{}'::jsonb),'{onboardingFunnel}',coalesce(funnel,'[]'::jsonb));
  growth:=jsonb_set(growth,'{financialImports}',coalesce((select jsonb_agg(jsonb_build_object(
    'id',report.id,'fileName',report.source_file_name,'fiscalPeriodStart',report.fiscal_period_start,
    'fiscalPeriodEnd',report.fiscal_period_end,'currency',report.report_currency,'status',report.status,
    'approvalStatus',report.approval_status,'rows',report.row_count,
    'allocatedTransactions',coalesce(allocation.allocated_transactions,0),'allocatedProceeds',coalesce(allocation.allocated_proceeds,0),
    'validationError',report.validation_error,'createdAt',report.created_at,'reconciledAt',report.reconciled_at,'approvedAt',report.approved_at
  ) order by report.fiscal_period_end desc,report.created_at desc) from public.apple_financial_imports report
  left join lateral (select count(distinct item.transaction_id) allocated_transactions,sum(item.allocated_proceeds) allocated_proceeds from public.transaction_reconciliation_allocations item where item.import_id=report.id and item.active) allocation on true),'[]'::jsonb));
  result:=jsonb_set(result,'{growth}',growth);
  select coalesce(jsonb_agg(day_row order by day_row->>'date'),'[]'::jsonb) into trends from (
    select jsonb_build_object('date',metric_date,'newUsers',max(value) filter(where metric_key='new_users'),'activeUsers',max(value) filter(where metric_key='active_users'),'activePaid',max(value) filter(where metric_key='active_paid'),'analyses',max(value) filter(where metric_key='analyses'),'newPaid',max(value) filter(where metric_key='new_paid'),'grossRevenue',max(value) filter(where metric_key='gross_revenue'),'aiCost',max(value) filter(where metric_key='ai_cost')) day_row
    from public.business_daily_metrics where metric_date>=greatest(start_at::date,(end_at at time zone 'America/New_York')::date-90) and metric_date<(end_at at time zone 'America/New_York')::date group by metric_date
  ) daily;
  return jsonb_set(result,'{trends}',trends);
end $$;

revoke all on function public.get_founder_business_dashboard_v6(text,text,date,date) from public,anon,authenticated;
grant execute on function public.get_founder_business_dashboard_v6(text,text,date,date) to service_role;
