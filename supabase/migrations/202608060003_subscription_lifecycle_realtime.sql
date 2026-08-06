-- Replace permanent legacy access with one RevenueCat-backed entitlement and
-- make entitlement/quota mutations observable by authenticated clients.

do $$
begin
  if exists (select 1 from public.user_access_entitlements where status = 'legacy_unlimited') then
    raise exception 'legacy_unlimited rows must be reconciled before applying subscription lifecycle migration';
  end if;
end;
$$;

alter table public.user_access_entitlements
  drop constraint if exists user_access_entitlements_status_check;
alter table public.user_access_entitlements
  add constraint user_access_entitlements_status_check check (status in ('active', 'expired'));

alter table public.analysis_credit_reservations
  add column if not exists period_start timestamptz,
  add column if not exists period_end timestamptz;

update public.analysis_credit_reservations reservation
set period_start = entitlement.current_period_start,
    period_end = entitlement.current_period_end
from public.user_access_entitlements entitlement
where entitlement.user_id = reservation.user_id
  and reservation.period_start is null
  and reservation.created_at >= entitlement.current_period_start
  and reservation.created_at < entitlement.current_period_end;

create index if not exists analysis_credit_reservations_period_usage_idx
  on public.analysis_credit_reservations(user_id, period_start, period_end, status);
create index if not exists user_access_entitlements_revenuecat_id_idx
  on public.user_access_entitlements(revenuecat_app_user_id);

create table if not exists public.revenuecat_webhook_events (
  event_id text primary key,
  event_type text not null,
  app_user_id text not null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  received_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text
);
alter table public.revenuecat_webhook_events enable row level security;
revoke all on public.revenuecat_webhook_events from public, anon, authenticated;

create or replace function public.claim_revenuecat_webhook_event(p_event_id text, p_event_type text, p_app_user_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare current_status text;
begin
  insert into public.revenuecat_webhook_events(event_id, event_type, app_user_id)
  values (p_event_id, p_event_type, p_app_user_id)
  on conflict (event_id) do update
    set attempts = public.revenuecat_webhook_events.attempts + 1,
        status = case when public.revenuecat_webhook_events.status = 'completed' then 'completed' else 'processing' end,
        last_error = case when public.revenuecat_webhook_events.status = 'completed' then public.revenuecat_webhook_events.last_error else null end
  returning status into current_status;
  return current_status;
end;
$$;
revoke all on function public.claim_revenuecat_webhook_event(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_revenuecat_webhook_event(text, text, text) to service_role;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_access_entitlements') then
    alter publication supabase_realtime add table public.user_access_entitlements;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'analysis_credit_reservations') then
    alter publication supabase_realtime add table public.analysis_credit_reservations;
  end if;
end;
$$;

drop function if exists public.reserve_analysis_session_v2(text, uuid);
drop function if exists public.reserve_reanalysis_v2(text, uuid);
drop function if exists public.reserve_analysis_credit(text, text, uuid);
drop function if exists public.reserve_analysis_credit_for_user(uuid, text, text, uuid);
drop function if exists public.get_my_access_status();
drop function if exists public.get_access_status_for_user(uuid);

create function public.get_access_status_for_user(p_user_id uuid)
returns table(status text, can_analyze boolean, quota_used integer, quota_limit integer, remaining integer, period_starts_at timestamptz, period_ends_at timestamptz, entitlement_id text, source text)
language plpgsql security definer set search_path = '' as $$
declare entitlement public.user_access_entitlements%rowtype; effective_limit integer; used integer := 0;
begin
  if p_user_id is null then return; end if;
  select * into entitlement from public.user_access_entitlements where user_id = p_user_id;
  effective_limit := coalesce((select monthly_analysis_limit from public.subscription_launch_config where id = true), 10);
  if entitlement.status = 'active'
     and entitlement.current_period_start is not null
     and entitlement.current_period_end is not null
     and entitlement.current_period_start < entitlement.current_period_end
     and entitlement.current_period_end > now() then
    select count(*)::integer into used
    from public.analysis_credit_reservations reservation
    where reservation.user_id = p_user_id
      and reservation.period_start = entitlement.current_period_start
      and reservation.period_end = entitlement.current_period_end
      and ((reservation.status = 'reserved' and reservation.expires_at > now()) or reservation.status = 'committed');
    return query select 'active', used < effective_limit, used, effective_limit, greatest(effective_limit - used, 0), entitlement.current_period_start, entitlement.current_period_end, entitlement.entitlement_id, 'revenuecat';
    return;
  end if;
  return query select 'expired', false, 0, effective_limit, 0, entitlement.current_period_start, entitlement.current_period_end, entitlement.entitlement_id, 'revenuecat';
end;
$$;
revoke all on function public.get_access_status_for_user(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_access_status_for_user(uuid) to service_role;

create function public.get_my_access_status()
returns table(status text, can_analyze boolean, quota_used integer, quota_limit integer, remaining integer, period_starts_at timestamptz, period_ends_at timestamptz, entitlement_id text, source text)
language sql security definer set search_path = '' as $$ select * from public.get_access_status_for_user(auth.uid()); $$;
grant execute on function public.get_my_access_status() to authenticated;

create function public.reserve_analysis_credit_for_user(p_user_id uuid, p_client_request_id text, p_kind text, p_session_id uuid default null)
returns table(reservation_id uuid, status text, remaining integer, period_ends_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare existing public.analysis_credit_reservations%rowtype; access record; next_remaining integer;
begin
  if p_user_id is null then raise exception 'ANALYSIS_ACCESS_UNAUTHORIZED' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  if p_client_request_id is null or char_length(trim(p_client_request_id)) < 8 then raise exception 'ANALYSIS_REQUEST_ID_REQUIRED' using errcode = 'P0001'; end if;
  if p_kind not in ('analysis', 'reanalysis') then raise exception 'ANALYSIS_KIND_INVALID' using errcode = 'P0001'; end if;
  if p_session_id is not null and not exists (select 1 from public.analysis_sessions where id = p_session_id and user_id = p_user_id) then raise exception 'ANALYSIS_SESSION_NOT_FOUND' using errcode = 'P0001'; end if;
  select * into access from public.get_access_status_for_user(p_user_id);
  select * into existing from public.analysis_credit_reservations where user_id = p_user_id and client_request_id = trim(p_client_request_id) for update;
  if found and existing.status in ('reserved', 'committed') then
    if p_session_id is not null and existing.session_id is null then update public.analysis_credit_reservations set session_id = p_session_id where id = existing.id; end if;
    return query select existing.id, 'already_reserved', access.remaining, access.period_ends_at;
    return;
  end if;
  if not coalesce(access.can_analyze, false) then
    if access.status = 'expired' then raise exception 'ANALYSIS_SUBSCRIPTION_REQUIRED' using errcode = 'P0001'; end if;
    raise exception 'ANALYSIS_QUOTA_EXCEEDED' using errcode = 'P0001';
  end if;
  if existing.id is not null then
    update public.analysis_credit_reservations set status = 'reserved', session_id = p_session_id, kind = p_kind, created_at = now(), expires_at = now() + interval '2 hours', committed_at = null, cancelled_at = null, period_start = access.period_starts_at, period_end = access.period_ends_at where id = existing.id;
  else
    insert into public.analysis_credit_reservations(user_id, session_id, client_request_id, kind, period_start, period_end) values (p_user_id, p_session_id, trim(p_client_request_id), p_kind, access.period_starts_at, access.period_ends_at) returning id into existing.id;
  end if;
  select remaining into next_remaining from public.get_access_status_for_user(p_user_id);
  return query select existing.id, 'reserved', next_remaining, access.period_ends_at;
end;
$$;

create function public.reserve_analysis_credit(p_client_request_id text, p_kind text, p_session_id uuid default null)
returns table(reservation_id uuid, status text, remaining integer, period_ends_at timestamptz)
language sql security definer set search_path = '' as $$ select * from public.reserve_analysis_credit_for_user(auth.uid(), p_client_request_id, p_kind, p_session_id); $$;
create function public.reserve_analysis_session_v2(p_client_request_id text, p_session_id uuid default null)
returns table(reservation_id uuid, status text, remaining integer, period_ends_at timestamptz)
language sql security definer set search_path = '' as $$ select * from public.reserve_analysis_credit(p_client_request_id, 'analysis', p_session_id); $$;
create function public.reserve_reanalysis_v2(p_client_request_id text, p_session_id uuid)
returns table(reservation_id uuid, status text, remaining integer, period_ends_at timestamptz)
language sql security definer set search_path = '' as $$ select * from public.reserve_analysis_credit(p_client_request_id, 'reanalysis', p_session_id); $$;

revoke all on function public.reserve_analysis_credit_for_user(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_analysis_credit_for_user(uuid, text, text, uuid) to service_role;
revoke all on function public.reserve_analysis_credit(text, text, uuid) from public, anon, authenticated;
revoke all on function public.reserve_analysis_session_v2(text, uuid) from public, anon;
revoke all on function public.reserve_reanalysis_v2(text, uuid) from public, anon;
grant execute on function public.reserve_analysis_session_v2(text, uuid), public.reserve_reanalysis_v2(text, uuid) to authenticated;

comment on table public.revenuecat_webhook_events is 'Idempotency and diagnostics for RevenueCat lifecycle delivery.';
comment on function public.get_my_access_status() is 'Server-authoritative subscription and current-period quota snapshot.';
