-- Give the temporary acceptance account the same authoritative lifecycle
-- fields that RevenueCat reconciliation writes for a production entitlement.
do $$
declare
  v_definition text;
  v_search text;
  v_replacement text;
begin
  select pg_get_functiondef('public.run_creator_program_live_acceptance()'::regprocedure) into v_definition;
  v_search:='insert into public.user_access_entitlements(user_id,status,entitlement_id,revenuecat_app_user_id,store_product_id,current_period_start,current_period_end,last_reconciled_at,last_customer_info)';
  v_replacement:='insert into public.user_access_entitlements(user_id,status,lifecycle_state,entitlement_id,revenuecat_app_user_id,store_product_id,plan_code,store,sandbox,will_renew,current_period_start,current_period_end,billing_period_start,billing_period_end,last_reconciled_at,last_customer_info)';
  if strpos(v_definition,v_search)=0 then raise exception 'ACCEPTANCE_ENTITLEMENT_COLUMNS_NOT_RECOGNIZED'; end if;
  v_definition:=replace(v_definition,v_search,v_replacement);
  v_search:='values(v_referred_user,''active'',''acceptance'',''acceptance-''||v_referred_user,''formie_monthly'',v_bonus.period_start,v_bonus.period_end,now(),''{}''::jsonb)';
  v_replacement:='values(v_referred_user,''active'',''active_renewing'',''acceptance'',''acceptance-''||v_referred_user,''formie_monthly'',''monthly'',''app_store'',false,true,v_bonus.period_start,v_bonus.period_end,v_bonus.period_start,v_bonus.period_end,now(),''{}''::jsonb)';
  if strpos(v_definition,v_search)=0 then raise exception 'ACCEPTANCE_ENTITLEMENT_VALUES_NOT_RECOGNIZED'; end if;
  v_definition:=replace(v_definition,v_search,v_replacement);
  v_search:='on conflict(user_id) do update set status=''active'',current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,updated_at=now();';
  v_replacement:='on conflict(user_id) do update set status=''active'',lifecycle_state=''active_renewing'',plan_code=''monthly'',store=''app_store'',sandbox=false,will_renew=true,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,billing_period_start=excluded.billing_period_start,billing_period_end=excluded.billing_period_end,updated_at=now();';
  if strpos(v_definition,v_search)=0 then raise exception 'ACCEPTANCE_ENTITLEMENT_UPSERT_NOT_RECOGNIZED'; end if;
  execute replace(v_definition,v_search,v_replacement);
end $$;
