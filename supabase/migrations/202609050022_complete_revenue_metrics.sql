create or replace function public.get_founder_business_dashboard_v5(
  p_section text default 'overview',p_window text default '30d',p_start date default null,p_end date default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_result jsonb; v_start timestamptz; v_end timestamptz; v_observed timestamptz;
  v_first_all numeric; v_first_usd numeric; v_first_usd_priced numeric; v_first_usd_gross numeric;
  v_deduction_all numeric; v_deduction_usd numeric; v_deduction_priced numeric; v_deductions numeric;
  v_adjustment_all numeric; v_adjustment_usd numeric; v_refund_adjustments numeric; v_reversal_adjustments numeric;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  v_result:=public.get_founder_business_dashboard_v4(p_section,p_window,p_start,p_end);
  v_start:=coalesce((v_result->>'rangeStart')::timestamptz,'-infinity'::timestamptz);
  v_end:=(v_result->>'rangeEnd')::timestamptz;
  v_observed:=nullif(v_result#>>'{metrics,grossRevenue,observedSince}','')::timestamptz;

  select count(*)::numeric,count(*) filter(where currency='USD')::numeric,count(gross_amount) filter(where currency='USD')::numeric,coalesce(sum(gross_amount) filter(where currency='USD'),0)::numeric
  into v_first_all,v_first_usd,v_first_usd_priced,v_first_usd_gross from (
    select ranked.* from (
      select transaction.*,row_number() over(partition by transaction.user_id order by coalesce(transaction.purchased_at,transaction.created_at),transaction.created_at,transaction.id) sequence
      from public.subscription_transactions transaction where transaction.environment='PRODUCTION' and transaction.user_id is not null and transaction.gross_amount>0
        and not exists(select 1 from public.business_test_accounts test where test.user_id=transaction.user_id)
    ) ranked where ranked.sequence=1 and coalesce(ranked.purchased_at,ranked.created_at)>=v_start and coalesce(ranked.purchased_at,ranked.created_at)<v_end
  ) first_payments;

  select count(*)::numeric,count(*) filter(where transaction.currency='USD')::numeric,count(*) filter(where transaction.currency='USD' and transaction.gross_amount is not null and transaction.estimated_net_proceeds is not null)::numeric,
    coalesce(sum(transaction.gross_amount-transaction.estimated_net_proceeds) filter(where transaction.currency='USD' and transaction.gross_amount is not null and transaction.estimated_net_proceeds is not null),0)::numeric
  into v_deduction_all,v_deduction_usd,v_deduction_priced,v_deductions
  from public.subscription_transactions transaction where transaction.environment='PRODUCTION' and coalesce(transaction.purchased_at,transaction.created_at)>=v_start and coalesce(transaction.purchased_at,transaction.created_at)<v_end
    and not exists(select 1 from public.business_test_accounts test where test.user_id=transaction.user_id);

  select count(*)::numeric,count(*) filter(where entry.currency='USD')::numeric,
    coalesce(sum(entry.amount) filter(where entry.currency='USD' and entry.entry_type='refund_adjustment'),0)::numeric,
    coalesce(sum(entry.amount) filter(where entry.currency='USD' and entry.entry_type='refund_reversal'),0)::numeric
  into v_adjustment_all,v_adjustment_usd,v_refund_adjustments,v_reversal_adjustments
  from public.creator_commission_entries entry where entry.entry_type in ('refund_adjustment','refund_reversal') and entry.created_at>=v_start and entry.created_at<v_end
    and not exists(select 1 from public.business_test_accounts test where test.user_id=entry.referred_user_id);

  v_result:=jsonb_set(v_result,'{metrics,newSubscriptionRevenue}',public.business_metric(
    case when v_first_usd_priced=0 then null else v_first_usd_gross end,'money',
    case when v_first_all=0 then 'unavailable' when v_first_usd<v_first_all or v_first_usd_priced<v_first_usd then 'incomplete' else 'estimated' end,
    'estimated','USD',v_first_usd_priced,v_first_all,v_observed,'USD gross value from each account''s earliest verified positive production payment in the selected window.'
  ));
  v_result:=jsonb_set(v_result,'{metrics,storeDeductions}',public.business_metric(
    case when v_deduction_priced=0 then null else v_deductions end,'money',
    case when v_deduction_all=0 then 'unavailable' when v_deduction_usd<v_deduction_all or v_deduction_priced<v_deduction_usd then 'incomplete' else 'estimated' end,
    'estimated','USD',v_deduction_priced,v_deduction_all,v_observed,'Combined estimated App Store commission and applicable transaction-tax deduction for USD transactions. The source does not support a reliable split.'
  ));
  v_result:=jsonb_set(v_result,'{metrics,refundCommissionAdjustments}',public.business_metric(
    case when v_adjustment_all=0 then 0 else v_refund_adjustments end,'money',case when v_adjustment_usd<v_adjustment_all then 'incomplete' else 'exact' end,
    'not_applicable','USD',v_adjustment_usd,v_adjustment_all,v_observed,'USD creator-commission reductions created by refunded qualifying first payments.'
  ));
  v_result:=jsonb_set(v_result,'{metrics,refundReversalAdjustments}',public.business_metric(
    case when v_adjustment_all=0 then 0 else v_reversal_adjustments end,'money',case when v_adjustment_usd<v_adjustment_all then 'incomplete' else 'exact' end,
    'not_applicable','USD',v_adjustment_usd,v_adjustment_all,v_observed,'USD creator-commission restorations created by verified refund reversals.'
  ));
  return v_result;
end $$;

revoke all on function public.get_founder_business_dashboard_v5(text,text,date,date) from public,anon,authenticated;
grant execute on function public.get_founder_business_dashboard_v5(text,text,date,date) to service_role;
