create table if not exists public.onboarding_acquisition_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  source text not null check (source in ('tiktok', 'instagram', 'youtube', 'app_store_search', 'google_search', 'friend_trainer_coach', 'other')),
  other_detail text,
  platform text not null check (platform in ('ios', 'android', 'web', 'unknown')),
  onboarding_version text not null,
  created_at timestamptz not null default now(),
  sheet_sync_status text not null default 'pending' check (sheet_sync_status in ('pending', 'syncing', 'synced')),
  sheet_sync_attempts integer not null default 0 check (sheet_sync_attempts >= 0),
  sheet_sync_started_at timestamptz,
  sheet_synced_at timestamptz,
  sheet_last_error text,
  constraint onboarding_acquisition_other_detail_check check (
    (source = 'other' and char_length(btrim(coalesce(other_detail, ''))) between 1 and 80)
    or (source <> 'other' and other_detail is null)
  )
);

alter table public.onboarding_acquisition_responses enable row level security;
revoke all on public.onboarding_acquisition_responses from anon, authenticated;

create or replace function public.record_onboarding_acquisition(
  p_source text,
  p_other_detail text,
  p_platform text,
  p_onboarding_version text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_response_id uuid;
  v_other_detail text := nullif(btrim(p_other_detail), '');
begin
  if v_user_id is null then raise exception 'UNAUTHORIZED'; end if;
  if p_source not in ('tiktok', 'instagram', 'youtube', 'app_store_search', 'google_search', 'friend_trainer_coach', 'other') then raise exception 'INVALID_SOURCE'; end if;
  if p_platform not in ('ios', 'android', 'web', 'unknown') then raise exception 'INVALID_PLATFORM'; end if;
  if p_source = 'other' and (v_other_detail is null or char_length(v_other_detail) > 80) then raise exception 'INVALID_OTHER_DETAIL'; end if;
  if p_source <> 'other' then v_other_detail := null; end if;
  if nullif(btrim(p_onboarding_version), '') is null then raise exception 'INVALID_ONBOARDING_VERSION'; end if;

  insert into public.onboarding_acquisition_responses (user_id, source, other_detail, platform, onboarding_version)
  values (v_user_id, p_source, v_other_detail, p_platform, btrim(p_onboarding_version))
  on conflict (user_id) do nothing
  returning id into v_response_id;

  if v_response_id is null then
    select id into v_response_id from public.onboarding_acquisition_responses where user_id = v_user_id;
  end if;
  return v_response_id;
end;
$$;

revoke all on function public.record_onboarding_acquisition(text, text, text, text) from public, anon;
grant execute on function public.record_onboarding_acquisition(text, text, text, text) to authenticated;

create or replace function public.claim_onboarding_acquisition_sheet_rows(p_limit integer default 100)
returns setof public.onboarding_acquisition_responses
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user not in ('postgres', 'service_role') then raise exception 'UNAUTHORIZED'; end if;
  return query
  with candidates as (
    select response.id
    from public.onboarding_acquisition_responses response
    where response.sheet_sync_status = 'pending'
       or (response.sheet_sync_status = 'syncing' and response.sheet_sync_started_at < now() - interval '15 minutes')
    order by response.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  )
  update public.onboarding_acquisition_responses response
  set sheet_sync_status = 'syncing',
      sheet_sync_started_at = now(),
      sheet_sync_attempts = response.sheet_sync_attempts + 1,
      sheet_last_error = null
  from candidates
  where response.id = candidates.id
  returning response.*;
end;
$$;

revoke all on function public.claim_onboarding_acquisition_sheet_rows(integer) from public, anon, authenticated;
grant execute on function public.claim_onboarding_acquisition_sheet_rows(integer) to service_role;

create or replace view public.onboarding_acquisition_summary
with (security_invoker = true)
as
select source, count(*)::bigint as response_count
from public.onboarding_acquisition_responses
group by source;

revoke all on public.onboarding_acquisition_summary from public, anon, authenticated;
grant select on public.onboarding_acquisition_summary to service_role;
