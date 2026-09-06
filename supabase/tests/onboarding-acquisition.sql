begin;

select plan(6);

select has_table('public', 'onboarding_acquisition_responses', 'acquisition response ledger exists');
select has_function('public', 'record_onboarding_acquisition', ARRAY['text', 'text', 'text', 'text']::text[], 'authenticated acquisition RPC exists');
select hasnt_function('public', 'claim_onboarding_acquisition_sheet_rows', ARRAY['integer']::text[], 'sheet export claim RPC is retired');
select has_view('public', 'onboarding_acquisition_summary', 'aggregate acquisition view exists');
select col_is_unique('public', 'onboarding_acquisition_responses', 'user_id', 'one immutable acquisition response is stored per account');
select like(pg_get_functiondef('public.finalize_onboarding_with_referral(uuid,jsonb,jsonb,text,text)'::regprocedure),'%affiliated_creator%','creator-code acquisition is accepted only by atomic onboarding finalization');

select * from finish();
rollback;
