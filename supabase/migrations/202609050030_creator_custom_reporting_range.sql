create or replace function public.get_creator_dashboard_v5(
  p_window text default '30d',p_start date default null,p_end date default null,p_limit integer default 50,p_offset integer default 0
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; creator_id uuid; start_at timestamptz; end_at timestamptz; observed timestamptz; visits numeric; recovered numeric; accounts numeric; paid numeric; bonus numeric; referral_total integer;
begin
  select membership.creator_id into creator_id from public.creator_memberships membership where membership.user_id=auth.uid() and membership.status='active';
  if creator_id is null then raise exception 'CREATOR_ACCESS_REQUIRED'; end if;
  if p_limit not between 1 and 100 or p_offset not between 0 and 100000 then raise exception 'INVALID_PAGINATION'; end if;
  if p_window='custom' then
    if p_start is null or p_end is null or p_end<p_start or p_end-p_start>366 then raise exception 'INVALID_CUSTOM_RANGE'; end if;
    start_at:=p_start::timestamp at time zone 'America/New_York'; end_at:=(p_end+1)::timestamp at time zone 'America/New_York';
    result:=public.get_creator_dashboard_v4('all',p_limit,p_offset);
  elsif p_window in ('24h','7d','30d','90d','all') then
    result:=public.get_creator_dashboard_v4(p_window,p_limit,p_offset);
    start_at:=case p_window when '24h' then now()-interval '24 hours' when '7d' then now()-interval '7 days' when '30d' then now()-interval '30 days' when '90d' then now()-interval '90 days' else '-infinity'::timestamptz end;
    end_at:=now();
  else raise exception 'INVALID_WINDOW'; end if;
  select count(*),min(visit.issued_at) into visits,observed from public.referral_visits visit join public.creator_links link on link.id=visit.creator_link_id where link.creator_id=creator_id and visit.environment='production' and visit.issued_at>=start_at and visit.issued_at<end_at;
  select count(*) into recovered from public.referral_visits visit join public.creator_links link on link.id=visit.creator_link_id where link.creator_id=creator_id and visit.environment='production' and visit.recovered_at>=start_at and visit.recovered_at<end_at;
  select count(*) into accounts from public.account_referrals referral where referral.creator_id=creator_id and referral.environment='production' and referral.attributed_at>=start_at and referral.attributed_at<end_at and not exists(select 1 from public.business_test_accounts test where test.user_id=referral.user_id);
  select count(*) into paid from public.account_referrals referral where referral.creator_id=creator_id and referral.environment='production' and referral.attributed_at>=start_at and referral.attributed_at<end_at and not exists(select 1 from public.business_test_accounts test where test.user_id=referral.user_id) and exists(select 1 from public.subscription_transactions transaction where transaction.user_id=referral.user_id and transaction.environment='PRODUCTION' and transaction.gross_amount>0 and coalesce(transaction.purchased_at,transaction.created_at)>=referral.attributed_at and coalesce(transaction.purchased_at,transaction.created_at)<end_at);
  select count(*) into bonus from public.referral_bonus_grants grant_row join public.account_referrals referral on referral.user_id=grant_row.user_id where referral.creator_id=creator_id and referral.environment='production' and grant_row.granted_at>=start_at and grant_row.granted_at<end_at and not exists(select 1 from public.business_test_accounts test where test.user_id=grant_row.user_id);
  referral_total:=accounts::integer;
  result:=jsonb_set(result,'{window}',to_jsonb(p_window));
  result:=jsonb_set(result,'{rangeStart}',case when start_at='-infinity'::timestamptz then 'null'::jsonb else to_jsonb(start_at) end,true);
  result:=jsonb_set(result,'{rangeEnd}',to_jsonb(end_at),true);
  result:=jsonb_set(result,'{metrics,visits}',public.business_metric(visits,'count','exact','not_applicable',null,visits,null,observed,'Successful creator-code validations in the selected window.'));
  result:=jsonb_set(result,'{metrics,recovered}',public.business_metric(recovered,'count','exact','not_applicable',null,recovered,visits,observed,'Validated creator-code claims ready to attach in the selected window.'));
  result:=jsonb_set(result,'{metrics,accounts}',public.business_metric(accounts,'count','exact','not_applicable',null,accounts,null,observed,'New app accounts permanently attributed in the selected window.'));
  result:=jsonb_set(result,'{metrics,paid}',public.business_metric(paid,'count','exact','not_applicable',null,paid,accounts,observed,'Selected attributed accounts reaching their first positive production payment by the selected cutoff.'));
  result:=jsonb_set(result,'{metrics,paidConversion}',public.business_metric(case when accounts=0 then null else round(100*paid/accounts,1) end,'percent',case when accounts=0 then 'unavailable' else 'exact' end,'not_applicable',null,paid,accounts,observed,'Selected attributed signup cohort accounts reaching a first positive production payment.'));
  result:=jsonb_set(result,'{metrics,bonusRecipients}',public.business_metric(bonus,'count','exact','not_applicable',null,bonus,null,observed,'Attributed accounts receiving the one-time bonus in the selected window.'));
  result:=jsonb_set(result,'{referrals}',coalesce((select jsonb_agg(jsonb_build_object(
    'id',substr(encode(extensions.digest(referral.user_id::text,'sha256'),'hex'),1,12),'signedUpAt',referral.attributed_at,
    'paidAt',(select min(coalesce(transaction.purchased_at,transaction.created_at)) from public.subscription_transactions transaction where transaction.user_id=referral.user_id and transaction.gross_amount>0 and transaction.environment='PRODUCTION' and coalesce(transaction.purchased_at,transaction.created_at)<end_at),
    'commissionStatus',(select entry.status from public.creator_commission_entries entry where entry.referred_user_id=referral.user_id and entry.entry_type='accrual' order by entry.created_at limit 1),
    'commissionAmount',(select entry.amount from public.creator_commission_entries entry where entry.referred_user_id=referral.user_id and entry.entry_type='accrual' order by entry.created_at limit 1),
    'commissionCurrency',(select entry.currency from public.creator_commission_entries entry where entry.referred_user_id=referral.user_id and entry.entry_type='accrual' order by entry.created_at limit 1)
  ) order by referral.attributed_at desc) from (select row.* from public.account_referrals row where row.creator_id=creator_id and row.environment='production' and row.attributed_at>=start_at and row.attributed_at<end_at and not exists(select 1 from public.business_test_accounts test where test.user_id=row.user_id) order by row.attributed_at desc limit p_limit offset p_offset) referral),'[]'::jsonb));
  result:=jsonb_set(result,'{referralPagination}',jsonb_build_object('total',referral_total,'limit',p_limit,'offset',p_offset,'hasMore',p_offset+p_limit<referral_total));
  return result;
end $$;

revoke all on function public.get_creator_dashboard_v5(text,date,date,integer,integer) from public,anon;
grant execute on function public.get_creator_dashboard_v5(text,date,date,integer,integer) to authenticated;
