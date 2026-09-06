-- Temporary, service-only acceptance journey. It creates isolated records,
-- exercises the production RPCs, removes every fixture, and restores rollout
-- settings before returning its evidence. A following migration removes it.
create or replace function public.run_creator_program_live_acceptance()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_creator_user uuid:=gen_random_uuid();
  v_other_creator_user uuid:=gen_random_uuid();
  v_referred_user uuid:=gen_random_uuid();
  v_creator uuid;
  v_other_creator uuid;
  v_slug text:='acceptance-'||substr(replace(gen_random_uuid()::text,'-',''),1,16);
  v_other_slug text:='acceptance-'||substr(replace(gen_random_uuid()::text,'-',''),1,16);
  v_token_hash text:=encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex');
  v_visit uuid;
  v_transaction uuid;
  v_reservation uuid;
  v_settings public.referral_program_settings%rowtype;
  v_bonus public.referral_bonus_grants%rowtype;
  v_dashboard jsonb;
  v_other_dashboard jsonb;
  v_base_count integer;
  v_bonus_count integer;
  v_commission_count integer;
  v_grant_count integer;
  v_quota_rejected boolean:=false;
  v_index integer;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  select * into v_settings from public.referral_program_settings where singleton for update;

  insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at)
  values(v_creator_user,'authenticated','authenticated','creator-'||v_creator_user||'@example.invalid',now(),now(),now()),
        (v_other_creator_user,'authenticated','authenticated','creator-'||v_other_creator_user||'@example.invalid',now(),now(),now());
  v_creator:=public.provision_creator(v_creator_user,'Acceptance Creator',v_slug,1500,v_creator_user);
  v_other_creator:=public.provision_creator(v_other_creator_user,'Acceptance Other',v_other_slug,1000,v_creator_user);
  perform public.set_referral_program_settings(true,true,v_creator_user);

  select visit_id into v_visit
  from public.issue_creator_referral_visit(v_slug,v_token_hash,'production',now()+interval '30 days');
  if v_visit is null then raise exception 'ACCEPTANCE_VISIT_NOT_ISSUED'; end if;
  if not exists(select 1 from public.preview_referral_visit(v_token_hash) where eligible) then
    raise exception 'ACCEPTANCE_VISIT_NOT_PREVIEWABLE';
  end if;

  insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at)
  values(v_referred_user,'authenticated','authenticated','referred-'||v_referred_user||'@example.invalid',now(),now(),now());
  insert into public.business_test_accounts(user_id,reason,marked_by)
  values(v_referred_user,'isolated creator program live acceptance',v_creator_user);
  perform public.claim_referral_visit(v_token_hash,v_referred_user,'nativelink');
  perform public.claim_referral_visit(v_token_hash,v_referred_user,'nativelink');
  if not exists(select 1 from public.account_referrals where user_id=v_referred_user and creator_id=v_creator and reward_eligible) then
    raise exception 'ACCEPTANCE_ATTRIBUTION_NOT_LOCKED';
  end if;

  v_transaction:=public.project_revenuecat_transaction(
    'acceptance-initial-'||v_referred_user,v_referred_user,encode(extensions.digest(v_referred_user::text,'sha256'),'hex'),
    'INITIAL_PURCHASE','app_store','PRODUCTION','acceptance-tx-'||v_referred_user,'acceptance-original-'||v_referred_user,
    'formie_monthly',now(),now(),now()+interval '31 days',9.99,'USD','US',0,0.15,null,null
  );
  perform public.project_revenuecat_transaction(
    'acceptance-duplicate-'||v_referred_user,v_referred_user,encode(extensions.digest(v_referred_user::text,'sha256'),'hex'),
    'INITIAL_PURCHASE','app_store','PRODUCTION','acceptance-tx-'||v_referred_user,'acceptance-original-'||v_referred_user,
    'formie_monthly',now(),now(),now()+interval '31 days',9.99,'USD','US',0,0.15,null,null
  );
  perform public.project_revenuecat_transaction(
    'acceptance-renewal-'||v_referred_user,v_referred_user,encode(extensions.digest(v_referred_user::text,'sha256'),'hex'),
    'RENEWAL','app_store','PRODUCTION','acceptance-renewal-tx-'||v_referred_user,'acceptance-original-'||v_referred_user,
    'formie_monthly',now()+interval '31 days',now()+interval '31 days',now()+interval '62 days',9.99,'USD','US',0,0.15,null,null
  );

  select count(*) into v_grant_count from public.referral_bonus_grants where user_id=v_referred_user;
  select count(*) into v_commission_count from public.creator_commission_entries where referred_user_id=v_referred_user and entry_type='accrual';
  if v_grant_count<>1 or v_commission_count<>1 then raise exception 'ACCEPTANCE_REWARD_DUPLICATED'; end if;
  select * into v_bonus from public.referral_bonus_grants where user_id=v_referred_user;
  if v_bonus.units_granted<>3 or v_bonus.period_start is null or v_bonus.period_end is null then raise exception 'ACCEPTANCE_BONUS_INVALID'; end if;

  insert into public.user_access_entitlements(user_id,status,entitlement_id,revenuecat_app_user_id,store_product_id,current_period_start,current_period_end,last_reconciled_at,last_customer_info)
  values(v_referred_user,'active','acceptance','acceptance-'||v_referred_user,'formie_monthly',v_bonus.period_start,v_bonus.period_end,now(),'{}'::jsonb)
  on conflict(user_id) do update set status='active',current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,updated_at=now();
  for v_index in 1..13 loop
    select reservation_id into v_reservation
    from public.reserve_analysis_credit_for_user(v_referred_user,'acceptance-analysis-'||v_index,'analysis',null);
    update public.analysis_credit_reservations set status='committed',committed_at=now() where id=v_reservation;
    update public.analysis_attempts set status='complete',terminal_at=now(),updated_at=now() where reservation_id=v_reservation;
  end loop;
  select count(*) into v_base_count from public.analysis_credit_reservations where user_id=v_referred_user and funding_source='base' and status='committed';
  select count(*) into v_bonus_count from public.analysis_credit_reservations where user_id=v_referred_user and funding_source='referral_bonus' and status='committed';
  if v_base_count<>10 or v_bonus_count<>3 then raise exception 'ACCEPTANCE_QUOTA_FUNDING_INVALID'; end if;
  begin
    perform public.reserve_analysis_credit_for_user(v_referred_user,'acceptance-analysis-14','analysis',null);
  exception when others then
    if position('ANALYSIS_QUOTA_EXCEEDED' in sqlerrm)>0 then v_quota_rejected:=true; else raise; end if;
  end;
  if not v_quota_rejected then raise exception 'ACCEPTANCE_FOURTEENTH_NOT_REJECTED'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_creator_user,'role','authenticated')::text,true);
  v_dashboard:=public.get_creator_dashboard_v1('30d');
  if (v_dashboard#>>'{metrics,accounts}')::integer<>1 or (v_dashboard#>>'{metrics,paid}')::integer<>1 then
    raise exception 'ACCEPTANCE_CREATOR_DASHBOARD_INVALID';
  end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_other_creator_user,'role','authenticated')::text,true);
  v_other_dashboard:=public.get_creator_dashboard_v1('30d');
  if (v_other_dashboard#>>'{metrics,accounts}')::integer<>0 or jsonb_array_length(v_other_dashboard->'referrals')<>0 then
    raise exception 'ACCEPTANCE_TENANT_ISOLATION_FAILED';
  end if;

  perform public.project_revenuecat_transaction(
    'acceptance-refund-'||v_referred_user,v_referred_user,encode(extensions.digest(v_referred_user::text,'sha256'),'hex'),
    'REFUND','app_store','PRODUCTION','acceptance-tx-'||v_referred_user,'acceptance-original-'||v_referred_user,
    'formie_monthly',now(),v_bonus.period_start,v_bonus.period_end,9.99,'USD','US',0,0.15,now(),null
  );
  if not exists(select 1 from public.referral_bonus_grants where user_id=v_referred_user and state='revoked')
    or not exists(select 1 from public.creator_commission_entries where referred_user_id=v_referred_user and entry_type='refund_adjustment') then
    raise exception 'ACCEPTANCE_REFUND_NOT_PROJECTED';
  end if;
  perform public.project_revenuecat_transaction(
    'acceptance-reversal-'||v_referred_user,v_referred_user,encode(extensions.digest(v_referred_user::text,'sha256'),'hex'),
    'REFUND_REVERSED','app_store','PRODUCTION','acceptance-tx-'||v_referred_user,'acceptance-original-'||v_referred_user,
    'formie_monthly',now(),v_bonus.period_start,v_bonus.period_end,9.99,'USD','US',0,0.15,null,now()
  );
  if not exists(select 1 from public.referral_bonus_grants where user_id=v_referred_user and state='active' and refund_reversed_at is not null)
    or not exists(select 1 from public.creator_commission_entries where referred_user_id=v_referred_user and entry_type='refund_reversal') then
    raise exception 'ACCEPTANCE_REVERSAL_NOT_PROJECTED';
  end if;

  delete from public.analysis_attempts where user_id=v_referred_user;
  delete from public.analysis_credit_reservations where user_id=v_referred_user;
  delete from public.referral_bonus_grants where user_id=v_referred_user;
  delete from public.creator_commission_entries where referred_user_id=v_referred_user;
  delete from public.subscription_reward_redemptions where user_id=v_referred_user;
  delete from public.account_referrals where user_id=v_referred_user;
  delete from public.referral_visits where id=v_visit;
  delete from public.subscription_transactions where user_id=v_referred_user;
  delete from public.business_test_accounts where user_id=v_referred_user;
  delete from public.creator_memberships where user_id in (v_creator_user,v_other_creator_user);
  delete from public.creator_links where creator_id in (v_creator,v_other_creator);
  delete from public.creator_rate_versions where creator_id in (v_creator,v_other_creator);
  delete from public.founder_action_audit where actor_user_id in (v_creator_user,v_other_creator_user,v_referred_user) or entity_id in (v_creator::text,v_other_creator::text);
  delete from public.creators where id in (v_creator,v_other_creator);
  delete from auth.users where id in (v_creator_user,v_other_creator_user,v_referred_user);
  update public.referral_program_settings set issuance_enabled=v_settings.issuance_enabled,rewards_enabled=v_settings.rewards_enabled,updated_at=v_settings.updated_at,updated_by=v_settings.updated_by where singleton;
  perform set_config('request.jwt.claims','{}',true);

  return jsonb_build_object(
    'attributionLocked',true,'grantCount',v_grant_count,'commissionCount',v_commission_count,
    'baseUsed',v_base_count,'bonusUsed',v_bonus_count,'fourteenthRejected',v_quota_rejected,
    'creatorAccounts',(v_dashboard#>>'{metrics,accounts}')::integer,
    'otherCreatorAccounts',(v_other_dashboard#>>'{metrics,accounts}')::integer,
    'refundAdjusted',true,'refundReversed',true,'fixturesRemoved',true
  );
end $$;

revoke all on function public.run_creator_program_live_acceptance() from public,anon,authenticated;
grant execute on function public.run_creator_program_live_acceptance() to service_role;
