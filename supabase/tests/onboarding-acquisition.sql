begin;

select plan(5);

select has_table('public', 'onboarding_acquisition_responses', 'acquisition response ledger exists');
select has_function('public', 'record_onboarding_acquisition', ARRAY['text', 'text', 'text', 'text']::text[], 'authenticated acquisition RPC exists');
select has_function('public', 'claim_onboarding_acquisition_sheet_rows', ARRAY['integer']::text[], 'sheet export claim RPC exists');
select has_view('public', 'onboarding_acquisition_summary', 'aggregate acquisition view exists');
select col_is_unique('public', 'onboarding_acquisition_responses', 'user_id', 'one immutable acquisition response is stored per account');

select * from finish();
rollback;
