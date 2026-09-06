-- Keep native transaction currencies separate in founder reporting. The v2
-- contract exposes USD subtotals only and marks them incomplete whenever a
-- transaction or commission entry cannot be represented in USD without FX.
create or replace function public.get_founder_business_dashboard_v2(
  p_section text default 'overview',
  p_window text default '30d',
  p_start date default null,
  p_end date default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_result jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_observed timestamptz;
  v_all_tx numeric;
  v_usd_tx numeric;
  v_usd_gross_priced numeric;
  v_usd_net_priced numeric;
  v_usd_gross numeric;
  v_usd_net numeric;
  v_usd_referral numeric;
  v_usd_refunds numeric;
  v_all_commission_entries numeric;
  v_usd_commission_entries numeric;
  v_usd_commissions numeric;
  v_all_balance_entries numeric;
  v_usd_balance_entries numeric;
  v_pending_commission numeric;
  v_payable_commission numeric;
  v_paid_commission numeric;
  v_all_paid numeric;
  v_usd_paid numeric;
  v_usd_mrr numeric;
  v_ai numeric;
  v_ai_quality text;
  v_contribution numeric;
  v_money_quality text;
  v_net_quality text;
  v_balance_quality text;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;

  v_result:=public.get_founder_business_dashboard(p_section,p_window,p_start,p_end);
  v_start:=coalesce((v_result->>'rangeStart')::timestamptz,'-infinity'::timestamptz);
  v_end:=(v_result->>'rangeEnd')::timestamptz;
  v_observed:=nullif(v_result#>>'{metrics,grossRevenue,observedSince}','')::timestamptz;

  select
    count(*)::numeric,
    count(*) filter(where transaction.currency='USD')::numeric,
    count(transaction.gross_amount) filter(where transaction.currency='USD')::numeric,
    count(transaction.estimated_net_proceeds) filter(where transaction.currency='USD')::numeric,
    coalesce(sum(transaction.gross_amount) filter(where transaction.currency='USD'),0)::numeric,
    coalesce(sum(transaction.estimated_net_proceeds) filter(where transaction.currency='USD'),0)::numeric,
    coalesce(sum(transaction.gross_amount) filter(where transaction.currency='USD' and transaction.creator_id is not null),0)::numeric,
    coalesce(sum(abs(transaction.gross_amount)) filter(where transaction.currency='USD' and transaction.financial_status='refunded'),0)::numeric
  into v_all_tx,v_usd_tx,v_usd_gross_priced,v_usd_net_priced,v_usd_gross,v_usd_net,v_usd_referral,v_usd_refunds
  from public.subscription_transactions transaction
  where transaction.environment='PRODUCTION'
    and coalesce(transaction.purchased_at,transaction.created_at)>=v_start
    and coalesce(transaction.purchased_at,transaction.created_at)<v_end
    and not exists(select 1 from public.business_test_accounts test where test.user_id=transaction.user_id);

  select
    count(*)::numeric,
    count(*) filter(where entry.currency='USD')::numeric,
    coalesce(sum(entry.amount) filter(where entry.currency='USD'),0)::numeric
  into v_all_commission_entries,v_usd_commission_entries,v_usd_commissions
  from public.creator_commission_entries entry
  where entry.created_at>=v_start and entry.created_at<v_end
    and not exists(select 1 from public.business_test_accounts test where test.user_id=entry.referred_user_id);

  select
    count(*)::numeric,
    count(*) filter(where entry.currency='USD')::numeric,
    coalesce(sum(entry.amount) filter(where entry.currency='USD' and entry.status='paid'),0)::numeric,
    coalesce(sum(entry.amount) filter(where entry.currency='USD' and (entry.status='payable' or (entry.status='pending' and entry.hold_until<=now() and exists(select 1 from public.transaction_reconciliation_allocations allocation where allocation.transaction_id=entry.transaction_id)))),0)::numeric,
    coalesce(sum(entry.amount) filter(where entry.currency='USD' and entry.status='pending' and not (entry.hold_until<=now() and exists(select 1 from public.transaction_reconciliation_allocations allocation where allocation.transaction_id=entry.transaction_id))),0)::numeric
  into v_all_balance_entries,v_usd_balance_entries,v_paid_commission,v_payable_commission,v_pending_commission
  from public.creator_commission_entries entry
  where not exists(select 1 from public.business_test_accounts test where test.user_id=entry.referred_user_id);

  select
    count(*)::numeric,
    count(*) filter(where latest.currency='USD')::numeric,
    coalesce(sum(latest.gross_amount) filter(where latest.currency='USD'),0)::numeric
  into v_all_paid,v_usd_paid,v_usd_mrr
  from public.user_access_entitlements entitlement
  join lateral (
    select transaction.currency,transaction.gross_amount
    from public.subscription_transactions transaction
    where transaction.user_id=entitlement.user_id
      and transaction.environment='PRODUCTION'
      and transaction.gross_amount>0
    order by coalesce(transaction.period_end,transaction.purchased_at,transaction.created_at) desc
    limit 1
  ) latest on true
  where entitlement.status='active' and entitlement.sandbox=false
    and entitlement.entitlement_id is distinct from 'legacy'
    and coalesce(entitlement.billing_period_end,entitlement.current_period_end)>v_end
    and not exists(select 1 from public.creator_memberships membership where membership.user_id=entitlement.user_id)
    and not exists(select 1 from public.business_test_accounts test where test.user_id=entitlement.user_id);

  v_ai:=nullif(v_result#>>'{metrics,aiCost,value}','')::numeric;
  v_ai_quality:=coalesce(v_result#>>'{metrics,aiCost,quality}','unavailable');
  v_contribution:=case when v_usd_net_priced=0 or v_ai is null then null else v_usd_net-v_usd_commissions-v_ai end;
  v_money_quality:=case
    when v_all_tx=0 then 'unavailable'
    when v_usd_tx=0 or v_usd_tx<v_all_tx or v_usd_gross_priced<v_usd_tx then 'incomplete'
    else 'estimated' end;
  v_net_quality:=case
    when v_all_tx=0 then 'unavailable'
    when v_usd_tx=0 or v_usd_tx<v_all_tx or v_usd_net_priced<v_usd_tx then 'incomplete'
    else 'estimated' end;
  v_balance_quality:=case when v_all_balance_entries>v_usd_balance_entries then 'incomplete' else 'exact' end;

  v_result:=jsonb_set(v_result,'{metrics,grossRevenue}',public.business_metric(case when v_usd_gross_priced=0 then null else v_usd_gross end,'money',v_money_quality,'estimated','USD',v_usd_gross_priced,v_all_tx,v_observed,'USD gross transaction subtotal. Incomplete when native-currency transactions lack a recorded USD conversion.'));
  v_result:=jsonb_set(v_result,'{metrics,netProceeds}',public.business_metric(case when v_usd_net_priced=0 then null else v_usd_net end,'money',v_net_quality,'estimated','USD',v_usd_net_priced,v_all_tx,v_observed,'USD estimated or reconciled proceeds subtotal. Native currencies are never combined without recorded FX.'));
  v_result:=jsonb_set(v_result,'{metrics,referralRevenue}',public.business_metric(case when v_usd_gross_priced=0 then null else v_usd_referral end,'money',v_money_quality,'estimated','USD',null,null,v_observed,'USD gross transaction subtotal from attributed accounts.'));
  v_result:=jsonb_set(v_result,'{metrics,nonReferralRevenue}',public.business_metric(case when v_usd_gross_priced=0 then null else v_usd_gross-v_usd_referral end,'money',v_money_quality,'estimated','USD',null,null,v_observed,'USD gross transaction subtotal from accounts without verified creator attribution.'));
  v_result:=jsonb_set(v_result,'{metrics,refunds}',public.business_metric(case when v_usd_tx=0 then null else v_usd_refunds end,'money',v_money_quality,'estimated','USD',null,null,v_observed,'USD refunded transaction subtotal.'));
  v_result:=jsonb_set(v_result,'{metrics,creatorCommissions}',public.business_metric(case when v_all_commission_entries=0 then 0 else v_usd_commissions end,'money',case when v_all_commission_entries>v_usd_commission_entries then 'incomplete' else 'estimated' end,'estimated','USD',v_usd_commission_entries,v_all_commission_entries,v_observed,'USD first-payment commission subtotal including adjustments.'));
  v_result:=jsonb_set(v_result,'{metrics,commissionPending}',public.business_metric(v_pending_commission,'money',v_balance_quality,'not_applicable','USD',v_usd_balance_entries,v_all_balance_entries,v_observed,'USD commission entries still in hold or awaiting compatible reconciliation.'));
  v_result:=jsonb_set(v_result,'{metrics,commissionPayable}',public.business_metric(v_payable_commission,'money',v_balance_quality,'allocated','USD',v_usd_balance_entries,v_all_balance_entries,v_observed,'USD held commission entries eligible for payout after reconciliation.'));
  v_result:=jsonb_set(v_result,'{metrics,commissionPaid}',public.business_metric(v_paid_commission,'money',v_balance_quality,'allocated','USD',v_usd_balance_entries,v_all_balance_entries,v_observed,'USD commission ledger entries included in paid payout batches.'));
  v_result:=jsonb_set(v_result,'{metrics,mrr}',public.business_metric(case when v_usd_paid=0 then null else v_usd_mrr end,'money',case when v_all_paid=0 then 'unavailable' when v_usd_paid<v_all_paid then 'incomplete' else 'estimated' end,'estimated','USD',v_usd_paid,v_all_paid,v_observed,'Monthly gross recurring value for active subscribers whose latest paid transaction is in USD.'));
  v_result:=jsonb_set(v_result,'{metrics,revenuePerPayingUser}',public.business_metric(case when v_usd_paid=0 or v_usd_gross_priced=0 then null else round(v_usd_gross/v_usd_paid,2) end,'money',case when v_all_paid=0 or v_all_tx=0 then 'unavailable' when v_usd_paid<v_all_paid or v_usd_tx<v_all_tx or v_usd_gross_priced<v_usd_tx then 'incomplete' else 'estimated' end,'estimated','USD',v_usd_gross,v_usd_paid,v_observed,'Selected-window USD gross subtotal divided by active subscribers whose latest paid transaction is in USD.'));
  v_result:=jsonb_set(v_result,'{metrics,contribution}',public.business_metric(v_contribution,'money',case when v_all_tx=0 or v_ai_quality='unavailable' then 'unavailable' when v_usd_tx<v_all_tx or v_usd_net_priced<v_usd_tx or v_ai_quality='incomplete' then 'incomplete' else 'estimated' end,'estimated','USD',null,null,v_observed,'USD proceeds less USD creator commissions and tracked AI cost. Incomplete while non-USD proceeds lack recorded FX.'));
  v_result:=jsonb_set(v_result,'{metrics,contributionPerSubscriber}',public.business_metric(case when v_usd_paid=0 or v_contribution is null then null else round(v_contribution/v_usd_paid,2) end,'money',case when v_all_paid=0 or v_all_tx=0 or v_ai_quality='unavailable' then 'unavailable' when v_usd_paid<v_all_paid or v_usd_tx<v_all_tx or v_usd_net_priced<v_usd_tx or v_ai_quality='incomplete' then 'incomplete' else 'estimated' end,'estimated','USD',null,v_usd_paid,v_observed,'USD contribution divided by active subscribers whose latest paid transaction is in USD.'));

  if v_all_tx>v_usd_tx then
    v_result:=jsonb_set(v_result,'{alerts}',coalesce(v_result->'alerts','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
      'key','missing_fx_conversion','severity','warning',
      'message',(v_all_tx-v_usd_tx)::text||' transactions are omitted from USD cards because no recorded FX conversion exists'
    )));
  end if;
  return v_result;
end $$;

revoke all on function public.get_founder_business_dashboard_v2(text,text,date,date) from public,anon,authenticated;
grant execute on function public.get_founder_business_dashboard_v2(text,text,date,date) to service_role;
