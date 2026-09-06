-- Reporting must agree with payout eligibility: proposed matches are visible
-- for review, but only founder-approved active allocations are final/payable.
create or replace function public.creator_earnings_by_currency(p_creator_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'currency',currency,'pending',pending,'payable',payable,'paid',paid,'adjustments',adjustments
  ) order by currency),'[]'::jsonb)
  from (
    select entry.currency,
      coalesce(sum(entry.amount) filter(where entry.status='pending' and not (
        entry.hold_until<=now() and exists(
          select 1 from public.transaction_reconciliation_allocations allocation
          join public.apple_financial_imports report on report.id=allocation.import_id
          where allocation.transaction_id=entry.transaction_id and allocation.active and report.approval_status='approved'
        )
      )),0) pending,
      coalesce(sum(entry.amount) filter(where entry.status='payable' or (entry.status='pending' and entry.hold_until<=now() and exists(
        select 1 from public.transaction_reconciliation_allocations allocation
        join public.apple_financial_imports report on report.id=allocation.import_id
        where allocation.transaction_id=entry.transaction_id and allocation.active and report.approval_status='approved'
      ))),0) payable,
      coalesce(sum(entry.amount) filter(where entry.status='paid'),0) paid,
      coalesce(sum(entry.amount) filter(where entry.entry_type<>'accrual'),0) adjustments
    from public.creator_commission_entries entry where entry.creator_id=p_creator_id group by entry.currency
  ) balances
$$;

create or replace function public.get_creator_dashboard_v4(
  p_window text default '30d',p_limit integer default 50,p_offset integer default 0
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; creator_id uuid;
begin
  select membership.creator_id into creator_id from public.creator_memberships membership
  where membership.user_id=auth.uid() and membership.status='active';
  if creator_id is null then raise exception 'CREATOR_ACCESS_REQUIRED'; end if;
  result:=public.get_creator_dashboard_v3(p_window,p_limit,p_offset);
  return jsonb_set(result,'{earningsByCurrency}',public.creator_earnings_by_currency(creator_id));
end $$;

create or replace function public.get_founder_creator_detail_v2(
  p_creator_id uuid,p_window text default 'all',p_limit integer default 50,p_offset integer default 0
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  result:=public.get_founder_creator_detail_v1(p_creator_id,p_window,p_limit,p_offset);
  if result is null then return null; end if;
  return jsonb_set(result,'{earningsByCurrency}',public.creator_earnings_by_currency(p_creator_id));
end $$;

create or replace function public.get_founder_business_dashboard_v7(
  p_section text default 'overview',p_window text default '30d',p_start date default null,p_end date default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  result jsonb; growth jsonb; item jsonb; creator_rows jsonb:='[]'::jsonb;
  pending_usd numeric; payable_usd numeric; all_entries numeric; usd_entries numeric; observed timestamptz;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  result:=public.get_founder_business_dashboard_v6(p_section,p_window,p_start,p_end);
  observed:=nullif(result#>>'{metrics,commissionPending,observedSince}','')::timestamptz;
  select count(*),count(*) filter(where entry.currency='USD'),
    coalesce(sum(entry.amount) filter(where entry.currency='USD' and entry.status='pending' and not (
      entry.hold_until<=now() and exists(
        select 1 from public.transaction_reconciliation_allocations allocation
        join public.apple_financial_imports report on report.id=allocation.import_id
        where allocation.transaction_id=entry.transaction_id and allocation.active and report.approval_status='approved'
      )
    )),0),
    coalesce(sum(entry.amount) filter(where entry.currency='USD' and (entry.status='payable' or (entry.status='pending' and entry.hold_until<=now() and exists(
      select 1 from public.transaction_reconciliation_allocations allocation
      join public.apple_financial_imports report on report.id=allocation.import_id
      where allocation.transaction_id=entry.transaction_id and allocation.active and report.approval_status='approved'
    )))),0)
  into all_entries,usd_entries,pending_usd,payable_usd
  from public.creator_commission_entries entry
  where not exists(select 1 from public.business_test_accounts test where test.user_id=entry.referred_user_id);
  result:=jsonb_set(result,'{metrics,commissionPending}',public.business_metric(pending_usd,'money',case when usd_entries<all_entries then 'incomplete' else 'exact' end,'not_applicable','USD',usd_entries,all_entries,observed,'USD commission entries still in hold or awaiting an approved compatible allocation.'));
  result:=jsonb_set(result,'{metrics,commissionPayable}',public.business_metric(payable_usd,'money',case when usd_entries<all_entries then 'incomplete' else 'exact' end,'allocated','USD',usd_entries,all_entries,observed,'USD held commission entries eligible after founder-approved reconciliation.'));

  for item in select value from jsonb_array_elements(coalesce(result->'creators','[]'::jsonb)) loop
    item:=jsonb_set(item,'{earningsByCurrency}',public.creator_earnings_by_currency((item->>'id')::uuid));
    item:=jsonb_set(item,'{pendingAmount}',to_jsonb(coalesce((select sum((balance->>'pending')::numeric) from jsonb_array_elements(item->'earningsByCurrency') balance where balance->>'currency'='USD'),0)));
    item:=jsonb_set(item,'{payableAmount}',to_jsonb(coalesce((select sum((balance->>'payable')::numeric) from jsonb_array_elements(item->'earningsByCurrency') balance where balance->>'currency'='USD'),0)));
    creator_rows:=creator_rows||jsonb_build_array(item);
  end loop;
  result:=jsonb_set(result,'{creators}',creator_rows);

  growth:=coalesce(result->'growth','{}'::jsonb);
  growth:=jsonb_set(growth,'{financialImports}',coalesce((select jsonb_agg(jsonb_build_object(
    'id',report.id,'fileName',report.source_file_name,'fiscalPeriodStart',report.fiscal_period_start,
    'fiscalPeriodEnd',report.fiscal_period_end,'currency',report.report_currency,'status',report.status,
    'approvalStatus',report.approval_status,'rows',report.row_count,
    'allocatedTransactions',coalesce(allocation.allocated_transactions,0),'allocatedProceeds',coalesce(allocation.allocated_proceeds,0),
    'validationError',report.validation_error,'createdAt',report.created_at,'reconciledAt',report.reconciled_at,'approvedAt',report.approved_at
  ) order by report.fiscal_period_end desc,report.created_at desc) from public.apple_financial_imports report
  left join lateral (select count(distinct allocation.transaction_id) allocated_transactions,sum(allocation.allocated_proceeds) allocated_proceeds from public.transaction_reconciliation_allocations allocation where allocation.import_id=report.id) allocation on true),'[]'::jsonb));
  growth:=jsonb_set(growth,'{reconciledProceeds}',coalesce((select jsonb_agg(jsonb_build_object(
    'fiscalPeriodStart',fiscal_period_start,'fiscalPeriodEnd',fiscal_period_end,'currency',currency,
    'proceeds',proceeds,'transactions',transactions
  ) order by fiscal_period_end desc,currency) from (
    select report.fiscal_period_start,report.fiscal_period_end,allocation.currency,
      sum(allocation.allocated_proceeds) proceeds,count(distinct allocation.transaction_id) transactions
    from public.apple_financial_imports report join public.transaction_reconciliation_allocations allocation on allocation.import_id=report.id
    where allocation.active and report.approval_status='approved'
    group by report.fiscal_period_start,report.fiscal_period_end,allocation.currency
  ) approved),'[]'::jsonb));
  return jsonb_set(result,'{growth}',growth);
end $$;

revoke all on function public.creator_earnings_by_currency(uuid),public.get_founder_creator_detail_v2(uuid,text,integer,integer),public.get_founder_business_dashboard_v7(text,text,date,date) from public,anon,authenticated;
grant execute on function public.creator_earnings_by_currency(uuid),public.get_founder_creator_detail_v2(uuid,text,integer,integer),public.get_founder_business_dashboard_v7(text,text,date,date) to service_role;
revoke all on function public.get_creator_dashboard_v4(text,integer,integer) from public,anon;
grant execute on function public.get_creator_dashboard_v4(text,integer,integer) to authenticated;
