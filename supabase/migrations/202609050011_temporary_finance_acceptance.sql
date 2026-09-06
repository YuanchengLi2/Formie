-- Temporary service-only journey for Apple allocation and manual payouts.
-- A following migration removes this function after its live execution.
create or replace function public.run_creator_finance_live_acceptance()
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_creator_user uuid:=gen_random_uuid();
  v_referred_user uuid:=gen_random_uuid();
  v_creator uuid;
  v_slug text:='finance-'||substr(replace(gen_random_uuid()::text,'-',''),1,16);
  v_token_hash text:=encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex');
  v_visit uuid;
  v_transaction uuid;
  v_import_result jsonb;
  v_import uuid;
  v_payout uuid;
  v_settings public.referral_program_settings%rowtype;
  v_final numeric;
  v_adjustment numeric;
  v_payout_amount numeric;
  v_refund_adjustment numeric;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  select * into v_settings from public.referral_program_settings where singleton for update;
  insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at)
  values(v_creator_user,'authenticated','authenticated','finance-creator-'||v_creator_user||'@example.invalid',now(),now(),now());
  v_creator:=public.provision_creator(v_creator_user,'Finance Acceptance',v_slug,1500,v_creator_user);
  perform public.set_referral_program_settings(true,true,v_creator_user);
  select issued.visit_id into v_visit
  from public.issue_creator_referral_visit(v_slug,v_token_hash,'production',now()+interval '30 days') issued;
  insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at)
  values(v_referred_user,'authenticated','authenticated','finance-referred-'||v_referred_user||'@example.invalid',now(),now(),now());
  insert into public.business_test_accounts(user_id,reason,marked_by)
  values(v_referred_user,'isolated creator finance live acceptance',v_creator_user);
  perform public.claim_referral_visit(v_token_hash,v_referred_user,'direct_link');
  v_transaction:=public.project_revenuecat_transaction(
    'finance-initial-'||v_referred_user,v_referred_user,encode(extensions.digest(v_referred_user::text,'sha256'),'hex'),
    'INITIAL_PURCHASE','app_store','PRODUCTION','finance-tx-'||v_referred_user,'finance-original-'||v_referred_user,
    'formie_monthly',now(),now(),now()+interval '31 days',9.99,'USD','US',0,0.15,null,null
  );
  v_import_result:=public.import_and_reconcile_apple_financial_report(
    encode(extensions.digest('finance-report-'||v_referred_user,'sha256'),'hex'),
    'finance-acceptance.txt','acceptance/finance.txt',current_date-1,current_date+1,'USD',
    jsonb_build_array(jsonb_build_object(
      'line_number',1,'transaction_date',current_date,'settlement_date',current_date,
      'sku','formie_monthly','product_type_identifier','1A','country_of_sale','US',
      'quantity',1,'sale_or_return','S','partner_share',6.99,'extended_partner_share',6.99,
      'partner_share_currency','USD','customer_price',9.99,'customer_currency','USD'
    )),v_creator_user
  );
  v_import:=(v_import_result->>'importId')::uuid;
  select transaction.estimated_net_proceeds into v_final from public.subscription_transactions transaction where transaction.id=v_transaction and transaction.financial_status='final';
  select entry.amount into v_adjustment from public.creator_commission_entries entry where entry.transaction_id=v_transaction and entry.entry_type='reconciliation_adjustment';
  if v_final<>6.99 or v_adjustment<>-0.225225 then raise exception 'ACCEPTANCE_FINAL_ALLOCATION_INVALID'; end if;
  update public.creator_commission_entries set hold_until=now()-interval '1 day' where transaction_id=v_transaction;
  v_payout:=public.prepare_creator_payout(v_creator,'USD',v_creator_user);
  select payout.amount into v_payout_amount from public.creator_payouts payout where payout.id=v_payout;
  if v_payout_amount<>1.048500 then raise exception 'ACCEPTANCE_PAYOUT_AMOUNT_INVALID'; end if;
  perform public.mark_creator_payout_paid(v_payout,now(),'acceptance-external-reference',v_creator_user);
  if not exists(select 1 from public.creator_payouts payout where payout.id=v_payout and payout.status='paid' and payout.external_reference='acceptance-external-reference') then
    raise exception 'ACCEPTANCE_PAYOUT_NOT_PAID';
  end if;
  if exists(select 1 from public.creator_payout_items item join public.creator_commission_entries entry on entry.id=item.commission_entry_id where item.payout_id=v_payout and entry.status<>'paid') then
    raise exception 'ACCEPTANCE_PAYOUT_ITEMS_NOT_PAID';
  end if;
  perform public.project_revenuecat_transaction(
    'finance-refund-'||v_referred_user,v_referred_user,encode(extensions.digest(v_referred_user::text,'sha256'),'hex'),
    'REFUND','app_store','PRODUCTION','finance-tx-'||v_referred_user,'finance-original-'||v_referred_user,
    'formie_monthly',now(),now(),now()+interval '31 days',9.99,'USD','US',0,0.15,now(),null
  );
  select entry.amount into v_refund_adjustment from public.creator_commission_entries entry where entry.transaction_id=v_transaction and entry.entry_type='refund_adjustment';
  if v_refund_adjustment<>-1.048500 then raise exception 'ACCEPTANCE_RECONCILED_REFUND_INVALID'; end if;
  perform public.project_revenuecat_transaction(
    'finance-reversal-'||v_referred_user,v_referred_user,encode(extensions.digest(v_referred_user::text,'sha256'),'hex'),
    'REFUND_REVERSED','app_store','PRODUCTION','finance-tx-'||v_referred_user,'finance-original-'||v_referred_user,
    'formie_monthly',now(),now(),now()+interval '31 days',9.99,'USD','US',0,0.15,null,now()
  );
  if not exists(select 1 from public.creator_commission_entries entry where entry.transaction_id=v_transaction and entry.entry_type='refund_reversal' and entry.amount=1.048500) then
    raise exception 'ACCEPTANCE_RECONCILED_REVERSAL_INVALID';
  end if;

  delete from public.creator_payout_items where payout_id=v_payout;
  delete from public.creator_payouts where id=v_payout;
  delete from public.transaction_reconciliation_allocations where import_id=v_import;
  delete from public.apple_financial_lines where import_id=v_import;
  delete from public.apple_financial_imports where id=v_import;
  delete from public.referral_bonus_grants where user_id=v_referred_user;
  delete from public.creator_commission_entries where referred_user_id=v_referred_user;
  delete from public.subscription_reward_redemptions where user_id=v_referred_user;
  delete from public.account_referrals where user_id=v_referred_user;
  delete from public.referral_visits where id=v_visit;
  delete from public.subscription_transactions where user_id=v_referred_user;
  delete from public.business_test_accounts where user_id=v_referred_user;
  delete from public.creator_memberships where user_id=v_creator_user;
  delete from public.creator_links where creator_id=v_creator;
  delete from public.creator_rate_versions where creator_id=v_creator;
  delete from public.founder_action_audit where actor_user_id in (v_creator_user,v_referred_user) or entity_id=v_creator::text or entity_id=v_payout::text or entity_id=v_import::text;
  delete from public.creators where id=v_creator;
  delete from auth.users where id in (v_creator_user,v_referred_user);
  update public.referral_program_settings set issuance_enabled=v_settings.issuance_enabled,rewards_enabled=v_settings.rewards_enabled,updated_at=v_settings.updated_at,updated_by=v_settings.updated_by where singleton;
  return jsonb_build_object(
    'allocatedProceeds',v_final,'reconciliationAdjustment',v_adjustment,'payoutAmount',v_payout_amount,
    'paidWithReference',true,'refundAdjustment',v_refund_adjustment,'refundReversal',1.048500,
    'nativeCurrency','USD','fixturesRemoved',true
  );
end $$;

revoke all on function public.run_creator_finance_live_acceptance() from public,anon,authenticated;
grant execute on function public.run_creator_finance_live_acceptance() to service_role;
