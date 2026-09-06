begin;
select plan(19);
select has_table('public','subscription_transactions','normalized transaction ledger exists');
select has_table('public','subscription_reward_redemptions','minimal restored-receipt redemption evidence exists');
select has_table('public','apple_financial_imports','versioned Apple report imports exist');
select has_table('public','apple_financial_lines','immutable Apple report lines exist');
select has_table('public','transaction_reconciliation_allocations','explicit proceeds allocations exist');
select has_table('public','creator_commission_entries','commission ledger exists');
select has_table('public','creator_payouts','payout batches exist');
select has_table('public','creator_payout_items','payout items lock ledger entries');
select col_is_unique('public','subscription_transactions',array['store','environment','transaction_id'],'provider transactions are deduplicated');
select ok(
  exists(select 1 from pg_indexes where schemaname='public' and tablename='subscription_reward_redemptions' and indexdef like 'CREATE UNIQUE INDEX% (store, environment, original_transaction_id)'),
  'restores and account transfers cannot create another reward'
);
select ok(
  (select count(*) from pg_indexes where schemaname='public' and tablename='creator_commission_entries' and indexname in (
    'creator_commission_accrual_once_idx','creator_commission_refund_once_idx','creator_commission_refund_reversal_once_idx'
  ))=3,
  'one accrual, refund adjustment, and refund reversal exists per qualifying transaction'
);
select has_function('public','reconcile_apple_financial_import',array['uuid','uuid'],'Apple reconciliation exists');
select has_function('public','prepare_creator_payout',array['uuid','text','uuid'],'payout preparation exists');
select has_function('public','mark_creator_payout_paid',array['uuid','timestamp with time zone','text','uuid'],'explicit paid confirmation exists');
select like(pg_get_functiondef('public.project_revenuecat_transaction(text,uuid,text,text,text,text,text,text,text,timestamp with time zone,timestamp with time zone,timestamp with time zone,numeric,text,text,numeric,numeric,timestamp with time zone,timestamp with time zone)'::regprocedure),'%p_environment<>''PRODUCTION''%','sandbox transactions cannot earn acquisition rewards');
select like(pg_get_functiondef('public.prepare_creator_payout(uuid,text,uuid)'::regprocedure),'%hold_until<=now()%','payouts enforce the 30-day hold');
select like(pg_get_functiondef('public.mark_creator_payout_paid(uuid,timestamp with time zone,text,uuid)'::regprocedure),'%PAYMENT_REFERENCE_REQUIRED%','mark paid requires an external reference');
select like(pg_get_functiondef('public.project_revenuecat_transaction(text,uuid,text,text,text,text,text,text,text,timestamp with time zone,timestamp with time zone,timestamp with time zone,numeric,text,text,numeric,numeric,timestamp with time zone,timestamp with time zone)'::regprocedure),'%entry_type%''reconciliation_adjustment''%','refunds include reconciled commission adjustments');
select like(pg_get_functiondef('public.project_revenuecat_transaction(text,uuid,text,text,text,text,text,text,text,timestamp with time zone,timestamp with time zone,timestamp with time zone,numeric,text,text,numeric,numeric,timestamp with time zone,timestamp with time zone)'::regprocedure),'%entry_type%''refund_adjustment''%','refund reversals restore the exact refund adjustment');
select * from finish();
rollback;
