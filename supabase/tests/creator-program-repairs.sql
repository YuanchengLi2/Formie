begin;

create temporary table creator_repair_results(
  creator_id uuid,
  referred_user_id uuid,
  transaction_id uuid,
  grant_count integer,
  accrual_count integer,
  unknown_net numeric,
  refund_grant_state text,
  renewed_base_used integer
);

do $$
declare
  v_creator_user uuid:=gen_random_uuid();
  v_referred_user uuid:=gen_random_uuid();
  v_creator uuid;
  v_code text:='repair-'||substr(replace(gen_random_uuid()::text,'-',''),1,12);
  v_token_hash text:=encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex');
  v_transaction uuid;
  v_unknown uuid;
  v_period_start timestamptz:=date_trunc('day',now())-interval '5 days';
  v_period_end timestamptz:=date_trunc('day',now())+interval '25 days';
  v_next_start timestamptz:=date_trunc('day',now())+interval '26 days';
  v_next_end timestamptz:=date_trunc('day',now())+interval '56 days';
  v_grant uuid;
  v_base_used integer;
  v_replay_grants integer;
  v_replay_accruals integer;
  v_dashboard jsonb;
  v_reservation uuid;
  v_index integer;
  v_denied boolean:=false;
begin
  insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at)
  values(v_creator_user,'authenticated','authenticated','repair-creator-'||v_creator_user||'@example.invalid',now(),now(),now());
  v_creator:=public.provision_creator(v_creator_user,'Repair Creator',v_code,1500,v_creator_user);
  perform public.set_referral_program_settings(true,true,v_creator_user);
  perform public.issue_creator_code_visit(v_code,v_token_hash,'production');
  insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at)
  values(v_referred_user,'authenticated','authenticated','repair-user-'||v_referred_user||'@example.invalid',now(),now(),now());
  perform public.claim_referral_visit(v_token_hash,v_referred_user,'creator_code');

  -- First delivery is missing period and currency fields. A later complete
  -- replay must finish the same reward rather than consuming it forever.
  v_transaction:=public.project_revenuecat_transaction(
    'repair-incomplete-'||v_referred_user,v_referred_user,encode(extensions.digest(v_referred_user::text,'sha256'),'hex'),
    'INITIAL_PURCHASE','app_store','PRODUCTION','repair-tx-'||v_referred_user,'repair-original-'||v_referred_user,
    'formie_monthly',now(),null,null,9.99,null,'US',0,0.15,null,null
  );
  perform public.project_revenuecat_transaction(
    'repair-complete-'||v_referred_user,v_referred_user,encode(extensions.digest(v_referred_user::text,'sha256'),'hex'),
    'INITIAL_PURCHASE','app_store','PRODUCTION','repair-tx-'||v_referred_user,'repair-original-'||v_referred_user,
    'formie_monthly',now(),v_period_start,v_period_end,9.99,'USD','US',0,0.15,null,null
  );
  select count(*) into v_replay_grants from public.referral_bonus_grants where user_id=v_referred_user;
  select count(*) into v_replay_accruals from public.creator_commission_entries where referred_user_id=v_referred_user and entry_type='accrual';
  perform set_config('request.jwt.claim.sub',v_creator_user::text,true);
  v_dashboard:=public.get_creator_dashboard_v5('custom',current_date-30,current_date,50,0);
  if (v_dashboard#>>'{metrics,accounts,value}')::integer<>1 or (v_dashboard#>>'{metrics,paid,value}')::integer<>1
    or (v_dashboard#>>'{metrics,bonusRecipients,value}')::integer<>1 then raise exception 'CREATOR_METRICS_INCORRECT'; end if;
  for v_index in 1..4 loop
    v_dashboard:=public.get_founder_business_dashboard_v10((array['overview','revenue','creators','growth'])[v_index],'custom',current_date-30,current_date);
    if not exists(select 1 from jsonb_array_elements(v_dashboard->'creators') row where row->>'id'=v_creator::text and (row->>'accounts')::integer=1) then raise exception 'FOUNDER_CREATOR_MISSING'; end if;
  end loop;
  perform set_config('request.jwt.claim.sub',v_referred_user::text,true);
  begin
    perform public.get_creator_dashboard_v5('30d',null,null,50,0);
  exception when others then
    if sqlerrm='CREATOR_ACCESS_REQUIRED' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'NON_CREATOR_PORTAL_ACCESS'; end if;
  insert into public.user_access_entitlements(user_id,status,entitlement_id,revenuecat_app_user_id,store_product_id,current_period_start,current_period_end,last_reconciled_at,last_customer_info)
  values(v_referred_user,'active','formie_pro',v_referred_user::text,'formie_monthly',v_period_start,v_period_end,now(),'{}');
  update public.user_access_entitlements set lifecycle_state='active_renewing',plan_code='monthly',store='app_store',sandbox=false,will_renew=true,billing_period_start=v_period_start,billing_period_end=v_period_end where user_id=v_referred_user;
  for v_index in 1..13 loop
    select reservation_id into v_reservation from public.reserve_analysis_credit_for_user(v_referred_user,'full-flow-'||v_index,'analysis',null);
    update public.analysis_credit_reservations set status='committed',committed_at=now() where id=v_reservation;
    update public.analysis_attempts set status='complete',terminal_at=now(),updated_at=now() where reservation_id=v_reservation;
  end loop;
  if (select count(*) from public.analysis_credit_reservations where user_id=v_referred_user and funding_source='base')<>10
    or (select count(*) from public.analysis_credit_reservations where user_id=v_referred_user and funding_source='referral_bonus')<>3 then raise exception 'TEN_PLUS_THREE_FUNDING_FAILED'; end if;
  v_denied:=false;
  begin
    perform public.reserve_analysis_credit_for_user(v_referred_user,'full-flow-14','analysis',null);
  exception when others then
    if position('ANALYSIS_QUOTA_EXCEEDED' in sqlerrm)>0 then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'FOURTEENTH_ANALYSIS_ALLOWED'; end if;

  v_unknown:=public.project_revenuecat_transaction(
    'repair-unknown-net',null,repeat('a',64),'INITIAL_PURCHASE','app_store','PRODUCTION',
    'repair-unknown-tx','repair-unknown-original','formie_monthly',now(),now(),now()+interval '1 month',
    9.99,'USD','US',null,null,null,null
  );

  select id into v_grant from public.referral_bonus_grants where user_id=v_referred_user;
  if v_grant is null then
    insert into public.referral_bonus_grants(user_id,qualifying_transaction_id,period_start,period_end)
    values(v_referred_user,v_transaction,v_period_start,v_period_end) returning id into v_grant;
  end if;
  insert into public.user_access_entitlements(user_id,status,entitlement_id,revenuecat_app_user_id,store_product_id,current_period_start,current_period_end,last_reconciled_at,last_customer_info)
  values(v_referred_user,'active','formie_pro',v_referred_user::text,'formie_monthly',v_next_start,v_next_end,now(),'{}')
  on conflict(user_id) do update set status='active',current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,billing_period_start=excluded.current_period_start,billing_period_end=excluded.current_period_end;
  insert into public.analysis_credit_reservations(user_id,client_request_id,kind,status,period_start,period_end,funding_source,committed_at)
  values
    (v_referred_user,'repair-old-base','analysis','committed',v_period_start,v_period_end,'base',v_period_start+interval '1 day'),
    (v_referred_user,'repair-current-base','analysis','committed',v_next_start,v_next_end,'base',v_next_start+interval '1 day');

  perform public.project_revenuecat_transaction(
    'repair-refund-'||v_referred_user,v_referred_user,encode(extensions.digest(v_referred_user::text,'sha256'),'hex'),
    'CANCELLATION','app_store','PRODUCTION','repair-tx-'||v_referred_user,'repair-original-'||v_referred_user,
    'formie_monthly',v_period_start,v_period_start,v_period_end,9.99,'USD','US',0,0.15,now(),null
  );
  select base_used into v_base_used from public.get_referral_bonus_access_for_user(v_referred_user);

  insert into creator_repair_results
  select v_creator,v_referred_user,v_transaction,v_replay_grants,v_replay_accruals,
    (select estimated_net_proceeds from public.subscription_transactions where id=v_unknown),
    (select state from public.referral_bonus_grants where id=v_grant),v_base_used;
end $$;

do $$
declare v creator_repair_results%rowtype;
begin
  select * into v from creator_repair_results;
  if v.grant_count<>1 then raise exception 'LATE_REPLAY_GRANT_FAILED: expected 1, got %',v.grant_count; end if;
  if v.accrual_count<>1 then raise exception 'LATE_REPLAY_ACCRUAL_FAILED: expected 1, got %',v.accrual_count; end if;
  if v.unknown_net is not null then raise exception 'UNKNOWN_NET_FAILED: expected null, got %',v.unknown_net; end if;
  if v.refund_grant_state<>'active' then raise exception 'REFUND_ACCESS_FAILED: expected active, got %',v.refund_grant_state; end if;
  if v.renewed_base_used<>1 then raise exception 'RENEWAL_USAGE_FAILED: expected 1, got %',v.renewed_base_used; end if;
end $$;
rollback;
