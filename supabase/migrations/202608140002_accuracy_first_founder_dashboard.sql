-- Accuracy-first founder reporting. Financial figures are estimates with
-- explicit coverage; operational counts remain direct database facts.

create table if not exists public.ai_model_pricing (
  model text not null,
  effective_from timestamptz not null,
  effective_to timestamptz,
  input_usd_per_million numeric not null check (input_usd_per_million >= 0),
  output_usd_per_million numeric not null check (output_usd_per_million >= 0),
  primary key (model, effective_from),
  check (effective_to is null or effective_to > effective_from)
);

insert into public.ai_model_pricing(model, effective_from, effective_to, input_usd_per_million, output_usd_per_million)
values
  ('gemini-3.1-flash-lite', '2026-03-01T00:00:00Z', null, 0.25, 1.50),
  ('gemini-3.6-flash', '2026-07-01T00:00:00Z', null, 1.50, 7.50),
  ('gemini-3.7-flash', '2026-08-13T00:00:00Z', '2027-01-01T00:00:00Z', 0.75, 3.75),
  ('gemini-3.7-flash', '2027-01-01T00:00:00Z', null, 1.50, 7.50)
on conflict (model, effective_from) do update
set effective_to = excluded.effective_to,
    input_usd_per_million = excluded.input_usd_per_million,
    output_usd_per_million = excluded.output_usd_per_million;

alter table public.ai_model_pricing enable row level security;
revoke all on public.ai_model_pricing from public, anon, authenticated;
grant select on public.ai_model_pricing to service_role;

create table if not exists public.subscription_price_estimates (
  product_identifier text not null,
  effective_from timestamptz not null,
  effective_to timestamptz,
  currency text not null check (currency = 'USD'),
  gross_price numeric not null check (gross_price >= 0),
  billing_months numeric not null check (billing_months > 0),
  primary key (product_identifier, effective_from),
  check (effective_to is null or effective_to > effective_from)
);

insert into public.subscription_price_estimates(product_identifier, effective_from, effective_to, currency, gross_price, billing_months)
values
  ('formie_monthly', '2026-08-01T00:00:00Z', null, 'USD', 9.99, 1),
  ('monthly', '2026-08-01T00:00:00Z', null, 'USD', 9.99, 1),
  ('formie_yearly', '2026-08-01T00:00:00Z', null, 'USD', 99.99, 12),
  ('yearly', '2026-08-01T00:00:00Z', null, 'USD', 99.99, 12)
on conflict (product_identifier, effective_from) do update
set effective_to = excluded.effective_to,
    currency = excluded.currency,
    gross_price = excluded.gross_price,
    billing_months = excluded.billing_months;

alter table public.subscription_price_estimates enable row level security;
revoke all on public.subscription_price_estimates from public, anon, authenticated;
grant select on public.subscription_price_estimates to service_role;

create or replace function public.get_founder_dashboard_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_funnel_observed_since constant timestamptz := '2026-08-04T00:00:00Z';
begin
  if current_user not in ('postgres', 'service_role') then raise exception 'UNAUTHORIZED'; end if;

  with
  delivered as (
    select session.id, session.user_id, session.created_at, session.completed_at,
      session.status, session.analysis_total_duration_ms,
      coalesce(session.completed_at, session.created_at) as delivered_at
    from public.analysis_sessions session
    where session.status in ('complete', 'partial')
  ),
  terminal_30d as (
    select session.status
    from public.analysis_sessions session
    where session.created_at >= now() - interval '30 days'
      and session.status in ('complete', 'partial', 'unable', 'failed')
  ),
  analysis_counts as (
    select delivered.user_id, count(*)::integer as analyses,
      min(delivered.delivered_at) as first_analysis_at,
      (array_agg(delivered.delivered_at order by delivered.delivered_at))[2] as second_analysis_at,
      max(delivered.delivered_at) as last_analysis_at
    from delivered group by delivered.user_id
  ),
  active_paid as (
    select entitlement.user_id, entitlement.plan_code, entitlement.store_product_id,
      entitlement.billing_period_start, entitlement.current_period_start
    from public.user_access_entitlements entitlement
    where entitlement.status = 'active'
      and entitlement.sandbox = false
      and entitlement.entitlement_id is distinct from 'legacy'
      and coalesce(entitlement.billing_period_end, entitlement.current_period_end) > now()
  ),
  priced_active_paid as (
    select paid.*,
      pricing.gross_price / pricing.billing_months as monthly_run_rate
    from active_paid paid
    left join lateral (
      select estimate.gross_price, estimate.billing_months
      from public.subscription_price_estimates estimate
      where estimate.product_identifier = paid.store_product_id
        and estimate.effective_from <= coalesce(paid.billing_period_start, paid.current_period_start, now())
        and (estimate.effective_to is null or estimate.effective_to > coalesce(paid.billing_period_start, paid.current_period_start, now()))
      order by estimate.effective_from desc limit 1
    ) pricing on true
  ),
  revenue_stats as (
    select count(*)::numeric as total_subscriptions,
      count(monthly_run_rate)::numeric as priced_subscriptions,
      round(sum(monthly_run_rate), 2) as gross_run_rate
    from priced_active_paid
  ),
  activity as (
    select session.user_id, session.created_at from public.analysis_sessions session
    union all
    select event.user_id, event.created_at from public.product_analytics_events event where event.user_id is not null
  ),
  priced_telemetry as (
    select telemetry.*,
      coalesce(
        telemetry.estimated_cost_usd,
        case when telemetry.prompt_tokens is not null
          and telemetry.output_tokens is not null
          and telemetry.thinking_tokens is not null
          and pricing.model is not null
        then (
          telemetry.prompt_tokens * pricing.input_usd_per_million
          + (telemetry.output_tokens + telemetry.thinking_tokens) * pricing.output_usd_per_million
        ) / 1000000
        else null end
      )::numeric as calculated_cost_usd
    from public.model_call_telemetry telemetry
    left join lateral (
      select price.model, price.input_usd_per_million, price.output_usd_per_million
      from public.ai_model_pricing price
      where price.model = telemetry.model
        and price.effective_from <= telemetry.created_at
        and (price.effective_to is null or price.effective_to > telemetry.created_at)
      order by price.effective_from desc limit 1
    ) pricing on true
  ),
  month_cost_stats as (
    select count(*)::numeric as total_calls,
      count(calculated_cost_usd)::numeric as priced_calls,
      round(sum(calculated_cost_usd), 6) as tracked_cost
    from priced_telemetry
    where created_at >= date_trunc('month', now())
  ),
  session_costs as (
    select telemetry.session_id,
      count(*)::numeric as total_calls,
      count(telemetry.calculated_cost_usd)::numeric as priced_calls,
      round(sum(telemetry.calculated_cost_usd), 6) as tracked_cost
    from priced_telemetry telemetry
    group by telemetry.session_id
  ),
  feedback_counts as (
    select count(*) filter (where feedback.helpful)::numeric as helpful,
      count(*) filter (where not feedback.helpful)::numeric as unhelpful
    from public.analysis_feedback feedback
  ),
  production_purchases as (
    select entitlement.user_id,
      min(coalesce(event.purchased_at, event.event_timestamp, event.completed_at, event.received_at)) as purchase_at
    from public.revenuecat_webhook_events event
    join public.user_access_entitlements entitlement
      on event.app_user_id in (entitlement.revenuecat_app_user_id, entitlement.user_id::text)
    where event.status = 'completed'
      and upper(event.environment) = 'PRODUCTION'
      and event.event_type in ('INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE')
    group by entitlement.user_id
  ),
  cohort_base as (
    select user_row.id as user_id, user_row.created_at as signup_at,
      profile.onboarding_completed_at,
      counts.first_analysis_at,
      counts.second_analysis_at,
      paywall.paywall_at,
      purchase.purchase_at
    from auth.users user_row
    left join public.user_profiles profile on profile.user_id = user_row.id
    left join analysis_counts counts on counts.user_id = user_row.id
    left join lateral (
      select min(event.created_at) as paywall_at
      from public.product_analytics_events event
      where event.user_id = user_row.id and event.event_name = 'paywall_viewed'
    ) paywall on true
    left join production_purchases purchase on purchase.user_id = user_row.id
    where user_row.created_at >= v_funnel_observed_since
  ),
  ordered_cohort as (
    select cohort.*,
      (cohort.onboarding_completed_at >= cohort.signup_at) as reached_onboarding,
      (cohort.onboarding_completed_at >= cohort.signup_at
        and cohort.first_analysis_at >= cohort.onboarding_completed_at) as reached_first_analysis,
      (cohort.onboarding_completed_at >= cohort.signup_at
        and cohort.first_analysis_at >= cohort.onboarding_completed_at
        and cohort.paywall_at >= cohort.first_analysis_at) as reached_paywall,
      (cohort.onboarding_completed_at >= cohort.signup_at
        and cohort.first_analysis_at >= cohort.onboarding_completed_at
        and cohort.paywall_at >= cohort.first_analysis_at
        and cohort.purchase_at >= cohort.paywall_at) as reached_purchase
    from cohort_base cohort
  ),
  cohort_with_return as (
    select cohort.*,
      return_analysis.returned_at
    from ordered_cohort cohort
    left join lateral (
      select min(delivered.delivered_at) as returned_at
      from delivered
      where delivered.user_id = cohort.user_id
        and cohort.reached_purchase
        and delivered.delivered_at > cohort.purchase_at
    ) return_analysis on true
  ),
  funnel_counts as (
    select count(*)::numeric as signup,
      count(*) filter (where reached_onboarding)::numeric as onboarding,
      count(*) filter (where reached_first_analysis)::numeric as first_analysis,
      count(*) filter (where reached_paywall)::numeric as paywall,
      count(*) filter (where reached_purchase)::numeric as purchase,
      count(*) filter (where reached_purchase and returned_at is not null)::numeric as subscriber_return
    from cohort_with_return
  ),
  recent_users as (
    select jsonb_agg(jsonb_build_object(
      'id', user_row.id,
      'email', coalesce(user_row.email, 'No email'),
      'displayName', profile.display_name,
      'joinedAt', user_row.created_at,
      'plan', case
        when entitlement.status = 'active' and entitlement.sandbox then 'Sandbox'
        when entitlement.status = 'active' and entitlement.plan_code = 'annual' then 'Pro annual'
        when entitlement.status = 'active' then 'Pro monthly'
        else 'Free' end,
      'analyses', coalesce(counts.analyses, 0),
      'lastActiveAt', greatest(counts.last_analysis_at, last_event.last_event_at),
      'source', case acquisition.source
        when 'tiktok' then 'TikTok' when 'instagram' then 'Instagram' when 'youtube' then 'YouTube'
        when 'app_store_search' then 'App Store' when 'google_search' then 'Google'
        when 'friend_trainer_coach' then 'Referral' when 'other' then coalesce(acquisition.other_detail, 'Other')
        else null end,
      'status', case
        when entitlement.lifecycle_state = 'active_renewing' then 'Active'
        when entitlement.lifecycle_state = 'active_cancelled' then 'Cancelling'
        when entitlement.lifecycle_state = 'renewal_pending' then 'Renewal pending'
        when entitlement.lifecycle_state = 'expired' then 'Expired'
        else 'Free' end
    ) order by user_row.created_at desc) as rows
    from (select * from auth.users order by created_at desc limit 20) user_row
    left join public.user_profiles profile on profile.user_id = user_row.id
    left join public.user_access_entitlements entitlement on entitlement.user_id = user_row.id
    left join analysis_counts counts on counts.user_id = user_row.id
    left join public.onboarding_acquisition_responses acquisition on acquisition.user_id = user_row.id
    left join lateral (
      select max(activity.created_at) as last_event_at from activity where activity.user_id = user_row.id
    ) last_event on true
  ),
  recent_analyses as (
    select jsonb_agg(jsonb_build_object(
      'id', session.id,
      'userEmail', coalesce(user_row.email, 'No email'),
      'exercise', coalesce(exercise.name, session.corrected_label, session.detected_label, 'Unknown exercise'),
      'status', initcap(replace(session.status, '_', ' ')),
      'createdAt', session.created_at,
      'processingMs', session.analysis_total_duration_ms,
      'aiCost', costs.tracked_cost,
      'aiCostComplete', coalesce(costs.total_calls = costs.priced_calls, false),
      'feedback', feedback.helpful
    ) order by session.created_at desc) as rows
    from (select * from public.analysis_sessions order by created_at desc limit 20) session
    join auth.users user_row on user_row.id = session.user_id
    left join public.exercises exercise on exercise.id = coalesce(session.corrected_exercise_id, session.exercise_id)
    left join session_costs costs on costs.session_id = session.id
    left join public.analysis_feedback feedback on feedback.session_id = session.id
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'metrics', jsonb_build_object(
      'totalUsers', (select count(*) from auth.users),
      'newUsersToday', (select count(*) from auth.users where created_at >= date_trunc('day', now())),
      'newUsers7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
      'newUsers30d', (select count(*) from auth.users where created_at >= now() - interval '30 days'),
      'dau', (select count(distinct user_id) from activity where created_at >= now() - interval '24 hours'),
      'wau', (select count(distinct user_id) from activity where created_at >= now() - interval '7 days'),
      'analysesToday', (select count(*) from delivered where delivered_at >= date_trunc('day', now())),
      'analyses7d', (select count(*) from delivered where delivered_at >= now() - interval '7 days'),
      'totalAnalyses', (select count(*) from delivered),
      'secondAnalysisRate', coalesce((select round(100 * count(*) filter (where analyses >= 2)::numeric / nullif(count(*), 0), 1) from analysis_counts), 0),
      'payingSubscribers', (select count(*) from active_paid),
      'freeToPaidRate', (select round(100 * purchase / nullif(first_analysis, 0), 1) from funnel_counts),
      'estimatedMrr', (select gross_run_rate from revenue_stats where priced_subscriptions = total_subscriptions and total_subscriptions > 0),
      'cancellations', (select count(*) from public.user_access_entitlements entitlement where entitlement.status = 'active' and entitlement.lifecycle_state = 'active_cancelled' and entitlement.sandbox = false),
      'aiCostMonth', (select tracked_cost from month_cost_stats where priced_calls > 0),
      'analysisSuccessRate', coalesce((select round(100 * count(*) filter (where status in ('complete', 'partial'))::numeric / nullif(count(*), 0), 1) from terminal_30d), 0),
      'helpfulRate', (select case when helpful + unhelpful = 0 then null else round(100 * helpful / (helpful + unhelpful), 1) end from feedback_counts),
      'helpfulVotes', (select helpful from feedback_counts),
      'unhelpfulVotes', (select unhelpful from feedback_counts)
    ),
    'accuracy', jsonb_build_object(
      'aiCost', (select jsonb_build_object(
        'status', case when total_calls = 0 then 'unavailable' when priced_calls = total_calls then 'estimated' else 'incomplete' end,
        'pricedCalls', priced_calls,
        'totalCalls', total_calls,
        'coveragePercent', round(100 * priced_calls / nullif(total_calls, 0), 1),
        'unpricedCalls', total_calls - priced_calls,
        'isMinimum', priced_calls < total_calls
      ) from month_cost_stats),
      'revenue', (select jsonb_build_object(
        'status', case when total_subscriptions = 0 then 'unavailable' when priced_subscriptions = total_subscriptions then 'estimated' else 'incomplete' end,
        'pricedSubscriptions', priced_subscriptions,
        'totalSubscriptions', total_subscriptions,
        'coveragePercent', round(100 * priced_subscriptions / nullif(total_subscriptions, 0), 1)
      ) from revenue_stats),
      'funnel', jsonb_build_object('status', 'exact', 'observedSince', v_funnel_observed_since, 'ordered', true)
    ),
    'funnel', (select jsonb_build_array(
      jsonb_build_object('key','signup','label','Signed up','users',signup,'conversionFromPrevious',100,'conversionFromSignup',100),
      jsonb_build_object('key','onboarding','label','Finished onboarding','users',onboarding,'conversionFromPrevious',coalesce(round(100*onboarding/nullif(signup,0),1),0),'conversionFromSignup',coalesce(round(100*onboarding/nullif(signup,0),1),0)),
      jsonb_build_object('key','first_analysis','label','First delivered analysis','users',first_analysis,'conversionFromPrevious',coalesce(round(100*first_analysis/nullif(onboarding,0),1),0),'conversionFromSignup',coalesce(round(100*first_analysis/nullif(signup,0),1),0)),
      jsonb_build_object('key','paywall','label','Viewed paywall after analysis','users',paywall,'conversionFromPrevious',coalesce(round(100*paywall/nullif(first_analysis,0),1),0),'conversionFromSignup',coalesce(round(100*paywall/nullif(signup,0),1),0)),
      jsonb_build_object('key','purchase','label','Verified production purchase','users',purchase,'conversionFromPrevious',coalesce(round(100*purchase/nullif(paywall,0),1),0),'conversionFromSignup',coalesce(round(100*purchase/nullif(signup,0),1),0)),
      jsonb_build_object('key','subscriber_return','label','Analyzed after purchase','users',subscriber_return,'conversionFromPrevious',coalesce(round(100*subscriber_return/nullif(purchase,0),1),0),'conversionFromSignup',coalesce(round(100*subscriber_return/nullif(signup,0),1),0))
    ) from funnel_counts),
    'recentUsers', coalesce((select rows from recent_users), '[]'::jsonb),
    'recentAnalyses', coalesce((select rows from recent_analyses), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_founder_dashboard_snapshot() from public, anon, authenticated;
grant execute on function public.get_founder_dashboard_snapshot() to service_role;
