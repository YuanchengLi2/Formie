begin;
select plan(21);
select has_table('public','creators','creator ledger exists');
select has_table('public','creator_memberships','creator portal membership exists');
select has_table('public','creator_rate_versions','immutable commission rate history exists');
select has_table('public','creator_links','permanent creator links exist');
select has_table('public','referral_visits','first-party visits exist');
select has_table('public','account_referrals','locked account attribution exists');
select has_table('public','referral_program_settings','server-owned rollout settings exist');
select col_is_unique('public','referral_visits','token_hash','a visit token hash cannot be replayed as another visit');
select ok(
  exists(
    select 1
    from pg_indexes
    where schemaname='public'
      and tablename='account_referrals'
      and indexdef like 'CREATE UNIQUE INDEX% (user_id)'
  ),
  'an account can have one creator attribution'
);
select has_column('public','account_referrals','reward_eligible','reward eligibility is locked with attribution');
select has_function('public','issue_creator_referral_visit',array['text','text','text','timestamp with time zone'],'service visit issuance exists');
select has_function('public','issue_creator_code_visit',array['text','text','text'],'server-side creator code validation exists');
select has_function('public','preview_referral_visit',array['text'],'server preview exists');
select has_function('public','claim_referral_visit',array['text','uuid','text'],'atomic account claim exists');
select like(pg_get_functiondef('public.claim_referral_visit(text,uuid,text)'::regprocedure),'%rate.creator_id%v_creator.id%','claim rate lookup qualifies the creator column');
select like(pg_get_functiondef('public.claim_referral_visit(text,uuid,text)'::regprocedure),'%REFERRAL_AFTER_ACCOUNT_CREATION%','claims require a visit issued before account creation');
select like(pg_get_functiondef('public.claim_referral_visit(text,uuid,text)'::regprocedure),'%REFERRAL_ACCOUNT_INELIGIBLE%','claim retry is bounded after account creation');
select like(pg_get_functiondef('public.claim_referral_visit(text,uuid,text)'::regprocedure),'%creator_code%','creator-code claims use the immutable attribution path');
select like(pg_get_functiondef('public.issue_creator_code_visit(text,text,text)'::regprocedure),'%recovered_at%','successful code validation is observed immediately');
select like(pg_get_functiondef('public.issue_creator_referral_visit(text,text,text,timestamp with time zone)'::regprocedure),'%status%''active''%','paused links cannot issue new visits');
select like(pg_get_functiondef('public.issue_creator_referral_visit(text,text,text,timestamp with time zone)'::regprocedure),'%REFERRAL_ISSUANCE_DISABLED%','server rollout can stop issuing visits');
select * from finish();
rollback;
