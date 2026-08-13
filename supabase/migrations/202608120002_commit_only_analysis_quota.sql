-- A reserved analysis blocks concurrent submissions, but it is not usage.
-- Only a completed analysis is shown as consumed quota.
create or replace function public.get_access_status_for_user(p_user_id uuid)
returns table(
  status text,
  lifecycle_state text,
  can_analyze boolean,
  quota_used integer,
  quota_limit integer,
  remaining integer,
  quota_period_start timestamptz,
  quota_period_end timestamptz,
  period_starts_at timestamptz,
  period_ends_at timestamptz,
  billing_period_start timestamptz,
  billing_period_end timestamptz,
  entitlement_id text,
  product_identifier text,
  plan_code text,
  store text,
  sandbox boolean,
  will_renew boolean,
  pending_analysis_session_id uuid,
  state_version bigint,
  source text
)
language plpgsql security definer set search_path = '' as $$
declare
  entitlement public.user_access_entitlements%rowtype;
  scenario public.subscription_test_scenarios%rowtype;
  effective_state text;
  effective_plan text;
  effective_product text;
  effective_store text;
  effective_sandbox boolean;
  effective_will_renew boolean;
  billing_start timestamptz;
  billing_end timestamptz;
  quota record;
  effective_limit integer := 10;
  actual_used integer := 0;
  used integer := 0;
  pending_id uuid;
  override_valid boolean := false;
begin
  if p_user_id is null then return; end if;
  select * into entitlement from public.user_access_entitlements where user_id = p_user_id;

  select * into scenario
  from public.subscription_test_scenarios candidate
  where candidate.user_id = p_user_id
    and candidate.expires_at > now()
    and candidate.store = 'test_store'
    and candidate.sandbox = true
    and (entitlement.store_product_id is null or candidate.product_identifier = entitlement.store_product_id);

  effective_state := coalesce(
    scenario.lifecycle_state,
    entitlement.lifecycle_state,
    case
      when entitlement.user_id is null then 'not_subscribed'
      when entitlement.status = 'active' then 'active_renewing'
      else 'expired'
    end
  );
  effective_plan := coalesce(scenario.plan_code, entitlement.plan_code, 'monthly');
  effective_product := coalesce(scenario.product_identifier, entitlement.store_product_id);
  effective_store := coalesce(scenario.store, entitlement.store);
  effective_sandbox := coalesce(scenario.sandbox, entitlement.sandbox, false);
  effective_will_renew := coalesce(scenario.will_renew, entitlement.will_renew, false);
  billing_start := coalesce(scenario.billing_period_start, entitlement.billing_period_start, entitlement.current_period_start);
  billing_end := coalesce(scenario.billing_period_end, entitlement.billing_period_end, entitlement.current_period_end);
  effective_limit := coalesce(
    (select catalog.quota_limit from public.subscription_product_catalog catalog where catalog.product_identifier = effective_product),
    (select launch.monthly_analysis_limit from public.subscription_launch_config launch where launch.id = true),
    10
  );

  if effective_state in ('active_renewing', 'active_cancelled') and billing_end <= now() then
    if effective_will_renew and now() < billing_end + interval '90 seconds' then
      effective_state := 'renewal_pending';
    else
      effective_state := 'expired';
    end if;
  end if;

  if effective_state in ('active_renewing', 'active_cancelled', 'renewal_pending')
     and billing_start is not null
     and (billing_end > now() or effective_state = 'renewal_pending') then
    select * into quota
    from public.resolve_subscription_quota_period(
      effective_plan,
      billing_start,
      billing_end,
      effective_store,
      effective_sandbox,
      now() + coalesce(scenario.quota_offset_steps, 0) * interval '5 minutes'
    );

    select session.id into pending_id
    from public.analysis_sessions session
    join public.analysis_credit_reservations reservation on reservation.session_id = session.id
    where session.user_id = p_user_id
      and session.status in ('created', 'uploading', 'queued', 'processing')
      and reservation.status = 'reserved'
      and reservation.expires_at > now()
    order by session.created_at desc
    limit 1;

    select count(*)::integer into actual_used
    from public.analysis_credit_reservations reservation
    where reservation.user_id = p_user_id
      and reservation.period_start = quota.quota_period_start
      and reservation.period_end = quota.quota_period_end
      and reservation.status = 'committed';

    override_valid := scenario.quota_remaining_override is not null
      and scenario.quota_actual_used_at_override is not null
      and scenario.quota_override_period_start = quota.quota_period_start
      and scenario.quota_override_period_end = quota.quota_period_end;
    if override_valid then
      used := greatest(0, least(effective_limit,
        (effective_limit - scenario.quota_remaining_override)
        + greatest(actual_used - scenario.quota_actual_used_at_override, 0)));
    else
      used := actual_used;
    end if;

    return query select
      'active',
      effective_state,
      used < effective_limit and pending_id is null,
      used,
      effective_limit,
      greatest(effective_limit - used, 0),
      quota.quota_period_start,
      quota.quota_period_end,
      quota.quota_period_start,
      quota.quota_period_end,
      billing_start,
      billing_end,
      entitlement.entitlement_id,
      effective_product,
      effective_plan,
      effective_store,
      effective_sandbox,
      effective_will_renew,
      pending_id,
      coalesce(entitlement.state_version, 0)::bigint,
      'revenuecat';
    return;
  end if;

  return query select
    'expired',
    effective_state,
    false,
    0,
    effective_limit,
    0,
    null::timestamptz,
    null::timestamptz,
    null::timestamptz,
    null::timestamptz,
    billing_start,
    billing_end,
    entitlement.entitlement_id,
    effective_product,
    effective_plan,
    effective_store,
    effective_sandbox,
    effective_will_renew,
    null::uuid,
    coalesce(entitlement.state_version, 0)::bigint,
    'revenuecat';
end;
$$;

revoke all on function public.get_access_status_for_user(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_access_status_for_user(uuid) to service_role;

comment on function public.get_access_status_for_user(uuid) is
  'Committed analyses consume visible quota; an active reservation only blocks concurrent submission.';
