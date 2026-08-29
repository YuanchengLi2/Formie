begin;
select plan(5);

select is(
  (select confdeltype::text
   from pg_constraint
   where conrelid = 'public.product_analytics_events'::regclass
     and conname = 'product_analytics_events_user_id_fkey'),
  'c',
  'product analytics cascade when an auth user is deleted'
);

select is(
  (select confdeltype::text from pg_constraint where conrelid='public.analytics_identity_links'::regclass and confrelid='auth.users'::regclass),
  'c',
  'anonymous identity links cascade with account deletion'
);

select is(
  (select count(*)::integer from information_schema.role_table_grants where table_schema='public' and table_name in ('product_analytics_events','analytics_identity_links','analytics_ingestion_limits') and grantee in ('anon','authenticated')),
  0,
  'mobile roles have no raw analytics table privileges'
);

select is(
  (select count(*)::integer
   from pg_constraint
   where contype = 'f'
     and confrelid = 'auth.users'::regclass
     and connamespace = 'public'::regnamespace
     and confdeltype <> 'c'),
  0,
  'all public foreign keys to auth users cascade'
);

select is(
  (select count(*)::integer
   from storage.buckets
   where id in ('analysis-videos', 'analysis-artifacts') and public = false),
  2,
  'both account-owned storage buckets are private'
);

select * from finish();
rollback;
