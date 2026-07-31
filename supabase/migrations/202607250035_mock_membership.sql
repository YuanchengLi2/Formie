create table public.user_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'paid')),
  mock_upgraded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (tier = 'free' and mock_upgraded_at is null)
    or
    (tier = 'paid' and mock_upgraded_at is not null)
  )
);

alter table public.user_memberships enable row level security;

create policy "Users can read own membership"
on public.user_memberships for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on public.user_memberships to authenticated;

update public.user_profiles
set
  onboarding_step = 'complete',
  onboarding_completed = true,
  onboarding_completed_at = coalesce(onboarding_completed_at, now())
where onboarding_completed = false;

alter table public.user_profiles alter column onboarding_step set default 'complete';
alter table public.user_profiles alter column onboarding_completed set default true;
alter table public.user_profiles alter column onboarding_completed_at set default now();

create or replace function public.reserve_analysis_session(
  requested_user_id uuid,
  requested_previous_session_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership_tier text;
  delivered_count integer;
  active_count integer;
  reserved_session_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(requested_user_id::text, 0));

  select membership.tier
  into membership_tier
  from public.user_memberships membership
  where membership.user_id = requested_user_id;

  membership_tier := coalesce(membership_tier, 'free');

  if membership_tier = 'free' then
    select count(*)::integer
    into delivered_count
    from public.analysis_sessions session
    where session.user_id = requested_user_id
      and session.status in ('complete', 'partial');

    select count(*)::integer
    into active_count
    from public.analysis_sessions session
    where session.user_id = requested_user_id
      and (
        session.status in ('queued', 'processing')
        or (
          session.status = 'uploading'
          and session.created_at >= now() - interval '30 minutes'
        )
      );

    if delivered_count + active_count >= 3 then
      raise exception using
        errcode = 'P0001',
        message = 'FREE_ANALYSIS_LIMIT_REACHED';
    end if;
  end if;

  insert into public.analysis_sessions (
    user_id,
    previous_session_id,
    status
  )
  values (
    requested_user_id,
    requested_previous_session_id,
    'uploading'
  )
  returning id into reserved_session_id;

  return reserved_session_id;
end;
$$;

revoke all on function public.reserve_analysis_session(uuid, uuid) from public;
revoke all on function public.reserve_analysis_session(uuid, uuid) from anon;
revoke all on function public.reserve_analysis_session(uuid, uuid) from authenticated;
grant execute on function public.reserve_analysis_session(uuid, uuid) to service_role;
