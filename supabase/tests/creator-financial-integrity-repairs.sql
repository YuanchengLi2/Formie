begin;

do $$
declare
  v_actor uuid:=gen_random_uuid();
  v_transaction uuid:=gen_random_uuid();
  v_transaction2 uuid:=gen_random_uuid();
  v_result jsonb;
  v_import uuid;
  v_status text;
begin
  insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at)
  values(v_actor,'authenticated','authenticated','financial-repair-'||v_actor||'@example.invalid',now(),now(),now());
  insert into public.subscription_transactions(
    id,provider_event_id,account_fingerprint,store,environment,transaction_id,original_transaction_id,
    product_identifier,event_type,purchased_at,period_start,period_end,gross_amount,currency,storefront_country,
    estimated_tax_percentage,estimated_commission_percentage,estimated_net_proceeds
  ) values(
    v_transaction,'financial-repair-event',repeat('b',64),'app_store','PRODUCTION','financial-repair-tx',
    'financial-repair-original','formie_monthly','INITIAL_PURCHASE',date_trunc('day',now()),
    date_trunc('day',now()),date_trunc('day',now())+interval '1 month',9.99,'USD','US',0,0.15,8.4915
  );
  v_result:=public.import_and_reconcile_apple_financial_report(
    encode(extensions.digest('financial-repair-report','sha256'),'hex'),'financial-repair.tsv','repair/report.tsv',
    current_date-1,current_date+1,'USD',jsonb_build_array(
      jsonb_build_object(
        'line_number',1,'transaction_date',current_date,'settlement_date',current_date,
        'sku','formie_monthly','product_type_identifier','1AY','country_of_sale','US','quantity',1,
        'sale_or_return','S','partner_share',6.99,'extended_partner_share',6.99,
        'partner_share_currency','USD','customer_price',9.99,'customer_currency','USD'
      ),
      jsonb_build_object(
        'line_number',2,'transaction_date',current_date,'settlement_date',current_date,
        'sku','formie_monthly','product_type_identifier','1AY','country_of_sale','CA','quantity',1,
        'sale_or_return','S','partner_share',6.99,'extended_partner_share',6.99,
        'partner_share_currency','USD','customer_price',9.99,'customer_currency','USD'
      )
    ),v_actor
  );
  v_import:=(v_result->>'importId')::uuid;
  select financial_status into v_status from public.subscription_transactions where id=v_transaction;
  if v_status<>'estimated' then
    raise exception 'PARTIAL_IMPORT_FINALIZED_TRANSACTION: import %, status %',v_import,v_status;
  end if;

  insert into public.subscription_transactions(
    id,provider_event_id,account_fingerprint,store,environment,transaction_id,original_transaction_id,
    product_identifier,event_type,purchased_at,period_start,period_end,gross_amount,currency,storefront_country,
    estimated_tax_percentage,estimated_commission_percentage,estimated_net_proceeds
  ) values(
    v_transaction2,'financial-approval-event',repeat('c',64),'app_store','PRODUCTION','financial-approval-tx',
    'financial-approval-original','formie_approval_monthly','INITIAL_PURCHASE',date_trunc('day',now()),
    date_trunc('day',now()),date_trunc('day',now())+interval '1 month',9.99,'USD','GB',0,0.15,8.4915
  );
  v_result:=public.import_and_reconcile_apple_financial_report(
    encode(extensions.digest('financial-approval-report','sha256'),'hex'),'financial-approval.tsv','repair/approval.tsv',
    current_date-1,current_date+1,'USD',jsonb_build_array(jsonb_build_object(
      'line_number',1,'transaction_date',current_date,'settlement_date',current_date,
      'sku','formie_approval_monthly','product_type_identifier','1AY','country_of_sale','GB','quantity',1,
      'sale_or_return','S','partner_share',6.99,'extended_partner_share',6.99,
      'partner_share_currency','USD','customer_price',9.99,'customer_currency','USD'
    )),v_actor
  );
  v_import:=(v_result->>'importId')::uuid;
  perform public.approve_apple_financial_import(v_import,v_actor);
  select financial_status into v_status from public.subscription_transactions where id=v_transaction2;
  if v_status<>'final' then raise exception 'APPROVED_IMPORT_NOT_FINAL: expected final, got %',v_status; end if;
  if not exists(select 1 from public.transaction_reconciliation_allocations where import_id=v_import and transaction_id=v_transaction2 and active) then
    raise exception 'APPROVED_IMPORT_ALLOCATION_NOT_ACTIVE';
  end if;
end $$;

rollback;
