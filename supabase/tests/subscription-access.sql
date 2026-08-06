begin;

select plan(10);

select has_table('public', 'user_access_entitlements', 'entitlement ledger exists');
select has_table('public', 'analysis_credit_reservations', 'reservation ledger exists');
select has_function('public', 'get_my_access_status', ARRAY[]::text[], 'access status RPC exists');
select has_function('public', 'reserve_analysis_session_v2', ARRAY['text', 'uuid']::text[], 'new analysis reservation RPC exists');
select has_function('public', 'reserve_reanalysis_v2', ARRAY['text', 'uuid']::text[], 'reanalysis reservation RPC exists');
select has_function('public', 'reserve_analysis_credit_for_user', ARRAY['uuid', 'text', 'text', 'uuid']::text[], 'service reservation RPC exists');
select has_function('public', 'cancel_analysis_reservation', ARRAY['uuid']::text[], 'reservation cancellation RPC exists');
select has_function('public', 'record_product_analytics', ARRAY['text', 'jsonb']::text[], 'analytics RPC exists');
select triggers_are('public', 'analysis_sessions', ARRAY['commit_analysis_credit_after_session']::text[], 'successful result trigger exists');
select like(pg_get_functiondef('public.commit_analysis_credit_for_session()'::regprocedure), '%new.status in (''failed'', ''unable'')%', 'failed or unable analyses release their reservation');

select * from finish();
rollback;
