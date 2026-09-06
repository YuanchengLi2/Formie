begin;
select plan(33);
select has_table('public','business_daily_metrics','bounded trend aggregates exist');
select has_table('public','reporting_coverage','source observation coverage exists');
select has_table('public','business_test_accounts','test identities can be excluded explicitly');
select has_function('public','business_metric',array['numeric','text','text','text','text','numeric','numeric','timestamp with time zone','text'],'metric envelope constructor exists');
select has_function('public','business_suppress_small_groups',array['jsonb'],'privacy suppression exists');
select has_function('public','get_founder_business_dashboard',array['text','text','date','date'],'founder section reporting exists');
select has_function('public','get_founder_business_dashboard_v2',array['text','text','date','date'],'currency-safe founder reporting exists');
select has_function('public','get_founder_business_dashboard_v3',array['text','text','date','date'],'complete founder trend reporting exists');
select has_function('public','get_founder_business_dashboard_v4',array['text','text','date','date'],'bounded founder list reporting exists');
select has_function('public','get_founder_creator_detail_v1',array['uuid','text','integer','integer'],'paginated founder creator detail exists');
select has_function('public','get_founder_business_dashboard_v5',array['text','text','date','date'],'complete founder revenue reporting exists');
select has_function('public','get_creator_dashboard_v1',array['text'],'creator scoped reporting exists');
select has_function('public','run_business_reporting_maintenance',array[]::text[],'scheduled reporting maintenance exists');
select like(pg_get_functiondef('public.run_business_reporting_maintenance()'::regprocedure),'%release_stale_analysis_credit_reservations%','maintenance calls the deployed reservation cleanup');
select like(pg_get_functiondef('public.get_founder_business_dashboard(text,text,date,date)'::regprocedure),'%p_end-p_start>366%','custom ranges are bounded');
select like(pg_get_functiondef('public.get_founder_business_dashboard(text,text,date,date)'::regprocedure),'%interval ''31 days''%','D30 excludes immature cohorts');
select like(pg_get_functiondef('public.get_founder_business_dashboard_v2(text,text,date,date)'::regprocedure),'%v_usd_tx<v_all_tx%','mixed native currencies make USD cards incomplete');
select like(pg_get_functiondef('public.get_founder_business_dashboard_v2(text,text,date,date)'::regprocedure),'%latest.currency=''USD''%','per-subscriber USD metrics use a USD subscriber denominator');
select like(pg_get_functiondef('public.get_founder_business_dashboard(text,text,date,date)'::regprocedure),'%onboarding_cta_pressed%','onboarding transitions use the ingested CTA event');
select unlike(pg_get_functiondef('public.get_founder_business_dashboard(text,text,date,date)'::regprocedure),'%onboarding_cta_tapped%','reporting does not query the obsolete CTA event');
select like(pg_get_functiondef('public.refresh_business_daily_metrics(date)'::regprocedure),'%''active_paid''%','daily reporting records active paid subscribers');
select like(pg_get_functiondef('public.get_founder_business_dashboard_v3(text,text,date,date)'::regprocedure),'%''activePaid''%','founder trends expose active paid subscribers');
select like(pg_get_functiondef('public.get_founder_creator_detail_v1(uuid,text,integer,integer)'::regprocedure),'%limit p_limit offset p_offset%','founder creator referrals are paginated');
select like(pg_get_functiondef('public.get_founder_business_dashboard_v4(text,text,date,date)'::regprocedure),'%item%''referrals''%''payouts''%','founder creator list omits detail arrays');
select like(pg_get_functiondef('public.get_founder_business_dashboard_v5(text,text,date,date)'::regprocedure),'%newSubscriptionRevenue%','reporting exposes first-payment revenue');
select like(pg_get_functiondef('public.get_founder_business_dashboard_v5(text,text,date,date)'::regprocedure),'%storeDeductions%','reporting exposes combined store deductions');
select like(pg_get_functiondef('public.get_founder_business_dashboard_v5(text,text,date,date)'::regprocedure),'%refundCommissionAdjustments%','reporting exposes refund adjustments');
select like(pg_get_functiondef('public.get_founder_business_dashboard_v5(text,text,date,date)'::regprocedure),'%refundReversalAdjustments%','reporting exposes refund reversals');
select like(pg_get_functiondef('public.business_suppress_small_groups(jsonb)'::regprocedure),'%v_row.users<5%','groups under five are suppressed');
select like(pg_get_functiondef('public.get_creator_dashboard_v2(text,integer,integer)'::regprocedure),'%creator_memberships%auth.uid()%','creator reports derive tenant from authenticated membership');
select ok(
  pg_get_functiondef('public.get_creator_dashboard_v2(text,integer,integer)'::regprocedure) like '%business_metric%'
    and pg_get_functiondef('public.get_creator_dashboard_v2(text,integer,integer)'::regprocedure) like '%INVALID_PAGINATION%',
  'creator metrics use envelopes and referral details are bounded'
);
select like(pg_get_functiondef('public.get_creator_dashboard_v2(text,integer,integer)'::regprocedure),'%extensions.digest%','creator pseudonyms use the installed pgcrypto schema');
select has_function('public','get_creator_dashboard_v3',array['text','integer','integer'],'creator dashboard returns the creator-code contract');
select * from finish();
rollback;
