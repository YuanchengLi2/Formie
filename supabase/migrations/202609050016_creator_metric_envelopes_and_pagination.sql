-- Give creator reporting the same quality-aware metric contract as founder
-- reporting and bound referral detail reads with explicit pagination.
create or replace function public.get_creator_dashboard_v2(
  p_window text default '30d',
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_creator uuid;
  v_start timestamptz;
  v_row record;
  v_observed timestamptz;
  v_visits numeric;
  v_recovered numeric;
  v_accounts numeric;
  v_paid numeric;
  v_bonus_recipients numeric;
  v_referral_total integer;
begin
  select membership.creator_id into v_creator
  from public.creator_memberships membership
  where membership.user_id=auth.uid() and membership.status='active';
  if v_creator is null then raise exception 'CREATOR_ACCESS_REQUIRED'; end if;
  if p_window not in ('24h','7d','30d','90d','all') then raise exception 'INVALID_WINDOW'; end if;
  if p_limit not between 1 and 100 or p_offset not between 0 and 100000 then raise exception 'INVALID_PAGINATION'; end if;

  v_start:=case p_window
    when '24h' then now()-interval '24 hours'
    when '7d' then now()-interval '7 days'
    when '30d' then now()-interval '30 days'
    when '90d' then now()-interval '90 days'
    else '-infinity'::timestamptz
  end;

  select creator.display_name,creator.status,link.public_slug,rate.commission_basis_points into v_row
  from public.creators creator
  join public.creator_links link on link.creator_id=creator.id
  left join public.creator_rate_versions rate on rate.creator_id=creator.id and rate.effective_to is null
  where creator.id=v_creator;

  select count(*)::numeric,min(visit.issued_at) into v_visits,v_observed
  from public.referral_visits visit
  join public.creator_links link on link.id=visit.creator_link_id
  where link.creator_id=v_creator and visit.environment='production' and visit.issued_at>=v_start;

  select count(*)::numeric into v_recovered
  from public.referral_visits visit
  join public.creator_links link on link.id=visit.creator_link_id
  where link.creator_id=v_creator and visit.environment='production' and visit.recovered_at>=v_start;

  select count(*)::numeric into v_accounts
  from public.account_referrals referral
  where referral.creator_id=v_creator and referral.environment='production' and referral.attributed_at>=v_start
    and not exists(select 1 from public.business_test_accounts test where test.user_id=referral.user_id);

  select count(*)::numeric into v_paid
  from public.account_referrals referral
  where referral.creator_id=v_creator and referral.environment='production' and referral.attributed_at>=v_start
    and not exists(select 1 from public.business_test_accounts test where test.user_id=referral.user_id)
    and exists(
      select 1 from public.subscription_transactions transaction
      where transaction.user_id=referral.user_id and transaction.environment='PRODUCTION' and transaction.gross_amount>0
        and not exists(
          select 1 from public.subscription_transactions earlier
          where earlier.user_id=transaction.user_id and earlier.environment='PRODUCTION' and earlier.gross_amount>0
            and coalesce(earlier.purchased_at,earlier.created_at)<coalesce(transaction.purchased_at,transaction.created_at)
        )
    );

  select count(*)::numeric into v_bonus_recipients
  from public.referral_bonus_grants grant_row
  join public.account_referrals referral on referral.user_id=grant_row.user_id
  where referral.creator_id=v_creator and referral.environment='production' and grant_row.granted_at>=v_start
    and not exists(select 1 from public.business_test_accounts test where test.user_id=grant_row.user_id);

  select count(*)::integer into v_referral_total
  from public.account_referrals referral
  where referral.creator_id=v_creator and referral.environment='production' and referral.attributed_at>=v_start
    and not exists(select 1 from public.business_test_accounts test where test.user_id=referral.user_id);

  return jsonb_build_object(
    'generatedAt',now(),
    'window',p_window,
    'creator',jsonb_build_object(
      'displayName',v_row.display_name,
      'status',v_row.status,
      'referralUrl','https://useformie.com/r/'||v_row.public_slug,
      'rateBasisPoints',v_row.commission_basis_points
    ),
    'metrics',jsonb_build_object(
      'visits',public.business_metric(v_visits,'count','exact','not_applicable',null,v_visits,null,v_observed,'Eligible first-party referral visits issued in the selected window'),
      'recovered',public.business_metric(v_recovered,'count','exact','not_applicable',null,v_recovered,v_visits,v_observed,'Issued referral visits deterministically recovered by Formie'),
      'accounts',public.business_metric(v_accounts,'count','exact','not_applicable',null,v_accounts,null,v_observed,'New app accounts permanently attributed to this creator'),
      'paid',public.business_metric(v_paid,'count','exact','not_applicable',null,v_paid,v_accounts,v_observed,'Attributed signup-cohort accounts reaching their first positive production payment'),
      'paidConversion',public.business_metric(case when v_accounts=0 then null else round(100*v_paid/v_accounts,1) end,'percent',case when v_accounts=0 then 'unavailable' else 'exact' end,'not_applicable',null,v_paid,v_accounts,v_observed,'Attributed signup-cohort accounts reaching their first positive production payment'),
      'bonusRecipients',public.business_metric(v_bonus_recipients,'count','exact','not_applicable',null,v_bonus_recipients,null,v_observed,'Attributed accounts receiving the one-time three-analysis first-payment bonus')
    ),
    'earningsByCurrency',coalesce((
      select jsonb_agg(jsonb_build_object('currency',currency,'pending',pending,'payable',payable,'paid',paid,'adjustments',adjustments) order by currency)
      from (
        select entry.currency,
          coalesce(sum(entry.amount) filter(where entry.status='pending' and not (entry.hold_until<=now() and exists(select 1 from public.transaction_reconciliation_allocations allocation where allocation.transaction_id=entry.transaction_id))),0) pending,
          coalesce(sum(entry.amount) filter(where entry.status='payable' or (entry.status='pending' and entry.hold_until<=now() and exists(select 1 from public.transaction_reconciliation_allocations allocation where allocation.transaction_id=entry.transaction_id))),0) payable,
          coalesce(sum(entry.amount) filter(where entry.status='paid'),0) paid,
          coalesce(sum(entry.amount) filter(where entry.entry_type<>'accrual'),0) adjustments
        from public.creator_commission_entries entry where entry.creator_id=v_creator group by entry.currency
      ) balances
    ),'[]'::jsonb),
    'referrals',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',substr(encode(public.digest(referral.user_id::text,'sha256'),'hex'),1,12),
        'signedUpAt',referral.attributed_at,
        'paidAt',(select min(transaction.purchased_at) from public.subscription_transactions transaction where transaction.user_id=referral.user_id and transaction.gross_amount>0 and transaction.environment='PRODUCTION'),
        'commissionStatus',(select entry.status from public.creator_commission_entries entry where entry.referred_user_id=referral.user_id and entry.entry_type='accrual' order by entry.created_at limit 1),
        'commissionAmount',(select entry.amount from public.creator_commission_entries entry where entry.referred_user_id=referral.user_id and entry.entry_type='accrual' order by entry.created_at limit 1),
        'commissionCurrency',(select entry.currency from public.creator_commission_entries entry where entry.referred_user_id=referral.user_id and entry.entry_type='accrual' order by entry.created_at limit 1)
      ) order by referral.attributed_at desc)
      from (
        select referral.* from public.account_referrals referral
        where referral.creator_id=v_creator and referral.environment='production' and referral.attributed_at>=v_start
          and not exists(select 1 from public.business_test_accounts test where test.user_id=referral.user_id)
        order by referral.attributed_at desc limit p_limit offset p_offset
      ) referral
    ),'[]'::jsonb),
    'referralPagination',jsonb_build_object('total',v_referral_total,'limit',p_limit,'offset',p_offset,'hasMore',p_offset+p_limit<v_referral_total),
    'payouts',coalesce((
      select jsonb_agg(jsonb_build_object('id',payout.id,'currency',payout.currency,'amount',payout.amount,'status',payout.status,'preparedAt',payout.prepared_at,'paidAt',payout.paid_at) order by payout.prepared_at desc)
      from public.creator_payouts payout where payout.creator_id=v_creator
    ),'[]'::jsonb)
  );
end $$;

create or replace function public.get_creator_dashboard_v1(p_window text default '30d')
returns jsonb
language sql
security definer
set search_path=''
as $$ select public.get_creator_dashboard_v2(p_window,50,0) $$;

revoke all on function public.get_creator_dashboard_v2(text,integer,integer) from public,anon;
grant execute on function public.get_creator_dashboard_v2(text,integer,integer) to authenticated;
revoke all on function public.get_creator_dashboard_v1(text) from public,anon;
grant execute on function public.get_creator_dashboard_v1(text) to authenticated;
