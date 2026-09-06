-- Separate technical matching from founder approval, preserve immutable ledger
-- amounts, and use the detailed Apple report's transaction and settlement data.
alter table public.apple_financial_imports
  add column if not exists approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','rejected')),
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null;

alter table public.transaction_reconciliation_allocations
  add column if not exists active boolean not null default false;
create unique index if not exists transaction_one_active_reconciliation_idx
  on public.transaction_reconciliation_allocations(transaction_id) where active;

alter table public.creator_commission_entries
  add column if not exists source_import_id uuid references public.apple_financial_imports(id) on delete restrict;
alter table public.creator_commission_entries
  drop constraint if exists creator_commission_entries_transaction_id_entry_type_key;
create unique index if not exists creator_commission_accrual_once_idx
  on public.creator_commission_entries(transaction_id) where entry_type='accrual';
create unique index if not exists creator_commission_refund_once_idx
  on public.creator_commission_entries(transaction_id) where entry_type='refund_adjustment';
create unique index if not exists creator_commission_refund_reversal_once_idx
  on public.creator_commission_entries(transaction_id) where entry_type='refund_reversal';
create unique index if not exists creator_commission_reconciliation_per_import_idx
  on public.creator_commission_entries(transaction_id,source_import_id)
  where entry_type='reconciliation_adjustment';

create or replace function public.enforce_creator_commission_entry_immutability()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.creator_id is distinct from old.creator_id
    or new.referred_user_id is distinct from old.referred_user_id
    or new.transaction_id is distinct from old.transaction_id
    or new.entry_type is distinct from old.entry_type
    or new.amount is distinct from old.amount
    or new.currency is distinct from old.currency
    or new.commission_basis_points is distinct from old.commission_basis_points
    or new.hold_until is distinct from old.hold_until
    or new.source_import_id is distinct from old.source_import_id
    or new.created_at is distinct from old.created_at then
    raise exception 'COMMISSION_ENTRY_IMMUTABLE';
  end if;
  return new;
end $$;
drop trigger if exists creator_commission_entry_immutable on public.creator_commission_entries;
create trigger creator_commission_entry_immutable before update on public.creator_commission_entries
for each row execute function public.enforce_creator_commission_entry_immutability();

create or replace function public.reconcile_apple_financial_import(p_import_id uuid,p_actor_user_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare
  report public.apple_financial_imports%rowtype;
  bucket record;
  candidate_count integer;
  unpriced_count integer;
  unmatched integer:=0;
  weight_total numeric;
  gross_total numeric;
  expected_gross numeric;
  allocated_count integer:=0;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  select * into report from public.apple_financial_imports
  where id=p_import_id and approval_status='pending' and status in ('validated','reconciled') for update;
  if not found then raise exception 'IMPORT_NOT_PENDING'; end if;
  delete from public.transaction_reconciliation_allocations where import_id=p_import_id and not active;

  for bucket in
    select min(id)::bigint financial_line_id,sku,product_type_identifier,country_of_sale,customer_currency,
      partner_share_currency,sale_or_return,transaction_date,settlement_date,
      sum(quantity)::integer quantity,sum(extended_partner_share) extended_partner_share,
      min(customer_price) customer_price,count(distinct customer_price) customer_price_count
    from public.apple_financial_lines where import_id=p_import_id
    group by sku,product_type_identifier,country_of_sale,customer_currency,partner_share_currency,
      sale_or_return,transaction_date,settlement_date
    order by sku,product_type_identifier,country_of_sale,customer_currency,partner_share_currency,
      sale_or_return,transaction_date,settlement_date
  loop
    if bucket.transaction_date is null or bucket.settlement_date is null
      or bucket.settlement_date<report.fiscal_period_start or bucket.settlement_date>report.fiscal_period_end
      or bucket.customer_currency is null or bucket.customer_currency<>bucket.partner_share_currency
      or bucket.customer_price is null or bucket.customer_price_count<>1
      or nullif(btrim(coalesce(bucket.product_type_identifier,'')),'') is null then
      unmatched:=unmatched+1;
      continue;
    end if;

    select count(*),count(*) filter(where transaction.estimated_net_proceeds is null),
      coalesce(sum(abs(transaction.estimated_net_proceeds)),0),coalesce(sum(abs(transaction.gross_amount)),0)
    into candidate_count,unpriced_count,weight_total,gross_total
    from public.subscription_transactions transaction
    where transaction.environment='PRODUCTION' and transaction.store in ('app_store','mac_app_store')
      and transaction.product_identifier=bucket.sku
      and transaction.purchased_at::date=bucket.transaction_date
      and transaction.currency=bucket.customer_currency
      and transaction.storefront_country=bucket.country_of_sale
      and ((bucket.sale_or_return='S' and transaction.financial_status<>'refunded')
        or (bucket.sale_or_return='R' and transaction.financial_status='refunded'));
    expected_gross:=abs(bucket.quantity*bucket.customer_price);
    if candidate_count<>abs(bucket.quantity) or candidate_count=0 or unpriced_count<>0 or weight_total<=0
      or abs(gross_total-expected_gross)>0.02 then
      unmatched:=unmatched+1;
      continue;
    end if;

    insert into public.transaction_reconciliation_allocations(
      import_id,transaction_id,financial_line_id,allocated_proceeds,currency,active
    )
    with candidates as (
      select transaction.id,abs(transaction.estimated_net_proceeds) weight,
        row_number() over(order by transaction.id) sequence
      from public.subscription_transactions transaction
      where transaction.environment='PRODUCTION' and transaction.store in ('app_store','mac_app_store')
        and transaction.product_identifier=bucket.sku
        and transaction.purchased_at::date=bucket.transaction_date
        and transaction.currency=bucket.customer_currency
        and transaction.storefront_country=bucket.country_of_sale
        and ((bucket.sale_or_return='S' and transaction.financial_status<>'refunded')
          or (bucket.sale_or_return='R' and transaction.financial_status='refunded'))
    ), shares as (
      select id,sequence,round(bucket.extended_partner_share*weight/weight_total,6) share from candidates
    )
    select p_import_id,id,bucket.financial_line_id,
      case when sequence=candidate_count then bucket.extended_partner_share-
        coalesce(sum(share) over(order by sequence rows between unbounded preceding and 1 preceding),0)
        else share end,bucket.partner_share_currency,false
    from shares;
    get diagnostics candidate_count=row_count;
    allocated_count:=allocated_count+candidate_count;
  end loop;

  update public.apple_financial_imports
  set status=case when unmatched=0 then 'reconciled' else 'validated' end,
    reconciled_at=case when unmatched=0 then now() else null end,
    validation_error=case when unmatched=0 then null else unmatched::text||' financial buckets remain unmatched' end
  where id=p_import_id;
  insert into public.founder_action_audit(actor_user_id,action,entity_type,entity_id,details)
  values(p_actor_user_id,'apple_report_reconciled','apple_financial_import',p_import_id::text,
    jsonb_build_object('allocatedTransactions',allocated_count,'unmatchedBuckets',unmatched,'approvalStatus','pending'));
  return case when unmatched=0 then allocated_count::text||' transactions matched; founder approval required.'
    else allocated_count::text||' transactions matched; '||unmatched::text||' buckets remain pending.' end;
end $$;

create or replace function public.approve_apple_financial_import(p_import_id uuid,p_actor_user_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare report public.apple_financial_imports%rowtype; v_allocations integer; v_adjustments integer;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  select * into report from public.apple_financial_imports
  where id=p_import_id and status='reconciled' and approval_status='pending' for update;
  if not found then raise exception 'IMPORT_NOT_READY_FOR_APPROVAL'; end if;
  if exists(
    select 1 from public.apple_financial_imports approved
    where approved.id<>p_import_id and approved.approval_status='approved'
      and approved.report_currency=report.report_currency
      and daterange(approved.fiscal_period_start,approved.fiscal_period_end,'[]')
        && daterange(report.fiscal_period_start,report.fiscal_period_end,'[]')
  ) then raise exception 'OVERLAPPING_APPROVED_IMPORT'; end if;
  select count(*) into v_allocations from public.transaction_reconciliation_allocations where import_id=p_import_id;
  if v_allocations=0 then raise exception 'IMPORT_HAS_NO_ALLOCATIONS'; end if;

  update public.transaction_reconciliation_allocations set active=true where import_id=p_import_id;
  update public.subscription_transactions transaction
  set reconciled_net_proceeds=allocation.total,reconciled_currency=allocation.currency,
    reconciled_import_id=p_import_id,
    financial_status=case when transaction.refunded_at is null then 'final' else 'refunded' end,updated_at=now()
  from (
    select item.transaction_id,sum(item.allocated_proceeds) total,min(item.currency) currency
    from public.transaction_reconciliation_allocations item where item.import_id=p_import_id group by item.transaction_id
  ) allocation where transaction.id=allocation.transaction_id;

  -- If provider deductions were unknown, final Apple proceeds can create the
  -- first immutable accrual after the report is approved.
  insert into public.creator_commission_entries(
    creator_id,referred_user_id,transaction_id,entry_type,amount,currency,commission_basis_points,hold_until
  )
  select referral.creator_id,redemption.user_id,transaction.id,'accrual',
    round(transaction.reconciled_net_proceeds*rate.commission_basis_points/10000,6),
    transaction.reconciled_currency,rate.commission_basis_points,
    coalesce(transaction.purchased_at,transaction.created_at)+interval '30 days'
  from public.subscription_transactions transaction
  join public.subscription_reward_redemptions redemption on redemption.qualifying_transaction_id=transaction.id
  join public.account_referrals referral on referral.user_id=redemption.user_id
  join public.creator_rate_versions rate on rate.id=referral.rate_version_id
  where transaction.reconciled_import_id=p_import_id and transaction.reconciled_net_proceeds>0
  on conflict(transaction_id) where entry_type='accrual' do nothing;

  insert into public.creator_commission_entries(
    creator_id,referred_user_id,transaction_id,entry_type,amount,currency,commission_basis_points,hold_until,source_import_id
  )
  select accrual.creator_id,accrual.referred_user_id,accrual.transaction_id,'reconciliation_adjustment',
    round(transaction.reconciled_net_proceeds*accrual.commission_basis_points/10000,6)-
      coalesce((select sum(existing.amount) from public.creator_commission_entries existing
        where existing.transaction_id=accrual.transaction_id and existing.entry_type in ('accrual','reconciliation_adjustment')),0),
    transaction.reconciled_currency,accrual.commission_basis_points,accrual.hold_until,p_import_id
  from public.creator_commission_entries accrual
  join public.subscription_transactions transaction on transaction.id=accrual.transaction_id
  where accrual.entry_type='accrual' and transaction.reconciled_import_id=p_import_id
    and transaction.reconciled_currency=accrual.currency
    and abs(round(transaction.reconciled_net_proceeds*accrual.commission_basis_points/10000,6)-
      coalesce((select sum(existing.amount) from public.creator_commission_entries existing
        where existing.transaction_id=accrual.transaction_id and existing.entry_type in ('accrual','reconciliation_adjustment')),0))>0.0000005
  on conflict(transaction_id,source_import_id) where entry_type='reconciliation_adjustment' do nothing;
  get diagnostics v_adjustments=row_count;

  update public.apple_financial_imports set approval_status='approved',approved_at=now(),approved_by=p_actor_user_id where id=p_import_id;
  insert into public.founder_action_audit(actor_user_id,action,entity_type,entity_id,details)
  values(p_actor_user_id,'apple_report_approved','apple_financial_import',p_import_id::text,
    jsonb_build_object('activeAllocations',v_allocations,'commissionAdjustments',v_adjustments));
  return v_allocations::text||' final allocations approved.';
end $$;

create or replace function public.reject_apple_financial_import(p_import_id uuid,p_reason text,p_actor_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
  update public.apple_financial_imports set approval_status='rejected',validation_error=btrim(p_reason)
  where id=p_import_id and approval_status='pending';
  if not found then raise exception 'IMPORT_NOT_PENDING'; end if;
  insert into public.founder_action_audit(actor_user_id,action,entity_type,entity_id,details)
  values(p_actor_user_id,'apple_report_rejected','apple_financial_import',p_import_id::text,jsonb_build_object('reason',btrim(p_reason)));
end $$;

create or replace function public.prepare_creator_payout(p_creator_id uuid,p_currency text,p_actor uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_amount numeric;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  perform pg_advisory_xact_lock(hashtext(p_creator_id::text||upper(p_currency)));
  update public.creator_commission_entries entry set status='payable'
  where entry.creator_id=p_creator_id and entry.currency=upper(p_currency) and entry.status='pending'
    and entry.hold_until<=now()
    and exists(
      select 1 from public.transaction_reconciliation_allocations allocation
      join public.apple_financial_imports report on report.id=allocation.import_id
      where allocation.transaction_id=entry.transaction_id and allocation.active and report.approval_status='approved'
    );
  select coalesce(sum(amount),0) into v_amount from public.creator_commission_entries
  where creator_id=p_creator_id and currency=upper(p_currency) and status='payable';
  if v_amount<=0 then raise exception 'NO_PAYABLE_BALANCE'; end if;
  insert into public.creator_payouts(creator_id,currency,amount,prepared_by)
  values(p_creator_id,upper(p_currency),v_amount,p_actor) returning id into v_id;
  insert into public.creator_payout_items(payout_id,commission_entry_id,amount)
  select v_id,id,amount from public.creator_commission_entries
  where creator_id=p_creator_id and currency=upper(p_currency) and status='payable';
  update public.creator_commission_entries entry set status='allocated'
  where exists(select 1 from public.creator_payout_items item where item.payout_id=v_id and item.commission_entry_id=entry.id);
  return v_id;
end $$;

revoke all on function public.approve_apple_financial_import(uuid,uuid),public.reject_apple_financial_import(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.approve_apple_financial_import(uuid,uuid),public.reject_apple_financial_import(uuid,text,uuid) to service_role;
