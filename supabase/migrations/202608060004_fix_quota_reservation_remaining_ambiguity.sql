-- Qualify the access snapshot returned after a reservation. The unqualified
-- `remaining` identifier collides with this function's RETURNS TABLE output
-- variable and prevents every new analysis reservation from completing.
create or replace function public.reserve_analysis_credit_for_user(
  p_user_id uuid,
  p_client_request_id text,
  p_kind text,
  p_session_id uuid default null
)
returns table(reservation_id uuid, status text, remaining integer, period_ends_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.analysis_credit_reservations%rowtype;
  access record;
  next_remaining integer;
begin
  if p_user_id is null then
    raise exception 'ANALYSIS_ACCESS_UNAUTHORIZED' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  if p_client_request_id is null or char_length(trim(p_client_request_id)) < 8 then
    raise exception 'ANALYSIS_REQUEST_ID_REQUIRED' using errcode = 'P0001';
  end if;
  if p_kind not in ('analysis', 'reanalysis') then
    raise exception 'ANALYSIS_KIND_INVALID' using errcode = 'P0001';
  end if;
  if p_session_id is not null and not exists (
    select 1 from public.analysis_sessions where id = p_session_id and user_id = p_user_id
  ) then
    raise exception 'ANALYSIS_SESSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into access from public.get_access_status_for_user(p_user_id);
  select * into existing
  from public.analysis_credit_reservations
  where user_id = p_user_id and client_request_id = trim(p_client_request_id)
  for update;

  if found and existing.status in ('reserved', 'committed') then
    if p_session_id is not null and existing.session_id is null then
      update public.analysis_credit_reservations set session_id = p_session_id where id = existing.id;
    end if;
    return query select existing.id, 'already_reserved', access.remaining, access.period_ends_at;
    return;
  end if;

  if not coalesce(access.can_analyze, false) then
    if access.status = 'expired' then
      raise exception 'ANALYSIS_SUBSCRIPTION_REQUIRED' using errcode = 'P0001';
    end if;
    raise exception 'ANALYSIS_QUOTA_EXCEEDED' using errcode = 'P0001';
  end if;

  if existing.id is not null then
    update public.analysis_credit_reservations
    set status = 'reserved',
        session_id = p_session_id,
        kind = p_kind,
        created_at = now(),
        expires_at = now() + interval '2 hours',
        committed_at = null,
        cancelled_at = null,
        period_start = access.period_starts_at,
        period_end = access.period_ends_at
    where id = existing.id;
  else
    insert into public.analysis_credit_reservations(
      user_id, session_id, client_request_id, kind, period_start, period_end
    ) values (
      p_user_id, p_session_id, trim(p_client_request_id), p_kind, access.period_starts_at, access.period_ends_at
    ) returning id into existing.id;
  end if;

  select access_snapshot.remaining into next_remaining
  from public.get_access_status_for_user(p_user_id) as access_snapshot;
  return query select existing.id, 'reserved', next_remaining, access.period_ends_at;
end;
$$;

revoke all on function public.reserve_analysis_credit_for_user(uuid, text, text, uuid)
from public, anon, authenticated;
grant execute on function public.reserve_analysis_credit_for_user(uuid, text, text, uuid)
to service_role;
