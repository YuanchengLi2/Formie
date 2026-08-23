create or replace function public.fail_preprocessing_analysis(
  p_user_id uuid,
  p_session_id uuid,
  p_reservation_id uuid,
  p_failure_code text
)
returns table(session_failed boolean, reservation_cancelled boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.analysis_sessions%rowtype;
begin
  if p_user_id is null or p_session_id is null then
    raise exception 'ANALYSIS_SESSION_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_failure_code not in ('UPLOAD_FAILED', 'UPLOAD_CANCELLED') then
    raise exception 'ANALYSIS_FAILURE_CODE_INVALID' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  select * into target
  from public.analysis_sessions
  where id = p_session_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'ANALYSIS_SESSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  session_failed := false;
  if target.status in ('created', 'uploading', 'queued') then
    update public.analysis_sessions
    set status = 'failed',
        stage = 'failed',
        failure_code = p_failure_code,
        analysis_next_retry_at = null,
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    where id = p_session_id
      and user_id = p_user_id
      and status in ('created', 'uploading', 'queued');
    session_failed := found;
  elsif target.status = 'failed'
    and target.stage = 'failed'
    and target.failure_code = p_failure_code then
    session_failed := true;
  else
    reservation_cancelled := false;
    return next;
    return;
  end if;

  update public.analysis_credit_reservations
  set status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, now()),
      expires_at = least(expires_at, now())
  where user_id = p_user_id
    and session_id = p_session_id
    and status = 'reserved'
    and (p_reservation_id is null or id = p_reservation_id);
  reservation_cancelled := found;

  if not reservation_cancelled then
    select exists (
      select 1
      from public.analysis_credit_reservations
      where user_id = p_user_id
        and session_id = p_session_id
        and status = 'cancelled'
        and (p_reservation_id is null or id = p_reservation_id)
    ) into reservation_cancelled;
  end if;

  return next;
end;
$$;

revoke all on function public.fail_preprocessing_analysis(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fail_preprocessing_analysis(uuid, uuid, uuid, text) to service_role;

comment on function public.fail_preprocessing_analysis(uuid, uuid, uuid, text) is
  'Atomically terminalizes an owned pre-processing analysis and releases its still-reserved credit.';
