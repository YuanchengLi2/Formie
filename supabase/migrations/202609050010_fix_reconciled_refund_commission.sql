-- A refund must reverse the commission actually owed after reconciliation,
-- rather than the earlier estimated accrual. A reversal restores that exact
-- adjustment amount.
do $$
declare
  v_definition text;
  v_search text;
  v_replacement text;
begin
  select pg_get_functiondef('public.project_revenuecat_transaction(text,uuid,text,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,numeric,text,text,numeric,numeric,timestamptz,timestamptz)'::regprocedure) into v_definition;
  v_search:='select creator_id,referred_user_id,transaction_id,''refund_adjustment'',-amount,currency,commission_basis_points,now()
    from public.creator_commission_entries where transaction_id=v_transaction and entry_type=''accrual''';
  v_replacement:='select accrual.creator_id,accrual.referred_user_id,accrual.transaction_id,''refund_adjustment'',
      -(accrual.amount+coalesce((select sum(adjustment.amount) from public.creator_commission_entries adjustment where adjustment.transaction_id=v_transaction and adjustment.entry_type=''reconciliation_adjustment''),0)),
      accrual.currency,accrual.commission_basis_points,now()
    from public.creator_commission_entries accrual where accrual.transaction_id=v_transaction and accrual.entry_type=''accrual''';
  if strpos(v_definition,v_search)=0 then raise exception 'REFUND_COMMISSION_DEFINITION_NOT_RECOGNIZED'; end if;
  v_definition:=replace(v_definition,v_search,v_replacement);
  v_search:='select creator_id,referred_user_id,transaction_id,''refund_reversal'',amount,currency,commission_basis_points,now()
    from public.creator_commission_entries where transaction_id=v_transaction and entry_type=''accrual''';
  v_replacement:='select adjustment.creator_id,adjustment.referred_user_id,adjustment.transaction_id,''refund_reversal'',-adjustment.amount,
      adjustment.currency,adjustment.commission_basis_points,now()
    from public.creator_commission_entries adjustment where adjustment.transaction_id=v_transaction and adjustment.entry_type=''refund_adjustment''';
  if strpos(v_definition,v_search)=0 then raise exception 'REFUND_REVERSAL_DEFINITION_NOT_RECOGNIZED'; end if;
  execute replace(v_definition,v_search,v_replacement);
end $$;
