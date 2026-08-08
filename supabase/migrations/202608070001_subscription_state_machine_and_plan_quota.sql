-- One authoritative subscription lifecycle shared by native, Edge Functions,
-- and the website. Billing periods and analysis quota periods are separate so
-- annual plans can replenish monthly without carrying unused credits.

create table if not exists public.subscription_product_catalog (
  product_identifier text primary key,
  plan_code text not null check (plan_code in ('monthly', 'annual')),
  billing_interval text not null check (billing_interval in ('month', 'year')),
  quota_limit integer not null default 10 check (quota_limit > 0),
  quota_interval text not null default 'month' check (quota_interval = 'month'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscription_product_catalog(product_identifier, plan_code, billing_interval)
values
  ('formie_monthly', 'monthly', 'month'),
  ('monthly', 'monthly', 'month'),
  ('formie_yearly', 'annual', 'year'),
  ('yearly', 'annual', 'year')
on conflict (product_identifier) do update
set plan_code = excluded.plan_code, billing_interval = excluded.billing_interval, updated_at = now();

alter table public.subscription_product_catalog enable row level security;
grant select on public.subscription_product_catalog to authenticated;
create policy "Authenticated users can read subscription products"
on public.subscription_product_catalog for select to authenticated using (true);

alter table public.user_access_entitlements
  add column if not exists lifecycle_state text,
  add column if not exists plan_code text,
  add column if not exists store text,
  add column if not exists sandbox boolean not null default false,
  add column if not exists will_renew boolean not null default false,
  add column if not exists billing_period_start timestamptz,
  add column if not exists billing_period_end timestamptz,
  add column if not exists latest_revenuecat_event_id text,
  add column if not exists latest_event_at timestamptz,
  add column if not exists state_version bigint not null default 1;

update public.user_access_entitlements entitlement
set plan_code = coalesce(catalog.plan_code, case when entitlement.store_product_id ilike '%year%' or entitlement.store_product_id ilike '%annual%' then 'annual' else 'monthly' end),
    lifecycle_state = case
      when entitlement.status <> 'active' then 'expired'
      when coalesce((entitlement.last_customer_info #>> '{subscription,unsubscribeDetectedAt}') <> '', false) then 'active_cancelled'
      else 'active_renewing'
    end,
    store = coalesce(entitlement.store, entitlement.last_customer_info #>> '{subscription,store}'),
    sandbox = coalesce((entitlement.last_customer_info #>> '{subscription,sandbox}')::boolean, false),
    will_renew = entitlement.status = 'active' and not coalesce((entitlement.last_customer_info #>> '{subscription,unsubscribeDetectedAt}') <> '', false),
    billing_period_start = coalesce(entitlement.billing_period_start, entitlement.current_period_start),
    billing_period_end = coalesce(entitlement.billing_period_end, entitlement.current_period_end)
from public.subscription_product_catalog catalog
where catalog.product_identifier = entitlement.store_product_id;

update public.user_access_entitlements
set plan_code = coalesce(plan_code, case when store_product_id ilike '%year%' or store_product_id ilike '%annual%' then 'annual' else 'monthly' end),
    lifecycle_state = coalesce(lifecycle_state, case when status = 'active' then 'active_renewing' else 'expired' end),
    billing_period_start = coalesce(billing_period_start, current_period_start),
    billing_period_end = coalesce(billing_period_end, current_period_end)
where lifecycle_state is null or plan_code is null or billing_period_start is null or billing_period_end is null;

alter table public.user_access_entitlements
  alter column lifecycle_state set default 'not_subscribed',
  add constraint user_access_entitlements_lifecycle_state_check check (lifecycle_state in ('active_renewing', 'active_cancelled', 'renewal_pending', 'expired', 'not_subscribed')),
  add constraint user_access_entitlements_plan_code_check check (plan_code is null or plan_code in ('monthly', 'annual'));

alter table public.revenuecat_webhook_events
  add column if not exists product_identifier text,
  add column if not exists purchased_at timestamptz,
  add column if not exists expiration_at timestamptz,
  add column if not exists environment text,
  add column if not exists entitlement_identifiers text[] not null default '{}',
  add column if not exists cancel_reason text,
  add column if not exists event_timestamp timestamptz;

create table if not exists public.subscription_test_scenarios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lifecycle_state text not null check (lifecycle_state in ('active_renewing', 'active_cancelled', 'renewal_pending', 'expired', 'not_subscribed')),
  plan_code text not null check (plan_code in ('monthly', 'annual')),
  product_identifier text not null,
  store text not null default 'test_store' check (store = 'test_store'),
  sandbox boolean not null default true check (sandbox),
  will_renew boolean not null,
  billing_period_start timestamptz not null,
  billing_period_end timestamptz not null,
  quota_offset_steps integer not null default 0 check (quota_offset_steps >= 0),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  updated_at timestamptz not null default now(),
  check (billing_period_start < billing_period_end)
);
alter table public.subscription_test_scenarios enable row level security;
revoke all on public.subscription_test_scenarios from public, anon, authenticated;
grant all on public.subscription_test_scenarios to service_role;

create or replace function public.resolve_subscription_quota_period(
  p_plan_code text,
  p_billing_start timestamptz,
  p_billing_end timestamptz,
  p_store text,
  p_sandbox boolean,
  p_now timestamptz default now()
)
returns table(quota_period_start timestamptz, quota_period_end timestamptz)
language plpgsql immutable set search_path = '' as $$
declare
  cursor_start timestamptz;
  cursor_end timestamptz;
  month_index integer := 0;
  test_index integer;
begin
  if p_billing_start is null or p_billing_end is null or p_billing_start >= p_billing_end then return; end if;
  if p_plan_code <> 'annual' then
    return query select p_billing_start, p_billing_end;
    return;
  end if;
  if p_sandbox and p_store = 'test_store' then
    test_index := greatest(0, floor(extract(epoch from (least(greatest(p_now, p_billing_start), p_billing_end) - p_billing_start)) / extract(epoch from interval '5 minutes'))::integer);
    cursor_start := p_billing_start + test_index * interval '5 minutes';
    if cursor_start >= p_billing_end then cursor_start := greatest(p_billing_start, p_billing_end - interval '5 minutes'); end if;
    return query select cursor_start, least(cursor_start + interval '5 minutes', p_billing_end);
    return;
  end if;
  cursor_start := p_billing_start;
  cursor_end := least(p_billing_start + interval '1 month', p_billing_end);
  while cursor_end <= p_now and cursor_end < p_billing_end and month_index < 11 loop
    month_index := month_index + 1;
    cursor_start := p_billing_start + make_interval(months => month_index);
    cursor_end := least(p_billing_start + make_interval(months => month_index + 1), p_billing_end);
  end loop;
  return query select cursor_start, cursor_end;
end;
$$;
revoke all on function public.resolve_subscription_quota_period(text,timestamptz,timestamptz,text,boolean,timestamptz) from public, anon, authenticated;
grant execute on function public.resolve_subscription_quota_period(text,timestamptz,timestamptz,text,boolean,timestamptz) to service_role;

drop function if exists public.reserve_analysis_session_v2(text, uuid);
drop function if exists public.reserve_reanalysis_v2(text, uuid);
drop function if exists public.reserve_analysis_credit(text, text, uuid);
drop function if exists public.reserve_analysis_credit_for_user(uuid, text, text, uuid);
drop function if exists public.get_my_access_status();
drop function if exists public.get_access_status_for_user(uuid);

create function public.get_access_status_for_user(p_user_id uuid)
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
  used integer := 0;
  pending_id uuid;
begin
  if p_user_id is null then return; end if;
  select * into entitlement from public.user_access_entitlements where user_id = p_user_id;
  select * into scenario from public.subscription_test_scenarios where user_id = p_user_id and expires_at > now();

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
  effective_limit := coalesce((select catalog.quota_limit from public.subscription_product_catalog catalog where catalog.product_identifier = effective_product), (select launch.monthly_analysis_limit from public.subscription_launch_config launch where launch.id = true), 10);

  if effective_state in ('active_renewing', 'active_cancelled') and billing_end <= now() then
    if effective_will_renew and now() < billing_end + interval '90 seconds' then effective_state := 'renewal_pending';
    else effective_state := 'expired'; end if;
  end if;

  if effective_state in ('active_renewing', 'active_cancelled') and billing_start is not null and billing_end > now() then
    select * into quota from public.resolve_subscription_quota_period(effective_plan, billing_start, billing_end, effective_store, effective_sandbox, now() + coalesce(scenario.quota_offset_steps, 0) * interval '5 minutes');
    select session.id into pending_id
    from public.analysis_sessions session
    join public.analysis_credit_reservations reservation on reservation.session_id = session.id
    where session.user_id = p_user_id
      and session.status in ('created', 'uploading', 'queued', 'processing')
      and reservation.status = 'reserved'
      and reservation.expires_at > now()
    order by session.created_at desc limit 1;
    select count(*)::integer into used
    from public.analysis_credit_reservations reservation
    where reservation.user_id = p_user_id
      and reservation.period_start = quota.quota_period_start
      and reservation.period_end = quota.quota_period_end
      and ((reservation.status = 'reserved' and reservation.expires_at > now()) or reservation.status = 'committed');
    return query select 'active', effective_state, used < effective_limit and pending_id is null, used, effective_limit, greatest(effective_limit - used, 0), quota.quota_period_start, quota.quota_period_end, quota.quota_period_start, quota.quota_period_end, billing_start, billing_end, entitlement.entitlement_id, effective_product, effective_plan, effective_store, effective_sandbox, effective_will_renew, pending_id, coalesce(entitlement.state_version, 0)::bigint, 'revenuecat';
    return;
  end if;

  return query select case when effective_state = 'renewal_pending' then 'unknown' else 'expired' end, effective_state, false, 0, effective_limit, 0, null::timestamptz, null::timestamptz, null::timestamptz, null::timestamptz, billing_start, billing_end, entitlement.entitlement_id, effective_product, effective_plan, effective_store, effective_sandbox, effective_will_renew, null::uuid, coalesce(entitlement.state_version, 0)::bigint, 'revenuecat';
end;
$$;
revoke all on function public.get_access_status_for_user(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_access_status_for_user(uuid) to service_role;

create function public.get_my_access_status()
returns table(status text, lifecycle_state text, can_analyze boolean, quota_used integer, quota_limit integer, remaining integer, quota_period_start timestamptz, quota_period_end timestamptz, period_starts_at timestamptz, period_ends_at timestamptz, billing_period_start timestamptz, billing_period_end timestamptz, entitlement_id text, product_identifier text, plan_code text, store text, sandbox boolean, will_renew boolean, pending_analysis_session_id uuid, state_version bigint, source text)
language sql security definer set search_path = '' as $$ select * from public.get_access_status_for_user(auth.uid()); $$;
grant execute on function public.get_my_access_status() to authenticated;

create function public.reserve_analysis_credit_for_user(p_user_id uuid, p_client_request_id text, p_kind text, p_session_id uuid default null)
returns table(reservation_id uuid, status text, remaining integer, period_ends_at timestamptz, blocking_session_id uuid)
language plpgsql security definer set search_path = '' as $$
declare existing public.analysis_credit_reservations%rowtype; access record; next_remaining integer; blocking_id uuid; has_blocker boolean := false;
begin
  if p_user_id is null then raise exception 'ANALYSIS_ACCESS_UNAUTHORIZED' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  if p_client_request_id is null or char_length(trim(p_client_request_id)) < 8 then raise exception 'ANALYSIS_REQUEST_ID_REQUIRED' using errcode = 'P0001'; end if;
  if p_kind not in ('analysis', 'reanalysis') then raise exception 'ANALYSIS_KIND_INVALID' using errcode = 'P0001'; end if;
  select * into access from public.get_access_status_for_user(p_user_id);
  select * into existing from public.analysis_credit_reservations where user_id = p_user_id and client_request_id = trim(p_client_request_id) for update;
  if found and existing.status in ('reserved', 'committed') then
    if p_session_id is not null and existing.session_id is null then update public.analysis_credit_reservations set session_id = p_session_id where id = existing.id; end if;
    return query select existing.id, 'already_reserved', access.remaining, access.quota_period_end, null::uuid;
    return;
  end if;
  select reservation.session_id, true into blocking_id, has_blocker
  from public.analysis_credit_reservations reservation
  left join public.analysis_sessions session on session.id = reservation.session_id
  where reservation.user_id = p_user_id
    and reservation.status = 'reserved'
    and reservation.expires_at > now()
    and (reservation.session_id is null or session.status in ('created', 'uploading', 'queued', 'processing'))
  order by reservation.created_at desc limit 1;
  if coalesce(has_blocker, false) then
    return query select null::uuid, 'analysis_pending', access.remaining, access.quota_period_end, blocking_id;
    return;
  end if;
  if access.pending_analysis_session_id is not null then
    return query select null::uuid, 'analysis_pending', access.remaining, access.quota_period_end, access.pending_analysis_session_id;
    return;
  end if;
  if not coalesce(access.can_analyze, false) then
    if access.status <> 'active' then raise exception 'ANALYSIS_SUBSCRIPTION_REQUIRED' using errcode = 'P0001'; end if;
    raise exception 'ANALYSIS_QUOTA_EXCEEDED' using errcode = 'P0001';
  end if;
  if p_session_id is not null and not exists (select 1 from public.analysis_sessions where id = p_session_id and user_id = p_user_id) then raise exception 'ANALYSIS_SESSION_NOT_FOUND' using errcode = 'P0001'; end if;
  if existing.id is not null then
    update public.analysis_credit_reservations set status = 'reserved', session_id = p_session_id, kind = p_kind, created_at = now(), expires_at = now() + interval '2 hours', committed_at = null, cancelled_at = null, period_start = access.quota_period_start, period_end = access.quota_period_end where id = existing.id;
  else
    insert into public.analysis_credit_reservations(user_id, session_id, client_request_id, kind, period_start, period_end) values (p_user_id, p_session_id, trim(p_client_request_id), p_kind, access.quota_period_start, access.quota_period_end) returning id into existing.id;
  end if;
  select current_access.remaining into next_remaining from public.get_access_status_for_user(p_user_id) current_access;
  return query select existing.id, 'reserved', next_remaining, access.quota_period_end, null::uuid;
end;
$$;

create function public.reserve_analysis_credit(p_client_request_id text, p_kind text, p_session_id uuid default null)
returns table(reservation_id uuid, status text, remaining integer, period_ends_at timestamptz, blocking_session_id uuid)
language sql security definer set search_path = '' as $$ select * from public.reserve_analysis_credit_for_user(auth.uid(), p_client_request_id, p_kind, p_session_id); $$;
create function public.reserve_analysis_session_v2(p_client_request_id text, p_session_id uuid default null)
returns table(reservation_id uuid, status text, remaining integer, period_ends_at timestamptz, blocking_session_id uuid)
language sql security definer set search_path = '' as $$ select * from public.reserve_analysis_credit(p_client_request_id, 'analysis', p_session_id); $$;
create function public.reserve_reanalysis_v2(p_client_request_id text, p_session_id uuid)
returns table(reservation_id uuid, status text, remaining integer, period_ends_at timestamptz, blocking_session_id uuid)
language sql security definer set search_path = '' as $$ select * from public.reserve_analysis_credit(p_client_request_id, 'reanalysis', p_session_id); $$;

revoke all on function public.reserve_analysis_credit_for_user(uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.reserve_analysis_credit_for_user(uuid,text,text,uuid) to service_role;
revoke all on function public.reserve_analysis_credit(text,text,uuid) from public, anon, authenticated;
revoke all on function public.reserve_analysis_session_v2(text,uuid) from public, anon;
revoke all on function public.reserve_reanalysis_v2(text,uuid) from public, anon;
grant execute on function public.reserve_analysis_session_v2(text,uuid), public.reserve_reanalysis_v2(text,uuid) to authenticated;

comment on function public.get_my_access_status() is 'Server-authoritative billing, lifecycle, monthly quota, and pending-analysis snapshot.';
