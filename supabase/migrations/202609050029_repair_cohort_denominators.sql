create or replace function public.business_retention_breakdown_v2(p_dimension text,p_start timestamptz,p_end timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_dimension not in ('acquisition','creator','experience','goal') then raise exception 'INVALID_DIMENSION'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'label',label,'users',users,'d7Eligible',d7_eligible,'d7Users',d7_users,
    'd30Eligible',d30_eligible,'d30Users',d30_users,
    'd7Percent',case when d7_eligible=0 then null else round(100*d7_users/d7_eligible,1) end,
    'd30Percent',case when d30_eligible=0 then null else round(100*d30_users/d30_eligible,1) end
  )),'[]'::jsonb) into rows from (
    select label,count(*) users,
      count(*) filter(where signup_at<p_end-interval '8 days') d7_eligible,
      count(*) filter(where signup_at<p_end-interval '8 days' and (exists(select 1 from public.product_analytics_events event where event.user_id=cohort.user_id and event.occurred_at<p_end and (event.occurred_at at time zone 'America/New_York')::date=(cohort.signup_at at time zone 'America/New_York')::date+7) or exists(select 1 from public.analysis_attempts attempt where attempt.user_id=cohort.user_id and attempt.updated_at<p_end and (attempt.updated_at at time zone 'America/New_York')::date=(cohort.signup_at at time zone 'America/New_York')::date+7))) d7_users,
      count(*) filter(where signup_at<p_end-interval '31 days') d30_eligible,
      count(*) filter(where signup_at<p_end-interval '31 days' and (exists(select 1 from public.product_analytics_events event where event.user_id=cohort.user_id and event.occurred_at<p_end and (event.occurred_at at time zone 'America/New_York')::date=(cohort.signup_at at time zone 'America/New_York')::date+30) or exists(select 1 from public.analysis_attempts attempt where attempt.user_id=cohort.user_id and attempt.updated_at<p_end and (attempt.updated_at at time zone 'America/New_York')::date=(cohort.signup_at at time zone 'America/New_York')::date+30))) d30_users
    from (
      select snapshot.user_id,signup.created_at signup_at,
        case p_dimension
          when 'acquisition' then case when referral.user_id is not null then 'creator_referral' else coalesce(snapshot.self_reported_source,'unknown') end
          when 'creator' then creator.display_name
          when 'experience' then coalesce(snapshot.experience,'unknown')
          when 'goal' then coalesce(snapshot.primary_goal,'unknown') end label,
        referral.user_id referral_user_id
      from public.onboarding_reporting_snapshots snapshot join auth.users signup on signup.id=snapshot.user_id
      left join public.account_referrals referral on referral.user_id=snapshot.user_id and referral.environment='production' and referral.attributed_at<p_end
      left join public.creators creator on creator.id=referral.creator_id
      where signup.created_at>=p_start and signup.created_at<p_end
        and not exists(select 1 from public.business_test_accounts test where test.user_id=snapshot.user_id)
        and not exists(select 1 from public.creator_memberships membership where membership.user_id=snapshot.user_id)
    ) cohort where label is not null and (p_dimension<>'creator' or referral_user_id is not null) group by label
  ) grouped;
  return public.business_suppress_group_rows(rows);
end $$;

create or replace function public.business_bonus_comparison_v2(p_start timestamptz,p_end timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'label',label,'users',users,'d7Eligible',d7_eligible,'d7Users',d7_users,
    'd30Eligible',d30_eligible,'d30Users',d30_users,
    'd7Percent',case when d7_eligible=0 then null else round(100*d7_users/d7_eligible,1) end,
    'd30Percent',case when d30_eligible=0 then null else round(100*d30_users/d30_eligible,1) end,
    'averageFirst30DayAnalyses',case when d30_eligible=0 then null else round(first_30_analyses/d30_eligible,2) end
  )),'[]'::jsonb) into rows from (
    select label,count(*) users,
      count(*) filter(where first_paid_at<p_end-interval '8 days') d7_eligible,
      count(*) filter(where first_paid_at<p_end-interval '8 days' and (exists(select 1 from public.product_analytics_events event where event.user_id=cohort.user_id and event.occurred_at<p_end and (event.occurred_at at time zone 'America/New_York')::date=(cohort.first_paid_at at time zone 'America/New_York')::date+7) or exists(select 1 from public.analysis_attempts attempt where attempt.user_id=cohort.user_id and attempt.updated_at<p_end and (attempt.updated_at at time zone 'America/New_York')::date=(cohort.first_paid_at at time zone 'America/New_York')::date+7))) d7_users,
      count(*) filter(where first_paid_at<p_end-interval '31 days') d30_eligible,
      count(*) filter(where first_paid_at<p_end-interval '31 days' and (exists(select 1 from public.product_analytics_events event where event.user_id=cohort.user_id and event.occurred_at<p_end and (event.occurred_at at time zone 'America/New_York')::date=(cohort.first_paid_at at time zone 'America/New_York')::date+30) or exists(select 1 from public.analysis_attempts attempt where attempt.user_id=cohort.user_id and attempt.updated_at<p_end and (attempt.updated_at at time zone 'America/New_York')::date=(cohort.first_paid_at at time zone 'America/New_York')::date+30))) d30_users,
      sum(case when first_paid_at<p_end-interval '31 days' then (select count(*) from public.analysis_attempts attempt where attempt.user_id=cohort.user_id and attempt.status in ('complete','partial') and attempt.terminal_at>=cohort.first_paid_at and attempt.terminal_at<least(p_end,cohort.first_paid_at+interval '30 days')) else 0 end) first_30_analyses
    from (
      select firsts.user_id,firsts.first_paid_at,case when bonus.user_id is not null then 'bonus_recipient' else 'non_referred_comparison' end label
      from (select transaction.user_id,min(coalesce(transaction.purchased_at,transaction.created_at)) first_paid_at from public.subscription_transactions transaction where transaction.user_id is not null and transaction.environment='PRODUCTION' and transaction.gross_amount>0 group by transaction.user_id) firsts
      left join public.referral_bonus_grants bonus on bonus.user_id=firsts.user_id and bonus.granted_at<p_end
      left join public.account_referrals referral on referral.user_id=firsts.user_id and referral.environment='production' and referral.attributed_at<p_end
      where firsts.first_paid_at>=p_start and firsts.first_paid_at<p_end and (bonus.user_id is not null or referral.user_id is null)
        and not exists(select 1 from public.business_test_accounts test where test.user_id=firsts.user_id)
    ) cohort group by label
  ) grouped;
  return public.business_suppress_group_rows(rows);
end $$;

create or replace function public.business_first_week_analysis_retention(p_start timestamptz,p_end timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'label',depth,'users',users,'d30Eligible',d30_eligible,'d30Users',d30_users,
    'd30Percent',case when d30_eligible=0 then null else round(100*d30_users/d30_eligible,1) end
  ) order by depth),'[]'::jsonb) into rows from (
    select depth,count(*) users,count(*) filter(where signup_at<p_end-interval '31 days') d30_eligible,
      count(*) filter(where signup_at<p_end-interval '31 days' and (exists(select 1 from public.product_analytics_events event where event.user_id=cohort.user_id and event.occurred_at<p_end and (event.occurred_at at time zone 'America/New_York')::date=(cohort.signup_at at time zone 'America/New_York')::date+30) or exists(select 1 from public.analysis_attempts attempt where attempt.user_id=cohort.user_id and attempt.updated_at<p_end and (attempt.updated_at at time zone 'America/New_York')::date=(cohort.signup_at at time zone 'America/New_York')::date+30))) d30_users
    from (
      select signup.id user_id,signup.created_at signup_at,case when count(attempt.id)=0 then 'zero' when count(attempt.id)=1 then 'one' else 'two_or_more' end depth
      from auth.users signup left join public.analysis_attempts attempt on attempt.user_id=signup.id and attempt.status in ('complete','partial') and attempt.terminal_at>=signup.created_at and attempt.terminal_at<least(p_end,signup.created_at+interval '7 days')
      where signup.created_at>=p_start and signup.created_at<p_end-interval '8 days'
        and not exists(select 1 from public.business_test_accounts test where test.user_id=signup.id)
        and not exists(select 1 from public.creator_memberships membership where membership.user_id=signup.id)
      group by signup.id,signup.created_at
    ) cohort group by depth
  ) grouped;
  return rows;
end $$;

create or replace function public.get_founder_business_dashboard_v9(
  p_section text default 'overview',p_window text default '30d',p_start date default null,p_end date default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; growth jsonb; start_at timestamptz; end_at timestamptz; retained numeric; cohort_size numeric; observed timestamptz;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  result:=public.get_founder_business_dashboard_v8(p_section,p_window,p_start,p_end);
  start_at:=coalesce((result->>'rangeStart')::timestamptz,'-infinity'::timestamptz); end_at:=(result->>'rangeEnd')::timestamptz;
  observed:=nullif(result#>>'{metrics,subscriberRetention,observedSince}','')::timestamptz;
  select count(*),count(*) filter(where exists(select 1 from public.subscription_transactions active where active.user_id=cohort.user_id and active.environment='PRODUCTION' and active.gross_amount>0 and coalesce(active.period_start,active.purchased_at,active.created_at)<end_at and active.period_end>=end_at and (active.refunded_at is null or active.refunded_at>=end_at)))
    into cohort_size,retained from (
      select transaction.user_id,min(coalesce(transaction.purchased_at,transaction.created_at)) first_paid_at
      from public.subscription_transactions transaction where transaction.user_id is not null and transaction.environment='PRODUCTION' and transaction.gross_amount>0 and not exists(select 1 from public.business_test_accounts test where test.user_id=transaction.user_id) group by transaction.user_id
    ) cohort where cohort.first_paid_at>=start_at and cohort.first_paid_at<end_at;
  result:=jsonb_set(result,'{metrics,subscriberRetention}',public.business_metric(case when cohort_size=0 then null else round(100*retained/cohort_size,1) end,'percent',case when cohort_size=0 then 'unavailable' else 'exact' end,'not_applicable',null,retained,cohort_size,observed,'Selected first-payment cohort with paid-through production access at the selected comparison boundary.'));
  growth:=coalesce(result->'growth','{}'::jsonb);
  growth:=jsonb_set(growth,'{retentionByAcquisition}',public.business_retention_breakdown_v2('acquisition',start_at,end_at));
  growth:=jsonb_set(growth,'{retentionByCreator}',public.business_retention_breakdown_v2('creator',start_at,end_at));
  growth:=jsonb_set(growth,'{retentionByExperience}',public.business_retention_breakdown_v2('experience',start_at,end_at));
  growth:=jsonb_set(growth,'{retentionByGoal}',public.business_retention_breakdown_v2('goal',start_at,end_at));
  growth:=jsonb_set(growth,'{bonusComparison}',public.business_bonus_comparison_v2(start_at,end_at));
  growth:=jsonb_set(growth,'{firstWeekAnalysisDepth}',public.business_first_week_analysis_retention(start_at,end_at));
  return jsonb_set(result,'{growth}',growth);
end $$;

revoke all on function public.business_retention_breakdown_v2(text,timestamptz,timestamptz),public.business_bonus_comparison_v2(timestamptz,timestamptz),public.business_first_week_analysis_retention(timestamptz,timestamptz),public.get_founder_business_dashboard_v9(text,text,date,date) from public,anon,authenticated;
grant execute on function public.business_retention_breakdown_v2(text,timestamptz,timestamptz),public.business_bonus_comparison_v2(timestamptz,timestamptz),public.business_first_week_analysis_retention(timestamptz,timestamptz),public.get_founder_business_dashboard_v9(text,text,date,date) to service_role;
