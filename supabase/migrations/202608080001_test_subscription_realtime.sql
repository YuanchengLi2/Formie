-- Website Test Store controls change this table and the app must observe those
-- changes while it is open. Keep writes service-controlled, but allow each
-- authenticated user to receive only their own scenario through Realtime.

alter table public.subscription_test_scenarios enable row level security;

drop policy if exists "Users can read their own Test Store scenario" on public.subscription_test_scenarios;
create policy "Users can read their own Test Store scenario"
on public.subscription_test_scenarios
for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on public.subscription_test_scenarios to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'subscription_test_scenarios'
  ) then
    alter publication supabase_realtime add table public.subscription_test_scenarios;
  end if;
end;
$$;
