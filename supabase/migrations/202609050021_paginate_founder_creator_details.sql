create or replace function public.get_founder_creator_detail_v1(
  p_creator_id uuid,p_window text default 'all',p_limit integer default 50,p_offset integer default 0
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_start timestamptz; v_creator record; v_total integer;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_window not in ('24h','7d','30d','90d','all') then raise exception 'INVALID_WINDOW'; end if;
  if p_limit<1 or p_limit>100 or p_offset<0 or p_offset>100000 then raise exception 'INVALID_PAGE'; end if;
  v_start:=case p_window when '24h' then now()-interval '24 hours' when '7d' then now()-interval '7 days' when '30d' then now()-interval '30 days' when '90d' then now()-interval '90 days' else '-infinity'::timestamptz end;
  select creator.id,creator.display_name,creator.status,link.public_slug,link.status link_status,rate.commission_basis_points
  into v_creator from public.creators creator
  left join lateral (select item.public_slug,item.status from public.creator_links item where item.creator_id=creator.id order by item.created_at limit 1) link on true
  left join lateral (select version.commission_basis_points from public.creator_rate_versions version where version.creator_id=creator.id and version.effective_to is null order by version.effective_from desc limit 1) rate on true
  where creator.id=p_creator_id;
  if v_creator.id is null then return null; end if;
  select count(*) into v_total from public.account_referrals referral where referral.creator_id=p_creator_id and referral.environment='production' and referral.attributed_at>=v_start and not exists(select 1 from public.business_test_accounts test where test.user_id=referral.user_id);
  return jsonb_build_object(
    'id',v_creator.id,'displayName',v_creator.display_name,'status',v_creator.status,'slug',v_creator.public_slug,'linkStatus',v_creator.link_status,'rateBasisPoints',v_creator.commission_basis_points,
    'memberships',(select coalesce(jsonb_agg(jsonb_build_object('userId',membership.user_id,'status',membership.status,'createdAt',membership.created_at) order by membership.created_at),'[]'::jsonb) from public.creator_memberships membership where membership.creator_id=p_creator_id),
    'visits',(select count(*) from public.referral_visits visit join public.creator_links link on link.id=visit.creator_link_id where link.creator_id=p_creator_id and visit.environment='production' and visit.issued_at>=v_start),
    'recovered',(select count(*) from public.referral_visits visit join public.creator_links link on link.id=visit.creator_link_id where link.creator_id=p_creator_id and visit.environment='production' and visit.recovered_at>=v_start),
    'excludedRequests',(select count(*) from public.creator_referral_exclusions exclusion join public.creator_links link on link.id=exclusion.creator_link_id where link.creator_id=p_creator_id and exclusion.excluded_at>=v_start),
    'accounts',v_total,
    'paid',(select count(*) from public.account_referrals referral where referral.creator_id=p_creator_id and referral.environment='production' and referral.attributed_at>=v_start and not exists(select 1 from public.business_test_accounts test where test.user_id=referral.user_id) and exists(select 1 from public.subscription_transactions transaction where transaction.user_id=referral.user_id and transaction.environment='PRODUCTION' and transaction.gross_amount>0)),
    'earningsByCurrency',coalesce((select jsonb_agg(jsonb_build_object('currency',currency,'pending',pending,'payable',payable,'paid',paid,'adjustments',adjustments) order by currency) from (select entry.currency,
      coalesce(sum(entry.amount) filter(where entry.status='pending' and not (entry.hold_until<=now() and exists(select 1 from public.transaction_reconciliation_allocations allocation where allocation.transaction_id=entry.transaction_id))),0) pending,
      coalesce(sum(entry.amount) filter(where entry.status='payable' or (entry.status='pending' and entry.hold_until<=now() and exists(select 1 from public.transaction_reconciliation_allocations allocation where allocation.transaction_id=entry.transaction_id))),0) payable,
      coalesce(sum(entry.amount) filter(where entry.status='paid'),0) paid,
      coalesce(sum(entry.amount) filter(where entry.entry_type<>'accrual'),0) adjustments
      from public.creator_commission_entries entry where entry.creator_id=p_creator_id and not exists(select 1 from public.business_test_accounts test where test.user_id=entry.referred_user_id) group by entry.currency) balances),'[]'::jsonb),
    'referrals',coalesce((select jsonb_agg(jsonb_build_object(
      'id',substr(encode(extensions.digest(referral.user_id::text,'sha256'),'hex'),1,12),'signedUpAt',referral.attributed_at,
      'paidAt',(select min(coalesce(transaction.purchased_at,transaction.created_at)) from public.subscription_transactions transaction where transaction.user_id=referral.user_id and transaction.environment='PRODUCTION' and transaction.gross_amount>0),
      'commissionStatus',(select entry.status from public.creator_commission_entries entry where entry.referred_user_id=referral.user_id and entry.entry_type='accrual' order by entry.created_at limit 1),
      'commissionAmount',(select entry.amount from public.creator_commission_entries entry where entry.referred_user_id=referral.user_id and entry.entry_type='accrual' order by entry.created_at limit 1),
      'commissionCurrency',(select entry.currency from public.creator_commission_entries entry where entry.referred_user_id=referral.user_id and entry.entry_type='accrual' order by entry.created_at limit 1),
      'bonusState',(select case when grant_row.revoked_at is not null then 'revoked' when grant_row.period_end<=now() then 'expired' else 'active' end from public.referral_bonus_grants grant_row where grant_row.user_id=referral.user_id)
    ) order by referral.attributed_at desc) from (select item.* from public.account_referrals item where item.creator_id=p_creator_id and item.environment='production' and item.attributed_at>=v_start and not exists(select 1 from public.business_test_accounts test where test.user_id=item.user_id) order by item.attributed_at desc limit p_limit offset p_offset) referral),'[]'::jsonb),
    'referralPagination',jsonb_build_object('total',v_total,'limit',p_limit,'offset',p_offset,'hasMore',p_offset+p_limit<v_total),
    'payouts',coalesce((select jsonb_agg(jsonb_build_object('id',payout.id,'currency',payout.currency,'amount',payout.amount,'status',payout.status,'preparedAt',payout.prepared_at,'paidAt',payout.paid_at,'externalReference',payout.external_reference) order by payout.prepared_at desc) from (select item.* from public.creator_payouts item where item.creator_id=p_creator_id order by (item.status='prepared') desc,item.prepared_at desc limit 100) payout),'[]'::jsonb)
  );
end $$;

create or replace function public.get_founder_business_dashboard_v4(
  p_section text default 'overview',p_window text default '30d',p_start date default null,p_end date default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_creators jsonb;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  v_result:=public.get_founder_business_dashboard_v3(p_section,p_window,p_start,p_end);
  select coalesce(jsonb_agg(item-'referrals'-'payouts'),'[]'::jsonb) into v_creators from jsonb_array_elements(coalesce(v_result->'creators','[]'::jsonb)) item;
  return jsonb_set(v_result,'{creators}',v_creators);
end $$;

revoke all on function public.get_founder_creator_detail_v1(uuid,text,integer,integer),public.get_founder_business_dashboard_v4(text,text,date,date) from public,anon,authenticated;
grant execute on function public.get_founder_creator_detail_v1(uuid,text,integer,integer),public.get_founder_business_dashboard_v4(text,text,date,date) to service_role;
