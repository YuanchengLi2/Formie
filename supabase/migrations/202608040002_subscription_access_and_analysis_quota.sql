-- RevenueCat is the billing source of truth; this schema is the server-side
-- access and usage ledger. No client-provided entitlement can unlock analysis.
create table if not exists public.subscription_launch_config (
  id boolean primary key default true check (id),
  enforcement_enabled boolean not null default false,
  activated_at timestamptz,
  monthly_analysis_limit integer not null default 10 check (monthly_analysis_limit > 0),
  updated_at timestamptz not null default now()
);

insert into public.subscription_launch_config (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.user_access_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('active', 'expired', 'legacy_unlimited')),
  entitlement_id text,
  revenuecat_app_user_id text,
  store_product_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  last_reconciled_at timestamptz,
  last_customer_info jsonb not null default '{}'::jsonb check (jsonb_typeof(last_customer_info) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_access_entitlements_status_idx
  on public.user_access_entitlements(status, current_period_end);

create table if not exists public.analysis_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.analysis_sessions(id) on delete cascade,
  client_request_id text not null,
  kind text not null check (kind in ('analysis', 'reanalysis')),
  status text not null default 'reserved' check (status in ('reserved', 'committed', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  committed_at timestamptz,
  cancelled_at timestamptz,
  unique (user_id, client_request_id)
);

create index if not exists analysis_credit_reservations_usage_idx
  on public.analysis_credit_reservations(user_id, status, committed_at);
create index if not exists analysis_credit_reservations_stale_idx
  on public.analysis_credit_reservations(status, expires_at);

create table if not exists public.product_analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null check (event_name in (
    'onboarding_screen_viewed', 'onboarding_cta_pressed', 'onboarding_demo_tab_opened',
    'paywall_viewed', 'purchase_started', 'purchase_succeeded', 'purchase_cancelled',
    'purchase_failed', 'purchase_restored', 'analysis_reservation_denied', 'analysis_cancelled'
  )),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  created_at timestamptz not null default now()
);

alter table public.subscription_launch_config enable row level security;
alter table public.user_access_entitlements enable row level security;
alter table public.analysis_credit_reservations enable row level security;
alter table public.product_analytics_events enable row level security;

create policy "Users can read their access status"
on public.user_access_entitlements for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read their credit reservations"
on public.analysis_credit_reservations for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert product analytics"
on public.product_analytics_events for insert to authenticated
with check ((select auth.uid()) = user_id);

grant select on public.user_access_entitlements, public.analysis_credit_reservations to authenticated;
grant insert on public.product_analytics_events to authenticated;

create or replace function public.activate_subscription_launch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.subscription_launch_config
  set enforcement_enabled = true,
      activated_at = coalesce(activated_at, now()),
      updated_at = now()
  where id = true;

  -- Everyone who already had an account at activation keeps permanent access.
  insert into public.user_access_entitlements (user_id, status, entitlement_id, last_reconciled_at)
  select id, 'legacy_unlimited', 'legacy', now()
  from auth.users
  where created_at < (select activated_at from public.subscription_launch_config where id = true)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.activate_subscription_launch() from public, anon, authenticated;
grant execute on function public.activate_subscription_launch() to service_role;

create or replace function public.get_access_status_for_user(p_user_id uuid)
returns table(
  status text,
  can_analyze boolean,
  quota_used integer,
  quota_limit integer,
  remaining integer,
  period_ends_at timestamptz,
  entitlement_id text,
  source text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := p_user_id;
  config public.subscription_launch_config%rowtype;
  entitlement public.user_access_entitlements%rowtype;
  used integer := 0;
  effective_status text;
  effective_limit integer;
begin
  if uid is null then return; end if;
  select * into config from public.subscription_launch_config where id = true;
  select * into entitlement from public.user_access_entitlements where user_id = uid;

  if entitlement.status = 'legacy_unlimited' then
    return query select 'legacy_unlimited', true, null::integer, null::integer, null::integer,
      null::timestamptz, entitlement.entitlement_id, 'legacy';
    return;
  end if;

  if entitlement.status = 'active' and entitlement.current_period_end is not null and entitlement.current_period_end > now() then
    effective_limit := coalesce(config.monthly_analysis_limit, 10);
    select count(*)::integer into used
    from public.analysis_credit_reservations reservation
    where reservation.user_id = uid
      and (
        (reservation.status = 'committed'
          and reservation.committed_at >= coalesce(entitlement.current_period_start, now() - interval '31 days')
          and reservation.committed_at < entitlement.current_period_end)
        or (reservation.status = 'reserved'
          and reservation.expires_at > now()
          and reservation.created_at >= coalesce(entitlement.current_period_start, now() - interval '31 days')
          and reservation.created_at < entitlement.current_period_end)
      );
    return query select 'active', used < effective_limit, used, effective_limit,
      greatest(effective_limit - used, 0), entitlement.current_period_end,
      entitlement.entitlement_id, 'revenuecat';
    return;
  end if;

  effective_status := case when config.enforcement_enabled then 'expired' else 'legacy_unlimited' end;
  return query select effective_status, effective_status = 'legacy_unlimited',
    case when effective_status = 'legacy_unlimited' then null else 0 end,
    case when effective_status = 'legacy_unlimited' then null else coalesce(config.monthly_analysis_limit, 10) end,
    case when effective_status = 'legacy_unlimited' then null else 0 end,
    entitlement.current_period_end, entitlement.entitlement_id,
    case when effective_status = 'legacy_unlimited' then 'legacy' else 'unknown' end;
end;
$$;

revoke all on function public.get_access_status_for_user(uuid) from public, anon, authenticated, service_role;

create or replace function public.get_my_access_status()
returns table(
  status text,
  can_analyze boolean,
  quota_used integer,
  quota_limit integer,
  remaining integer,
  period_ends_at timestamptz,
  entitlement_id text,
  source text
)
language sql
security definer
set search_path = ''
as $$ select * from public.get_access_status_for_user(auth.uid()); $$;

grant execute on function public.get_my_access_status() to authenticated;

create or replace function public.reserve_analysis_credit_for_user(
  p_user_id uuid,
  p_client_request_id text,
  p_kind text,
  p_session_id uuid default null
)
returns table(reservation_id uuid, status text, remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := p_user_id;
  existing public.analysis_credit_reservations%rowtype;
  access record;
  access_remaining integer;
begin
  if uid is null then raise exception 'ANALYSIS_ACCESS_UNAUTHORIZED' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if p_client_request_id is null or char_length(trim(p_client_request_id)) < 8 then
    raise exception 'ANALYSIS_REQUEST_ID_REQUIRED' using errcode = 'P0001';
  end if;
  if p_kind not in ('analysis', 'reanalysis') then raise exception 'ANALYSIS_KIND_INVALID' using errcode = 'P0001'; end if;
  if p_session_id is not null and not exists (select 1 from public.analysis_sessions where id = p_session_id and user_id = uid) then
    raise exception 'ANALYSIS_SESSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into existing
  from public.analysis_credit_reservations
  where user_id = uid and client_request_id = trim(p_client_request_id)
  for update;
  if found and existing.status in ('reserved', 'committed') then
    if p_session_id is not null and existing.session_id is null then
      update public.analysis_credit_reservations set session_id = p_session_id where id = existing.id;
      existing.session_id := p_session_id;
    end if;
    select remaining into access_remaining from public.get_access_status_for_user(uid);
    return query select existing.id, 'already_reserved', access_remaining;
    return;
  end if;

  select * into access from public.get_access_status_for_user(uid);
  if not coalesce(access.can_analyze, false) then
    if access.status = 'expired' then raise exception 'ANALYSIS_SUBSCRIPTION_REQUIRED' using errcode = 'P0001';
    else raise exception 'ANALYSIS_QUOTA_EXCEEDED' using errcode = 'P0001'; end if;
  end if;

  if existing.id is not null and existing.status in ('cancelled', 'expired') then
    update public.analysis_credit_reservations
    set status = 'reserved', session_id = p_session_id, kind = p_kind,
        created_at = now(), expires_at = now() + interval '2 hours',
        committed_at = null, cancelled_at = null
    where id = existing.id;
    select remaining into access_remaining from public.get_access_status_for_user(uid);
    return query select existing.id, 'reserved', access_remaining;
    return;
  end if;

  insert into public.analysis_credit_reservations (user_id, session_id, client_request_id, kind)
  values (uid, p_session_id, trim(p_client_request_id), p_kind)
  returning id into existing.id;
  select remaining into access_remaining from public.get_access_status_for_user(uid);
  return query select existing.id, 'reserved', access_remaining;
end;
$$;

create or replace function public.reserve_analysis_credit(
  p_client_request_id text,
  p_kind text,
  p_session_id uuid default null
)
returns table(reservation_id uuid, status text, remaining integer)
language sql
security definer
set search_path = ''
as $$ select * from public.reserve_analysis_credit_for_user(auth.uid(), p_client_request_id, p_kind, p_session_id); $$;

create or replace function public.reserve_analysis_session_v2(p_client_request_id text, p_session_id uuid default null)
returns table(reservation_id uuid, status text, remaining integer)
language sql security definer set search_path = ''
as $$ select * from public.reserve_analysis_credit(p_client_request_id, 'analysis', p_session_id); $$;

create or replace function public.reserve_reanalysis_v2(p_client_request_id text, p_session_id uuid)
returns table(reservation_id uuid, status text, remaining integer)
language sql security definer set search_path = ''
as $$ select * from public.reserve_analysis_credit(p_client_request_id, 'reanalysis', p_session_id); $$;

revoke all on function public.reserve_analysis_credit_for_user(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_analysis_credit_for_user(uuid, text, text, uuid) to service_role;
revoke all on function public.reserve_analysis_credit(text, text, uuid) from public, anon, authenticated;
revoke all on function public.reserve_analysis_session_v2(text, uuid) from public, anon;
revoke all on function public.reserve_reanalysis_v2(text, uuid) from public, anon;
grant execute on function public.reserve_analysis_session_v2(text, uuid), public.reserve_reanalysis_v2(text, uuid) to authenticated;

create or replace function public.cancel_analysis_reservation(p_reservation_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare changed boolean;
begin
  update public.analysis_credit_reservations
  set status = 'cancelled', cancelled_at = now()
  where id = p_reservation_id and user_id = auth.uid() and status = 'reserved';
  changed := found;
  return changed;
end;
$$;

grant execute on function public.cancel_analysis_reservation(uuid) to authenticated;

create or replace function public.release_stale_analysis_credit_reservations()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare released integer;
begin
  update public.analysis_credit_reservations
  set status = 'expired', cancelled_at = now()
  where status = 'reserved' and expires_at < now();
  get diagnostics released = row_count;
  return released;
end;
$$;

revoke all on function public.release_stale_analysis_credit_reservations() from public, anon, authenticated;
grant execute on function public.release_stale_analysis_credit_reservations() to service_role;

create or replace function public.commit_analysis_credit_for_session()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status in ('complete', 'partial') and (old.status is distinct from new.status or old.completed_at is null) then
    update public.analysis_credit_reservations
    set status = 'committed', committed_at = coalesce(committed_at, now()), expires_at = now()
    where session_id = new.id and status = 'reserved';
  elsif new.status in ('failed', 'unable') and old.status is distinct from new.status then
    update public.analysis_credit_reservations
    set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), expires_at = now()
    where session_id = new.id and status = 'reserved';
  end if;
  return new;
end;
$$;

drop trigger if exists commit_analysis_credit_after_session on public.analysis_sessions;
create trigger commit_analysis_credit_after_session
after update of status, completed_at on public.analysis_sessions
for each row execute function public.commit_analysis_credit_for_session();

revoke all on function public.commit_analysis_credit_for_session() from public, anon, authenticated;

create or replace function public.record_product_analytics(p_event_name text, p_properties jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_event_name not in ('onboarding_screen_viewed', 'onboarding_cta_pressed', 'onboarding_demo_tab_opened', 'paywall_viewed', 'purchase_started', 'purchase_succeeded', 'purchase_cancelled', 'purchase_failed', 'purchase_restored', 'analysis_reservation_denied', 'analysis_cancelled') then
    raise exception 'analytics event is not allowed';
  end if;
  insert into public.product_analytics_events(user_id, event_name, properties)
  values (auth.uid(), p_event_name, case when jsonb_typeof(p_properties) = 'object' then p_properties else '{}'::jsonb end);
end;
$$;

grant execute on function public.record_product_analytics(text, jsonb) to authenticated;

comment on table public.analysis_credit_reservations is 'One idempotent reservation per attempted personal analysis; only committed rows consume quota.';
comment on function public.get_my_access_status() is 'Server-authoritative access state. History remains readable when status is expired.';
