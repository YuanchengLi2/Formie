-- Start an upload-backed analysis only for the reservation attempt that owns
-- the session. A nullable attempt keeps older installed clients compatible,
-- but is accepted only when the session has exactly one active attempt.
create or replace function public.start_analysis_attempt(
  p_user_id uuid,
  p_session_id uuid,
  p_attempt_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_session public.analysis_sessions%rowtype;
  v_attempt public.analysis_attempts%rowtype;
  v_reservation public.analysis_credit_reservations%rowtype;
  v_candidate_count integer;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'UNAUTHORIZED' using errcode='P0001';
  end if;

  select * into v_session
  from public.analysis_sessions
  where id=p_session_id and user_id=p_user_id
  for update;
  if not found then raise exception 'ANALYSIS_SESSION_NOT_FOUND' using errcode='P0001'; end if;

  if p_attempt_id is null then
    select count(*)::integer,min(attempt.id)
    into v_candidate_count,p_attempt_id
    from public.analysis_attempts attempt
    where attempt.session_id=p_session_id
      and attempt.user_id=p_user_id
      and attempt.status in ('reserved','processing');
    if v_candidate_count<>1 then
      raise exception 'ANALYSIS_ATTEMPT_REQUIRED' using errcode='P0001';
    end if;
  end if;

  if v_session.active_attempt_id is null or v_session.active_attempt_id<>p_attempt_id then
    raise exception 'ANALYSIS_ATTEMPT_SUPERSEDED' using errcode='P0001';
  end if;

  select * into v_attempt
  from public.analysis_attempts
  where id=p_attempt_id and session_id=p_session_id and user_id=p_user_id
  for update;
  if not found or v_attempt.status not in ('reserved','processing') then
    raise exception 'ANALYSIS_ATTEMPT_NOT_ACTIVE' using errcode='P0001';
  end if;

  select * into v_reservation
  from public.analysis_credit_reservations
  where id=v_attempt.reservation_id and user_id=p_user_id
  for update;
  if not found or v_reservation.status<>'reserved' or v_reservation.expires_at<=now() then
    raise exception 'ANALYSIS_RESERVATION_NOT_ACTIVE' using errcode='P0001';
  end if;
  if v_reservation.funding_source='referral_bonus' and not exists(
    select 1 from public.referral_bonus_grants grant_row
    where grant_row.id=v_reservation.bonus_grant_id
      and grant_row.user_id=p_user_id
      and grant_row.state='active'
      and grant_row.revoked_at is null
      and now()<grant_row.period_end
  ) then
    raise exception 'ANALYSIS_BONUS_NOT_ACTIVE' using errcode='P0001';
  end if;

  if v_session.status in ('complete','partial','failed','unable') then
    raise exception 'ANALYSIS_SESSION_TERMINAL' using errcode='P0001';
  end if;

  update public.analysis_attempts
  set status='processing',started_at=coalesce(started_at,now()),updated_at=now()
  where id=p_attempt_id;
  update public.analysis_sessions
  set status='processing',stage='video_check',analysis_started_at=coalesce(analysis_started_at,now()),updated_at=now()
  where id=p_session_id and active_attempt_id=p_attempt_id;
  if not found then raise exception 'ANALYSIS_ATTEMPT_SUPERSEDED' using errcode='P0001'; end if;
  return p_attempt_id;
end $$;

revoke all on function public.start_analysis_attempt(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.start_analysis_attempt(uuid,uuid,uuid) to service_role;
