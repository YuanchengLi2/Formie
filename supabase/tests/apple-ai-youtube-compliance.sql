begin;

select plan(20);

select has_table('public', 'ai_processing_notice_versions', 'approved AI notice registry exists');
select has_table('public', 'user_consents', 'versioned AI consent history exists');
select has_function('public', 'record_ai_processing_consent', ARRAY['text', 'text']::text[], 'authenticated consent acceptance RPC exists');
select has_function('public', 'revoke_ai_processing_consent', ARRAY['text']::text[], 'authenticated consent withdrawal RPC exists');
select has_function('public', 'current_ai_processing_consent', ARRAY[]::text[], 'current consent status RPC exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.ai_processing_notice_versions'::regclass),
  'approved AI notice registry has RLS enabled'
);

select ok(
  exists (
    select 1
    from public.ai_processing_notice_versions
    where version = '2026-09-01'
      and notice_sha256 = '739cb7347c35cdf9e4bfec5588113dde724eff88d0b28b215745549dd9a2be20'
      and active
  ),
  'only the source-controlled 1.0 AI notice pair is active'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_consents'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%(version, notice_sha256)%'
  ),
  'consent rows must reference an approved notice version and hash pair'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_consents'::regclass),
  'AI consent history has RLS enabled'
);

select is(
  (select count(*)::integer
   from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name = 'user_consents'
     and grantee in ('anon', 'authenticated')),
  0,
  'clients have no direct AI consent table grants'
);

select ok(
  (select pg_get_constraintdef(oid) ~ 'age_years >= 18.*age_years <= 100'
   from pg_constraint
   where conrelid = 'public.user_profiles'::regclass
     and conname = 'user_profiles_age_years_adult_check'),
  'new profile writes enforce ages 18 through 100'
);

select has_table('public', 'apple_authorizations', 'encrypted Apple token custody exists');
select has_function('public', 'resolve_apple_identity_user_id', ARRAY['text']::text[], 'legacy Apple identities can be resolved for server account-deletion events');
select has_table('public', 'external_deletion_jobs', 'durable external deletion queue exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.external_deletion_jobs'::regclass),
  'external deletion queue has RLS enabled'
);

select has_function('public', 'claim_external_deletion_jobs', ARRAY['integer']::text[], 'service worker claim RPC exists');

select has_table('public', 'youtube_tutorial_cache', 'global YouTube tutorial cache exists');
select hasnt_column('public', 'youtube_tutorial_cache', 'user_id', 'YouTube cache is not linked to Formie users');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.youtube_tutorial_cache'::regclass)
  and exists (
    select 1
    from pg_constraint
    where conrelid = 'public.youtube_tutorial_cache'::regclass
      and pg_get_constraintdef(oid) like '%30 days%'
  ),
  'YouTube cache is service-role-only and bounded to 30 days'
);

select ok(
  exists (
    select 1
    from cron.job
    where jobname = 'form-youtube-tutorial-cache-expiry'
      and command like '%delete from public.youtube_tutorial_cache where expires_at <= now()%'
  ),
  'expired YouTube metadata is deleted independently of user traffic'
);

select * from finish();
rollback;
