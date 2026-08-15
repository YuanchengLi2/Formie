begin;
select plan(3);

select is(
  (select confdeltype::text
   from pg_constraint
   where conrelid = 'public.product_analytics_events'::regclass
     and conname = 'product_analytics_events_user_id_fkey'),
  'c',
  'product analytics cascade when an auth user is deleted'
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
