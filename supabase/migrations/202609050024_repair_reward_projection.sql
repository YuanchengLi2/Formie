-- Make first-payment reward projection resumable and keep provider estimates
-- separate from accepted Apple settlement allocations.
alter table public.subscription_transactions
  add column if not exists reconciled_net_proceeds numeric,
  add column if not exists reconciled_currency text
    check (reconciled_currency is null or reconciled_currency ~ '^[A-Z]{3}$'),
  add column if not exists reconciled_import_id uuid
    references public.apple_financial_imports(id) on delete restrict;

create or replace function public.project_revenuecat_transaction(
  p_provider_event_id text,p_user_id uuid,p_account_fingerprint text,p_event_type text,
  p_store text,p_environment text,p_transaction_id text,p_original_transaction_id text,
  p_product_identifier text,p_purchased_at timestamptz,p_period_start timestamptz,p_period_end timestamptz,
  p_gross numeric,p_currency text,p_country text,p_tax_percentage numeric,p_commission_percentage numeric,
  p_refunded_at timestamptz default null,p_refund_reversed_at timestamptz default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_transaction uuid;
  v_net numeric;
  v_referral public.account_referrals%rowtype;
  v_rate integer;
  v_is_first boolean:=false;
  v_qualifying uuid;
  v_entitlement_active boolean:=false;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_account_fingerprint !~ '^[0-9a-f]{64}$' or nullif(btrim(p_transaction_id),'') is null then raise exception 'INVALID_TRANSACTION'; end if;
  if p_environment not in ('PRODUCTION','SANDBOX') then raise exception 'INVALID_ENVIRONMENT'; end if;

  -- Missing provider deductions remain unknown. Zero is valid only when the
  -- provider explicitly sends zero.
  v_net:=case
    when p_gross is null or p_tax_percentage is null or p_commission_percentage is null then null
    else round(p_gross*greatest(0,1-p_tax_percentage-p_commission_percentage),6)
  end;

  perform pg_advisory_xact_lock(hashtext(lower(p_store)||':'||p_environment||':'||p_transaction_id));
  insert into public.subscription_transactions(
    provider_event_id,user_id,account_fingerprint,store,environment,transaction_id,original_transaction_id,
    product_identifier,event_type,purchased_at,period_start,period_end,gross_amount,currency,storefront_country,
    estimated_tax_percentage,estimated_commission_percentage,estimated_net_proceeds,financial_status,
    refunded_at,refund_reversed_at
  ) values(
    p_provider_event_id,p_user_id,p_account_fingerprint,lower(p_store),p_environment,p_transaction_id,
    p_original_transaction_id,p_product_identifier,p_event_type,p_purchased_at,p_period_start,p_period_end,p_gross,
    case when p_currency is null then null else upper(p_currency) end,
    case when p_country is null then null else upper(p_country) end,
    p_tax_percentage,p_commission_percentage,v_net,
    case when p_refunded_at is null then 'estimated' else 'refunded' end,p_refunded_at,p_refund_reversed_at
  )
  on conflict(store,environment,transaction_id) do update set
    provider_event_id=excluded.provider_event_id,
    user_id=coalesce(public.subscription_transactions.user_id,excluded.user_id),
    original_transaction_id=coalesce(excluded.original_transaction_id,public.subscription_transactions.original_transaction_id),
    product_identifier=coalesce(excluded.product_identifier,public.subscription_transactions.product_identifier),
    event_type=excluded.event_type,
    purchased_at=coalesce(excluded.purchased_at,public.subscription_transactions.purchased_at),
    period_start=coalesce(excluded.period_start,public.subscription_transactions.period_start),
    period_end=coalesce(excluded.period_end,public.subscription_transactions.period_end),
    gross_amount=coalesce(excluded.gross_amount,public.subscription_transactions.gross_amount),
    currency=coalesce(excluded.currency,public.subscription_transactions.currency),
    storefront_country=coalesce(excluded.storefront_country,public.subscription_transactions.storefront_country),
    estimated_tax_percentage=coalesce(excluded.estimated_tax_percentage,public.subscription_transactions.estimated_tax_percentage),
    estimated_commission_percentage=coalesce(excluded.estimated_commission_percentage,public.subscription_transactions.estimated_commission_percentage),
    estimated_net_proceeds=case
      when public.subscription_transactions.financial_status='final' then public.subscription_transactions.estimated_net_proceeds
      else coalesce(excluded.estimated_net_proceeds,public.subscription_transactions.estimated_net_proceeds)
    end,
    financial_status=case
      when excluded.refunded_at is not null then 'refunded'
      when excluded.refund_reversed_at is not null then case when public.subscription_transactions.reconciled_net_proceeds is null then 'estimated' else 'final' end
      else public.subscription_transactions.financial_status
    end,
    refunded_at=case when excluded.refund_reversed_at is not null then null else coalesce(excluded.refunded_at,public.subscription_transactions.refunded_at) end,
    refund_reversed_at=coalesce(excluded.refund_reversed_at,public.subscription_transactions.refund_reversed_at),
    updated_at=now()
  returning id into v_transaction;

  if p_user_id is null or p_environment<>'PRODUCTION' then return v_transaction; end if;
  select * into v_referral from public.account_referrals where user_id=p_user_id;
  if not found or v_referral.environment<>'production' then return v_transaction; end if;
  update public.subscription_transactions set creator_id=coalesce(creator_id,v_referral.creator_id) where id=v_transaction;
  select commission_basis_points into v_rate from public.creator_rate_versions where id=v_referral.rate_version_id;

  if v_referral.reward_eligible and p_gross is not null and p_gross>0 and p_event_type in ('INITIAL_PURCHASE','RENEWAL') then
    select not exists(
      select 1 from public.subscription_transactions prior
      where prior.user_id=p_user_id and prior.environment='PRODUCTION' and prior.id<>v_transaction
        and prior.gross_amount>0 and prior.event_type in ('INITIAL_PURCHASE','RENEWAL')
        and (coalesce(prior.purchased_at,prior.created_at),prior.created_at,prior.id)
          < (coalesce(p_purchased_at,now()),now(),v_transaction)
    ) into v_is_first;
  end if;

  if v_is_first then
    insert into public.subscription_reward_redemptions(
      store,environment,original_transaction_id,account_fingerprint,qualifying_transaction_id,user_id
    ) values(
      lower(p_store),p_environment,coalesce(nullif(btrim(p_original_transaction_id),''),p_transaction_id),
      p_account_fingerprint,v_transaction,p_user_id
    ) on conflict(store,environment,original_transaction_id) do nothing;
  end if;
  select redemption.qualifying_transaction_id into v_qualifying
  from public.subscription_reward_redemptions redemption
  where redemption.store=lower(p_store) and redemption.environment=p_environment
    and redemption.original_transaction_id=coalesce(nullif(btrim(p_original_transaction_id),''),p_transaction_id)
    and redemption.user_id=p_user_id;

  -- A replay with fields that were missing from the first webhook completes
  -- the same reward. It cannot create a reward for a later transaction.
  if v_qualifying=v_transaction then
    if p_period_start is not null and p_period_end is not null and p_period_end>p_period_start then
      insert into public.referral_bonus_grants(user_id,qualifying_transaction_id,period_start,period_end)
      values(p_user_id,v_transaction,p_period_start,p_period_end)
      on conflict(user_id) do nothing;
    end if;
    if v_net is not null and p_currency is not null then
      insert into public.creator_commission_entries(
        creator_id,referred_user_id,transaction_id,entry_type,amount,currency,commission_basis_points,hold_until
      ) values(
        v_referral.creator_id,p_user_id,v_transaction,'accrual',round(v_net*v_rate/10000,6),upper(p_currency),v_rate,
        coalesce(p_purchased_at,now())+interval '30 days'
      ) on conflict do nothing;
    end if;
  end if;

  select exists(
    select 1 from public.user_access_entitlements entitlement
    where entitlement.user_id=p_user_id and entitlement.status='active'
      and coalesce(entitlement.billing_period_end,entitlement.current_period_end)>now()
  ) into v_entitlement_active;

  if p_refunded_at is not null then
    if not v_entitlement_active then
      update public.referral_bonus_grants set state='revoked',revoked_at=coalesce(revoked_at,p_refunded_at)
      where user_id=p_user_id and qualifying_transaction_id=v_transaction;
      update public.analysis_credit_reservations reservation
      set status='cancelled',cancelled_at=p_refunded_at,expires_at=least(reservation.expires_at,p_refunded_at)
      from public.referral_bonus_grants grant_row
      where grant_row.qualifying_transaction_id=v_transaction and reservation.bonus_grant_id=grant_row.id
        and reservation.status='reserved';
    end if;
    insert into public.creator_commission_entries(
      creator_id,referred_user_id,transaction_id,entry_type,amount,currency,commission_basis_points,hold_until
    )
    select accrual.creator_id,accrual.referred_user_id,accrual.transaction_id,'refund_adjustment',
      -(accrual.amount+coalesce((select sum(adjustment.amount) from public.creator_commission_entries adjustment where adjustment.transaction_id=v_transaction and adjustment.entry_type='reconciliation_adjustment'),0)),
      accrual.currency,accrual.commission_basis_points,now()
    from public.creator_commission_entries accrual
    where accrual.transaction_id=v_transaction and accrual.entry_type='accrual'
    on conflict do nothing;
  elsif p_refund_reversed_at is not null then
    if v_entitlement_active then
      update public.referral_bonus_grants
      set state=case when period_end>now() then 'active' else 'expired' end,revoked_at=null,refund_reversed_at=p_refund_reversed_at
      where user_id=p_user_id and qualifying_transaction_id=v_transaction;
    end if;
    insert into public.creator_commission_entries(
      creator_id,referred_user_id,transaction_id,entry_type,amount,currency,commission_basis_points,hold_until
    )
    select adjustment.creator_id,adjustment.referred_user_id,adjustment.transaction_id,'refund_reversal',-adjustment.amount,
      adjustment.currency,adjustment.commission_basis_points,now()
    from public.creator_commission_entries adjustment
    where adjustment.transaction_id=v_transaction and adjustment.entry_type='refund_adjustment'
    on conflict do nothing;
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
        and committed_at>=coalesce(v_entitlement.current_period_start,now()-interval '31 days') and committed_at<v_entitlement.current_period_end),0,0,0,0,null::timestamptz;
    return;
  end if;
  if v_grant.state='active' and v_grant.period_end<=now() then update public.referral_bonus_grants set state='expired' where id=v_grant.id; v_grant.state:='expired'; end if;
  return query select v_grant.state,v_base,
    (select count(*)::integer from public.analysis_credit_reservations where user_id=p_user_id and funding_source='base' and status='committed'
      and period_start=v_entitlement.current_period_start and period_end=v_entitlement.current_period_end),
    v_grant.units_granted,
    (select count(*)::integer from public.analysis_credit_reservations where bonus_grant_id=v_grant.id and status='committed'),
    (select count(*)::integer from public.analysis_credit_reservations where bonus_grant_id=v_grant.id and status='reserved' and expires_at>now()),
    case when v_grant.state='active' then greatest(v_grant.units_granted-(select count(*)::integer from public.analysis_credit_reservations where bonus_grant_id=v_grant.id and (status='committed' or (status='reserved' and expires_at>now()))),0) else 0 end,
    v_grant.period_end;
end $$;

revoke all on function public.project_revenuecat_transaction(text,uuid,text,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,numeric,text,text,numeric,numeric,timestamptz,timestamptz),public.get_referral_bonus_access_for_user(uuid) from public,anon,authenticated;
grant execute on function public.project_revenuecat_transaction(text,uuid,text,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,numeric,text,text,numeric,numeric,timestamptz,timestamptz),public.get_referral_bonus_access_for_user(uuid) to service_role;
