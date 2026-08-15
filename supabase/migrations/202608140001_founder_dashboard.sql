create table if not exists public.analysis_feedback (
  session_id uuid primary key references public.analysis_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  helpful boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists analysis_feedback_user_updated_idx
  on public.analysis_feedback(user_id, updated_at desc);

alter table public.analysis_feedback enable row level security;
revoke all on public.analysis_feedback from public, anon, authenticated;

create policy "Users can read their analysis feedback"
on public.analysis_feedback for select to authenticated
using (auth.uid() = user_id);

grant select on public.analysis_feedback to authenticated;

create or replace function public.submit_analysis_feedback(p_session_id uuid, p_helpful boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'UNAUTHORIZED'; end if;
  if not exists (
    select 1 from public.analysis_sessions session
    where session.id = p_session_id and session.user_id = v_user_id
      and session.status in ('complete', 'partial')
  ) then
    raise exception 'ANALYSIS_NOT_FOUND';
  end if;

  insert into public.analysis_feedback(session_id, user_id, helpful)
  values (p_session_id, v_user_id, p_helpful)
  on conflict (session_id) do update
    set helpful = excluded.helpful, updated_at = now()
    where public.analysis_feedback.user_id = v_user_id;
end;
$$;

revoke all on function public.submit_analysis_feedback(uuid, boolean) from public, anon;
grant execute on function public.submit_analysis_feedback(uuid, boolean) to authenticated;

create or replace function public.get_founder_dashboard_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if current_user not in ('postgres', 'service_role') then raise exception 'UNAUTHORIZED'; end if;

  with
  delivered as (
    select session.id, session.user_id, session.created_at, session.completed_at,
      session.status, session.analysis_total_duration_ms
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
      min(delivered.completed_at) as first_analysis_at,
      max(coalesce(delivered.completed_at, delivered.created_at)) as last_analysis_at
    from delivered group by delivered.user_id
  ),
  active_paid as (
    select entitlement.user_id, entitlement.plan_code
    from public.user_access_entitlements entitlement
    where entitlement.status = 'active'
      and entitlement.sandbox = false
      and entitlement.entitlement_id is distinct from 'legacy'
      and coalesce(entitlement.billing_period_end, entitlement.current_period_end) > now()
  ),
  activity as (
    select session.user_id, session.created_at from public.analysis_sessions session
    union all
    select event.user_id, event.created_at from public.product_analytics_events event where event.user_id is not null
  ),
  funnel_counts as (
    select
      (select count(*) from auth.users)::numeric as signup,
      (select count(*) from public.user_profiles profile where profile.onboarding_completed)::numeric as onboarding,
      (select count(*) from analysis_counts)::numeric as first_analysis,
      (select count(distinct event.user_id) from public.product_analytics_events event where event.event_name = 'paywall_viewed')::numeric as paywall,
      (select count(*) from active_paid)::numeric as purchase,
      (select count(*) from analysis_counts where analyses >= 2)::numeric as second_analysis
  ),
  costs as (
    select telemetry.session_id, coalesce(sum(telemetry.estimated_cost_usd), 0)::numeric as cost
    from public.model_call_telemetry telemetry group by telemetry.session_id
  ),
  feedback_counts as (
    select count(*) filter (where feedback.helpful)::numeric as helpful,
      count(*) filter (where not feedback.helpful)::numeric as unhelpful
    from public.analysis_feedback feedback
  ),
  recent_users as (
    select jsonb_agg(jsonb_build_object(
      'id', user_row.id,
      'email', coalesce(user_row.email, 'No email'),
      'displayName', profile.display_name,
      'joinedAt', user_row.created_at,
      'plan', case
        when entitlement.status = 'legacy_unlimited' then 'Legacy'
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
      'aiCost', coalesce(costs.cost, 0),
      'feedback', feedback.helpful
    ) order by session.created_at desc) as rows
    from (select * from public.analysis_sessions order by created_at desc limit 20) session
    join auth.users user_row on user_row.id = session.user_id
    left join public.exercises exercise on exercise.id = coalesce(session.corrected_exercise_id, session.exercise_id)
    left join costs on costs.session_id = session.id
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
      'analysesToday', (select count(*) from delivered where coalesce(completed_at, created_at) >= date_trunc('day', now())),
      'analyses7d', (select count(*) from delivered where coalesce(completed_at, created_at) >= now() - interval '7 days'),
      'totalAnalyses', (select count(*) from delivered),
      'secondAnalysisRate', coalesce((select round(100 * count(*) filter (where analyses >= 2)::numeric / nullif(count(*), 0), 1) from analysis_counts), 0),
      'payingSubscribers', (select count(*) from active_paid),
      'freeToPaidRate', coalesce((select round(100 * (select count(*) from active_paid)::numeric / nullif(count(*), 0), 1) from analysis_counts), 0),
      'estimatedMrr', (select round(count(*) filter (where plan_code = 'monthly')::numeric * 9.99, 2) from active_paid),
      'cancellations', (select count(*) from public.user_access_entitlements entitlement where entitlement.status = 'active' and entitlement.lifecycle_state = 'active_cancelled' and entitlement.sandbox = false),
      'aiCostMonth', (select round(coalesce(sum(estimated_cost_usd), 0)::numeric, 4) from public.model_call_telemetry where created_at >= date_trunc('month', now())),
      'analysisSuccessRate', coalesce((select round(100 * count(*) filter (where status in ('complete', 'partial'))::numeric / nullif(count(*), 0), 1) from terminal_30d), 0),
      'helpfulRate', (select case when helpful + unhelpful = 0 then null else round(100 * helpful / (helpful + unhelpful), 1) end from feedback_counts),
      'helpfulVotes', (select helpful from feedback_counts),
      'unhelpfulVotes', (select unhelpful from feedback_counts)
    ),
    'funnel', (select jsonb_build_array(
      jsonb_build_object('key','signup','label','Signed up','users',signup,'conversionFromPrevious',100,'conversionFromSignup',100),
      jsonb_build_object('key','onboarding','label','Finished onboarding','users',onboarding,'conversionFromPrevious',coalesce(round(100*onboarding/nullif(signup,0),1),0),'conversionFromSignup',coalesce(round(100*onboarding/nullif(signup,0),1),0)),
      jsonb_build_object('key','first_analysis','label','First analysis','users',first_analysis,'conversionFromPrevious',coalesce(round(100*first_analysis/nullif(onboarding,0),1),0),'conversionFromSignup',coalesce(round(100*first_analysis/nullif(signup,0),1),0)),
      jsonb_build_object('key','paywall','label','Viewed paywall','users',paywall,'conversionFromPrevious',coalesce(round(100*paywall/nullif(first_analysis,0),1),0),'conversionFromSignup',coalesce(round(100*paywall/nullif(signup,0),1),0)),
      jsonb_build_object('key','purchase','label','Purchased','users',purchase,'conversionFromPrevious',coalesce(round(100*purchase/nullif(paywall,0),1),0),'conversionFromSignup',coalesce(round(100*purchase/nullif(signup,0),1),0)),
      jsonb_build_object('key','second_analysis','label','Second analysis','users',second_analysis,'conversionFromPrevious',coalesce(round(100*second_analysis/nullif(purchase,0),1),0),'conversionFromSignup',coalesce(round(100*second_analysis/nullif(signup,0),1),0))
    ) from funnel_counts),
    'recentUsers', coalesce((select rows from recent_users), '[]'::jsonb),
    'recentAnalyses', coalesce((select rows from recent_analyses), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_founder_dashboard_snapshot() from public, anon, authenticated;
grant execute on function public.get_founder_dashboard_snapshot() to service_role;
