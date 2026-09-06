-- First-payment referral rewards and attempt-scoped quota consumption.
create table if not exists public.referral_bonus_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  qualifying_transaction_id uuid not null unique references public.subscription_transactions(id) on delete restrict,
  units_granted integer not null default 3 check (units_granted=3),
  period_start timestamptz not null,
  period_end timestamptz not null,
  state text not null default 'active' check (state in ('active','expired','revoked')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  refund_reversed_at timestamptz,
  check (period_end>period_start)
);
create index if not exists referral_bonus_grants_period_idx on public.referral_bonus_grants(user_id,period_start,period_end);

alter table public.analysis_credit_reservations
  add column if not exists funding_source text not null default 'base' check (funding_source in ('base','referral_bonus')),
  add column if not exists bonus_grant_id uuid references public.referral_bonus_grants(id) on delete restrict;
alter table public.analysis_credit_reservations drop constraint if exists analysis_credit_reservations_bonus_source_check;
alter table public.analysis_credit_reservations add constraint analysis_credit_reservations_bonus_source_check check (
  (funding_source='base' and bonus_grant_id is null) or (funding_source='referral_bonus' and bonus_grant_id is not null)
);

create table if not exists public.analysis_attempts (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.analysis_credit_reservations(id) on delete cascade,
  session_id uuid references public.analysis_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('analysis','reanalysis')),
  status text not null default 'reserved' check (status in ('reserved','processing','complete','partial','failed','unable','cancelled')),
  started_at timestamptz,
  terminal_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists analysis_attempts_session_idx on public.analysis_attempts(session_id,created_at desc);
alter table public.analysis_sessions add column if not exists active_attempt_id uuid references public.analysis_attempts(id) on delete set null;
alter table public.model_call_telemetry
  add column if not exists analysis_attempt_id uuid references public.analysis_attempts(id) on delete set null,
  add column if not exists pricing_version text,
  add column if not exists pricing_source text,
  add column if not exists pricing_effective_at timestamptz,
  add column if not exists pricing_coverage text not null default 'missing_usage';
alter table public.model_call_telemetry drop constraint if exists model_call_telemetry_pricing_coverage_check;
alter table public.model_call_telemetry add constraint model_call_telemetry_pricing_coverage_check
  check (pricing_coverage in ('complete','missing_usage','unpriced_model'));
create index if not exists model_call_telemetry_attempt_idx on public.model_call_telemetry(analysis_attempt_id,created_at);

alter table public.referral_bonus_grants enable row level security;
alter table public.analysis_attempts enable row level security;
revoke all on public.referral_bonus_grants,public.analysis_attempts from public,anon,authenticated;
grant select,insert,update on public.referral_bonus_grants,public.analysis_attempts to service_role;

create or replace function public.project_revenuecat_transaction(
  p_provider_event_id text,p_user_id uuid,p_account_fingerprint text,p_event_type text,
  p_store text,p_environment text,p_transaction_id text,p_original_transaction_id text,
  p_product_identifier text,p_purchased_at timestamptz,p_period_start timestamptz,p_period_end timestamptz,
  p_gross numeric,p_currency text,p_country text,p_tax_percentage numeric,p_commission_percentage numeric,
  p_refunded_at timestamptz default null,p_refund_reversed_at timestamptz default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_transaction uuid; v_net numeric; v_referral public.account_referrals%rowtype; v_rate integer; v_is_first boolean; v_reward_redeemed boolean:=false;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_account_fingerprint !~ '^[0-9a-f]{64}$' or nullif(btrim(p_transaction_id),'') is null then raise exception 'INVALID_TRANSACTION'; end if;
  v_net:=case when p_gross is null then null else round(p_gross*greatest(0,1-coalesce(p_tax_percentage,0)-coalesce(p_commission_percentage,0)),6) end;
  insert into public.subscription_transactions(provider_event_id,user_id,account_fingerprint,store,environment,transaction_id,original_transaction_id,product_identifier,event_type,purchased_at,period_start,period_end,gross_amount,currency,storefront_country,estimated_tax_percentage,estimated_commission_percentage,estimated_net_proceeds,financial_status,refunded_at,refund_reversed_at)
  values(p_provider_event_id,p_user_id,p_account_fingerprint,lower(p_store),p_environment,p_transaction_id,p_original_transaction_id,p_product_identifier,p_event_type,p_purchased_at,p_period_start,p_period_end,p_gross,upper(p_currency),upper(p_country),p_tax_percentage,p_commission_percentage,v_net,case when p_refunded_at is null then 'estimated' else 'refunded' end,p_refunded_at,p_refund_reversed_at)
  on conflict(store,environment,transaction_id) do update set
    provider_event_id=excluded.provider_event_id,user_id=coalesce(public.subscription_transactions.user_id,excluded.user_id),
    original_transaction_id=coalesce(excluded.original_transaction_id,public.subscription_transactions.original_transaction_id),
    product_identifier=coalesce(excluded.product_identifier,public.subscription_transactions.product_identifier),
    event_type=excluded.event_type,purchased_at=coalesce(excluded.purchased_at,public.subscription_transactions.purchased_at),
    period_start=coalesce(excluded.period_start,public.subscription_transactions.period_start),period_end=coalesce(excluded.period_end,public.subscription_transactions.period_end),
    gross_amount=coalesce(excluded.gross_amount,public.subscription_transactions.gross_amount),currency=coalesce(excluded.currency,public.subscription_transactions.currency),storefront_country=coalesce(excluded.storefront_country,public.subscription_transactions.storefront_country),
    estimated_tax_percentage=coalesce(excluded.estimated_tax_percentage,public.subscription_transactions.estimated_tax_percentage),
    estimated_commission_percentage=coalesce(excluded.estimated_commission_percentage,public.subscription_transactions.estimated_commission_percentage),
    estimated_net_proceeds=coalesce(excluded.estimated_net_proceeds,public.subscription_transactions.estimated_net_proceeds),
    financial_status=case when excluded.refunded_at is not null then 'refunded' when excluded.refund_reversed_at is not null then 'estimated' else public.subscription_transactions.financial_status end,
    refunded_at=coalesce(excluded.refunded_at,public.subscription_transactions.refunded_at),refund_reversed_at=coalesce(excluded.refund_reversed_at,public.subscription_transactions.refund_reversed_at),updated_at=now()
  returning id into v_transaction;
  if p_user_id is null or p_environment<>'PRODUCTION' then return v_transaction; end if;
  select * into v_referral from public.account_referrals where user_id=p_user_id;
  if not found then return v_transaction; end if;
  if v_referral.environment<>'production' then return v_transaction; end if;
  update public.subscription_transactions set creator_id=coalesce(creator_id,v_referral.creator_id) where id=v_transaction;
  select commission_basis_points into v_rate from public.creator_rate_versions where id=v_referral.rate_version_id;
  v_is_first:=p_gross is not null and p_gross>0 and p_event_type in ('INITIAL_PURCHASE','RENEWAL') and not exists(
    select 1 from public.subscription_transactions prior where prior.user_id=p_user_id and prior.environment='PRODUCTION'
      and prior.id<>v_transaction and prior.gross_amount>0 and prior.event_type in ('INITIAL_PURCHASE','RENEWAL')
      and coalesce(prior.purchased_at,prior.created_at)<coalesce(p_purchased_at,now())
  );
  if v_is_first then
    insert into public.subscription_reward_redemptions(store,environment,original_transaction_id,account_fingerprint,qualifying_transaction_id,user_id)
    values(lower(p_store),p_environment,coalesce(nullif(btrim(p_original_transaction_id),''),p_transaction_id),p_account_fingerprint,v_transaction,p_user_id)
    on conflict(store,environment,original_transaction_id) do nothing
    returning true into v_reward_redeemed;
  end if;
  if v_reward_redeemed and p_period_start is not null and p_period_end is not null then
    insert into public.referral_bonus_grants(user_id,qualifying_transaction_id,period_start,period_end)
    values(p_user_id,v_transaction,p_period_start,p_period_end) on conflict(user_id) do nothing;
    if v_net is not null and p_currency is not null then
      insert into public.creator_commission_entries(creator_id,referred_user_id,transaction_id,entry_type,amount,currency,commission_basis_points,hold_until)
      values(v_referral.creator_id,p_user_id,v_transaction,'accrual',round(v_net*v_rate/10000,6),upper(p_currency),v_rate,coalesce(p_purchased_at,now())+interval '30 days')
      on conflict(transaction_id,entry_type) do nothing;
    end if;
  end if;
  if p_refunded_at is not null then
    update public.referral_bonus_grants set state='revoked',revoked_at=coalesce(revoked_at,p_refunded_at)
      where user_id=p_user_id and qualifying_transaction_id=v_transaction;
    update public.analysis_credit_reservations reservation set status='cancelled',cancelled_at=p_refunded_at,expires_at=least(reservation.expires_at,p_refunded_at)
      from public.referral_bonus_grants grant_row
      where grant_row.qualifying_transaction_id=v_transaction and reservation.bonus_grant_id=grant_row.id and reservation.status='reserved';
    insert into public.creator_commission_entries(creator_id,referred_user_id,transaction_id,entry_type,amount,currency,commission_basis_points,hold_until)
    select creator_id,referred_user_id,transaction_id,'refund_adjustment',-amount,currency,commission_basis_points,now()
    from public.creator_commission_entries where transaction_id=v_transaction and entry_type='accrual'
    on conflict(transaction_id,entry_type) do nothing;
  elsif p_refund_reversed_at is not null then
    update public.referral_bonus_grants set state=case when period_end>now() then 'active' else 'expired' end,revoked_at=null,refund_reversed_at=p_refund_reversed_at
      where user_id=p_user_id and qualifying_transaction_id=v_transaction;
    insert into public.creator_commission_entries(creator_id,referred_user_id,transaction_id,entry_type,amount,currency,commission_basis_points,hold_until)
    select creator_id,referred_user_id,transaction_id,'refund_reversal',amount,currency,commission_basis_points,now()
    from public.creator_commission_entries where transaction_id=v_transaction and entry_type='accrual'
    on conflict(transaction_id,entry_type) do nothing;
  end if;
  return v_transaction;
end $$;

create or replace function public.get_referral_bonus_access_for_user(p_user_id uuid)
returns table(state text,base_limit integer,base_used integer,bonus_granted integer,bonus_used integer,bonus_reserved integer,bonus_remaining integer,bonus_expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_grant public.referral_bonus_grants%rowtype; v_entitlement public.user_access_entitlements%rowtype; v_base integer:=10;
begin
  select * into v_entitlement from public.user_access_entitlements where user_id=p_user_id;
  v_base:=coalesce((select quota_limit from public.subscription_product_catalog where product_identifier=v_entitlement.store_product_id),10);
  select * into v_grant from public.referral_bonus_grants where user_id=p_user_id;
  if not found then
    return query select case when exists(select 1 from public.account_referrals where user_id=p_user_id) then 'pending_payment' else 'none' end,v_base,
      (select count(*)::integer from public.analysis_credit_reservations where user_id=p_user_id and funding_source='base' and status='committed'
        and committed_at>=coalesce(v_entitlement.current_period_start,now()-interval '31 days') and committed_at<v_entitlement.current_period_end),0,0,0,0,null::timestamptz; return;
  end if;
  if v_grant.state='active' and v_grant.period_end<=now() then update public.referral_bonus_grants set state='expired' where id=v_grant.id; v_grant.state:='expired'; end if;
  return query select v_grant.state,v_base,
    (select count(*)::integer from public.analysis_credit_reservations where user_id=p_user_id and funding_source='base' and status='committed' and period_start=v_grant.period_start and period_end=v_grant.period_end),
    v_grant.units_granted,
    (select count(*)::integer from public.analysis_credit_reservations where bonus_grant_id=v_grant.id and status='committed'),
    (select count(*)::integer from public.analysis_credit_reservations where bonus_grant_id=v_grant.id and status='reserved' and expires_at>now()),
    case when v_grant.state='active' then greatest(v_grant.units_granted-(select count(*)::integer from public.analysis_credit_reservations where bonus_grant_id=v_grant.id and (status='committed' or (status='reserved' and expires_at>now()))),0) else 0 end,
    v_grant.period_end;
end $$;

create or replace function public.get_my_referral_bonus_access()
returns table(state text,base_limit integer,base_used integer,bonus_granted integer,bonus_used integer,bonus_reserved integer,bonus_remaining integer,bonus_expires_at timestamptz)
language sql security definer set search_path='' as $$ select * from public.get_referral_bonus_access_for_user(auth.uid()); $$;

create or replace function public.get_my_access_status()
returns table(status text,lifecycle_state text,can_analyze boolean,quota_used integer,quota_limit integer,remaining integer,quota_period_start timestamptz,quota_period_end timestamptz,period_starts_at timestamptz,period_ends_at timestamptz,billing_period_start timestamptz,billing_period_end timestamptz,entitlement_id text,product_identifier text,plan_code text,store text,sandbox boolean,will_renew boolean,pending_analysis_session_id uuid,state_version bigint,source text)
language plpgsql security definer set search_path='' as $$
declare access_row record; bonus_row record; effective_limit integer;
begin
  select * into access_row from public.get_access_status_for_user(auth.uid());
  if not found then return; end if;
  select * into bonus_row from public.get_referral_bonus_access_for_user(auth.uid());
  effective_limit:=coalesce(access_row.quota_limit,10)+case when bonus_row.state='active' then bonus_row.bonus_granted else 0 end;
  return query select access_row.status,access_row.lifecycle_state,
    access_row.status='active' and access_row.quota_used<effective_limit and access_row.pending_analysis_session_id is null,
    access_row.quota_used,effective_limit,greatest(effective_limit-access_row.quota_used,0),
    access_row.quota_period_start,access_row.quota_period_end,access_row.period_starts_at,access_row.period_ends_at,
    access_row.billing_period_start,access_row.billing_period_end,access_row.entitlement_id,access_row.product_identifier,
    access_row.plan_code,access_row.store,access_row.sandbox,access_row.will_renew,access_row.pending_analysis_session_id,
    access_row.state_version,access_row.source;
end $$;

create or replace function public.attach_analysis_reservation_to_session(p_reservation_id uuid,p_session_id uuid,p_user_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_attempt uuid;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  update public.analysis_credit_reservations set session_id=p_session_id where id=p_reservation_id and user_id=p_user_id and status='reserved';
  if not found then raise exception 'RESERVATION_NOT_ACTIVE'; end if;
  update public.analysis_attempts set session_id=p_session_id,updated_at=now() where reservation_id=p_reservation_id returning id into v_attempt;
  update public.analysis_sessions set active_attempt_id=v_attempt where id=p_session_id and user_id=p_user_id;
  return v_attempt;
end $$;

create or replace function public.reconcile_analysis_credit_for_session(p_session_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_session public.analysis_sessions%rowtype; v_attempt public.analysis_attempts%rowtype; v_reservation public.analysis_credit_reservations%rowtype; v_terminal timestamptz;
begin
  select * into v_session from public.analysis_sessions where id=p_session_id for update;
  if not found or v_session.status not in ('complete','partial','failed','unable') or v_session.active_attempt_id is null then return; end if;
  select * into v_attempt from public.analysis_attempts where id=v_session.active_attempt_id and session_id=p_session_id for update;
  if not found then return; end if;
  select * into v_reservation from public.analysis_credit_reservations where id=v_attempt.reservation_id for update;
  v_terminal:=coalesce(v_session.completed_at,v_session.updated_at,now());
  if v_session.status in ('complete','partial') and v_reservation.status='reserved' and (
      v_reservation.funding_source='base' or exists(select 1 from public.referral_bonus_grants grant_row where grant_row.id=v_reservation.bonus_grant_id
        and grant_row.state in ('active','expired') and grant_row.revoked_at is null and v_reservation.created_at<grant_row.period_end and v_reservation.expires_at>=v_terminal)
    ) then
    update public.analysis_credit_reservations set status='committed',committed_at=v_terminal,expires_at=least(expires_at,v_terminal) where id=v_reservation.id;
    update public.analysis_attempts set status=v_session.status,terminal_at=v_terminal,updated_at=now() where id=v_attempt.id;
  else
    update public.analysis_credit_reservations set status='cancelled',cancelled_at=coalesce(cancelled_at,v_terminal),expires_at=least(expires_at,v_terminal) where id=v_reservation.id and status='reserved';
    update public.analysis_attempts set status=case when v_session.status in ('failed','unable') then v_session.status else 'cancelled' end,terminal_at=v_terminal,updated_at=now() where id=v_attempt.id;
  end if;
end $$;

create or replace function public.reserve_analysis_credit_for_user(
  p_user_id uuid,p_client_request_id text,p_kind text,p_session_id uuid default null
) returns table(reservation_id uuid,status text,remaining integer,period_ends_at timestamptz,blocking_session_id uuid)
language plpgsql security definer set search_path='' as $$
declare
  v_existing public.analysis_credit_reservations%rowtype; v_access record; v_blocking uuid;
  v_base_limit integer:=10; v_base_held integer:=0; v_bonus public.referral_bonus_grants%rowtype;
  v_bonus_held integer:=0; v_source text:='base'; v_attempt uuid; v_total_remaining integer; v_bonus_access record;
begin
  if p_user_id is null then raise exception 'ANALYSIS_ACCESS_UNAUTHORIZED' using errcode='P0001'; end if;
  if p_client_request_id is null or char_length(btrim(p_client_request_id))<8 then raise exception 'ANALYSIS_REQUEST_ID_REQUIRED' using errcode='P0001'; end if;
  if p_kind not in ('analysis','reanalysis') then raise exception 'ANALYSIS_KIND_INVALID' using errcode='P0001'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  select * into v_access from public.get_access_status_for_user(p_user_id);
  select * into v_existing from public.analysis_credit_reservations where user_id=p_user_id and client_request_id=btrim(p_client_request_id) for update;
  if found and v_existing.status in ('reserved','committed') then
    if p_session_id is not null and v_existing.session_id is null then perform public.attach_analysis_reservation_to_session(v_existing.id,p_session_id,p_user_id); end if;
    select * into v_bonus_access from public.get_referral_bonus_access_for_user(p_user_id);
    return query select v_existing.id,'already_reserved',greatest(coalesce(v_access.remaining,0)+coalesce(v_bonus_access.bonus_remaining,0),0),
      case when v_existing.funding_source='referral_bonus' then v_existing.period_end else v_access.quota_period_end end,null::uuid; return;
  elsif found then
    return query select v_existing.id,'request_terminal',v_access.remaining,v_existing.period_end,v_existing.session_id; return;
  end if;
  select reservation.session_id into v_blocking from public.analysis_credit_reservations reservation
  left join public.analysis_sessions session on session.id=reservation.session_id
  where reservation.user_id=p_user_id and reservation.status='reserved' and reservation.expires_at>now()
    and (reservation.session_id is null or session.status in ('created','uploading','queued','processing'))
  order by reservation.created_at desc limit 1;
  if found or v_access.pending_analysis_session_id is not null then
    return query select null::uuid,'analysis_pending',v_access.remaining,v_access.quota_period_end,coalesce(v_blocking,v_access.pending_analysis_session_id); return;
  end if;
  if v_access.status<>'active' then raise exception 'ANALYSIS_SUBSCRIPTION_REQUIRED' using errcode='P0001'; end if;
  if p_session_id is not null and not exists(select 1 from public.analysis_sessions where id=p_session_id and user_id=p_user_id) then raise exception 'ANALYSIS_SESSION_NOT_FOUND' using errcode='P0001'; end if;
  v_base_limit:=coalesce(v_access.quota_limit,10);
  select count(*)::integer into v_base_held from public.analysis_credit_reservations
  where user_id=p_user_id and funding_source='base' and period_start=v_access.quota_period_start and period_end=v_access.quota_period_end
    and (status='committed' or (status='reserved' and expires_at>now()));
  select * into v_bonus from public.referral_bonus_grants grant_row
  where grant_row.user_id=p_user_id and grant_row.state='active' and grant_row.period_start<=now() and grant_row.period_end>now()
  order by grant_row.granted_at limit 1 for update;
  if found then
    select count(*)::integer into v_bonus_held from public.analysis_credit_reservations
    where bonus_grant_id=v_bonus.id and (status='committed' or (status='reserved' and expires_at>now()));
  end if;
  if v_base_held<v_base_limit then v_source:='base';
  elsif v_bonus.id is not null and v_bonus_held<v_bonus.units_granted then v_source:='referral_bonus';
  else raise exception 'ANALYSIS_QUOTA_EXCEEDED' using errcode='P0001'; end if;
  if v_existing.id is null then
    insert into public.analysis_credit_reservations(user_id,session_id,client_request_id,kind,period_start,period_end,funding_source,bonus_grant_id,expires_at)
    values(p_user_id,p_session_id,btrim(p_client_request_id),p_kind,
      case when v_source='referral_bonus' then v_bonus.period_start else v_access.quota_period_start end,
      case when v_source='referral_bonus' then v_bonus.period_end else v_access.quota_period_end end,
      v_source,case when v_source='referral_bonus' then v_bonus.id else null end,now()+interval '2 hours')
    returning id into v_existing.id;
  end if;
  insert into public.analysis_attempts(reservation_id,session_id,user_id,kind)
  values(v_existing.id,p_session_id,p_user_id,p_kind)
  returning id into v_attempt;
  if p_session_id is not null then update public.analysis_sessions set active_attempt_id=v_attempt where id=p_session_id and user_id=p_user_id; end if;
  v_total_remaining:=greatest(v_base_limit-v_base_held-case when v_source='base' then 1 else 0 end,0)
    +case when v_bonus.id is null then 0 else greatest(v_bonus.units_granted-v_bonus_held-case when v_source='referral_bonus' then 1 else 0 end,0) end;
  return query select v_existing.id,'reserved',v_total_remaining,v_access.quota_period_end,null::uuid;
end $$;

create or replace function public.get_my_access_status_v2()
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object(
    'access',to_jsonb(access_row),
    'referralBonus',jsonb_build_object(
      'state',bonus.state,'baseLimit',bonus.base_limit,'baseUsed',bonus.base_used,
      'bonusGranted',bonus.bonus_granted,'bonusUsed',bonus.bonus_used,'bonusReserved',bonus.bonus_reserved,
      'bonusRemaining',bonus.bonus_remaining,'bonusExpiresAt',bonus.bonus_expires_at
    )
  )
  from public.get_my_access_status() access_row
  cross join public.get_referral_bonus_access_for_user(auth.uid()) bonus;
$$;

create or replace function public.commit_analysis_result_for_attempt(
  p_session_id uuid,p_attempt_id uuid,p_session jsonb,p_result jsonb
) returns void language plpgsql security definer set search_path='' as $$
declare active_attempt uuid;
begin
  select session.active_attempt_id into active_attempt from public.analysis_sessions session where session.id=p_session_id for update;
  if active_attempt is null or active_attempt<>p_attempt_id then raise exception 'ANALYSIS_ATTEMPT_SUPERSEDED' using errcode='P0001'; end if;
  if not exists(select 1 from public.analysis_attempts attempt where attempt.id=p_attempt_id and attempt.session_id=p_session_id and attempt.status='reserved') then
    raise exception 'ANALYSIS_ATTEMPT_NOT_ACTIVE' using errcode='P0001';
  end if;
  perform public.commit_analysis_result_v2(p_session_id,p_session,p_result);
end $$;

revoke all on function public.project_revenuecat_transaction(text,uuid,text,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,numeric,text,text,numeric,numeric,timestamptz,timestamptz),public.get_referral_bonus_access_for_user(uuid),public.attach_analysis_reservation_to_session(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.project_revenuecat_transaction(text,uuid,text,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,numeric,text,text,numeric,numeric,timestamptz,timestamptz),public.get_referral_bonus_access_for_user(uuid),public.attach_analysis_reservation_to_session(uuid,uuid,uuid) to service_role;
revoke all on function public.get_my_referral_bonus_access() from public,anon;
grant execute on function public.get_my_referral_bonus_access() to authenticated;
revoke all on function public.get_my_access_status() from public,anon;
grant execute on function public.get_my_access_status() to authenticated;
revoke all on function public.get_my_access_status_v2() from public,anon;
grant execute on function public.get_my_access_status_v2() to authenticated;
revoke all on function public.commit_analysis_result_for_attempt(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_analysis_result_for_attempt(uuid,uuid,jsonb,jsonb) to service_role;
revoke all on function public.reserve_analysis_credit_for_user(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_analysis_credit_for_user(uuid,text,text,uuid) to service_role;
