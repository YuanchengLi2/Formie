-- Qualify reservation columns that collide with RETURNS TABLE output names.
create or replace function public.reserve_analysis_credit_for_user(
  p_user_id uuid,p_client_request_id text,p_kind text,p_session_id uuid default null
) returns table(reservation_id uuid,status text,remaining integer,period_ends_at timestamptz,blocking_session_id uuid)
language plpgsql security definer set search_path='' as $$
declare
  v_existing public.analysis_credit_reservations%rowtype;
  v_access record;
  v_blocking uuid;
  v_base_limit integer:=10;
  v_base_held integer:=0;
  v_bonus public.referral_bonus_grants%rowtype;
  v_bonus_held integer:=0;
  v_source text:='base';
  v_attempt uuid;
  v_total_remaining integer;
  v_bonus_access record;
begin
  if p_user_id is null then raise exception 'ANALYSIS_ACCESS_UNAUTHORIZED' using errcode='P0001'; end if;
  if p_client_request_id is null or char_length(btrim(p_client_request_id))<8 then raise exception 'ANALYSIS_REQUEST_ID_REQUIRED' using errcode='P0001'; end if;
  if p_kind not in ('analysis','reanalysis') then raise exception 'ANALYSIS_KIND_INVALID' using errcode='P0001'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  select access_row.* into v_access from public.get_access_status_for_user(p_user_id) access_row;
  select reservation.* into v_existing
  from public.analysis_credit_reservations reservation
  where reservation.user_id=p_user_id and reservation.client_request_id=btrim(p_client_request_id)
  for update;
  if found and v_existing.status in ('reserved','committed') then
    if p_session_id is not null and v_existing.session_id is null then
      perform public.attach_analysis_reservation_to_session(v_existing.id,p_session_id,p_user_id);
    end if;
    select bonus_access.* into v_bonus_access from public.get_referral_bonus_access_for_user(p_user_id) bonus_access;
    return query select v_existing.id,'already_reserved',greatest(coalesce(v_access.remaining,0)+coalesce(v_bonus_access.bonus_remaining,0),0),
      case when v_existing.funding_source='referral_bonus' then v_existing.period_end else v_access.quota_period_end end,null::uuid;
    return;
  elsif found then
    return query select v_existing.id,'request_terminal',v_access.remaining,v_existing.period_end,v_existing.session_id;
    return;
  end if;
  select reservation.session_id into v_blocking
  from public.analysis_credit_reservations reservation
  left join public.analysis_sessions session_row on session_row.id=reservation.session_id
  where reservation.user_id=p_user_id and reservation.status='reserved' and reservation.expires_at>now()
    and (reservation.session_id is null or session_row.status in ('created','uploading','queued','processing'))
  order by reservation.created_at desc limit 1;
  if found or v_access.pending_analysis_session_id is not null then
    return query select null::uuid,'analysis_pending',v_access.remaining,v_access.quota_period_end,coalesce(v_blocking,v_access.pending_analysis_session_id);
    return;
  end if;
  if v_access.status<>'active' then raise exception 'ANALYSIS_SUBSCRIPTION_REQUIRED' using errcode='P0001'; end if;
  if p_session_id is not null and not exists(
    select 1 from public.analysis_sessions session_row where session_row.id=p_session_id and session_row.user_id=p_user_id
  ) then raise exception 'ANALYSIS_SESSION_NOT_FOUND' using errcode='P0001'; end if;
  v_base_limit:=coalesce(v_access.quota_limit,10);
  select count(*)::integer into v_base_held
  from public.analysis_credit_reservations reservation
  where reservation.user_id=p_user_id and reservation.funding_source='base'
    and reservation.period_start=v_access.quota_period_start and reservation.period_end=v_access.quota_period_end
    and (reservation.status='committed' or (reservation.status='reserved' and reservation.expires_at>now()));
  select grant_row.* into v_bonus
  from public.referral_bonus_grants grant_row
  where grant_row.user_id=p_user_id and grant_row.state='active'
    and grant_row.period_start<=now() and grant_row.period_end>now()
  order by grant_row.granted_at limit 1 for update;
  if found then
    select count(*)::integer into v_bonus_held
    from public.analysis_credit_reservations reservation
    where reservation.bonus_grant_id=v_bonus.id
      and (reservation.status='committed' or (reservation.status='reserved' and reservation.expires_at>now()));
  end if;
  if v_base_held<v_base_limit then
    v_source:='base';
  elsif v_bonus.id is not null and v_bonus_held<v_bonus.units_granted then
    v_source:='referral_bonus';
  else
    raise exception 'ANALYSIS_QUOTA_EXCEEDED' using errcode='P0001';
  end if;
  insert into public.analysis_credit_reservations(
    user_id,session_id,client_request_id,kind,period_start,period_end,funding_source,bonus_grant_id,expires_at
  ) values(
    p_user_id,p_session_id,btrim(p_client_request_id),p_kind,
    case when v_source='referral_bonus' then v_bonus.period_start else v_access.quota_period_start end,
    case when v_source='referral_bonus' then v_bonus.period_end else v_access.quota_period_end end,
    v_source,case when v_source='referral_bonus' then v_bonus.id else null end,now()+interval '2 hours'
  ) returning analysis_credit_reservations.id into v_existing.id;
  insert into public.analysis_attempts(reservation_id,session_id,user_id,kind)
  values(v_existing.id,p_session_id,p_user_id,p_kind)
  returning analysis_attempts.id into v_attempt;
  if p_session_id is not null then
    update public.analysis_sessions session_row set active_attempt_id=v_attempt
    where session_row.id=p_session_id and session_row.user_id=p_user_id;
  end if;
  v_total_remaining:=greatest(v_base_limit-v_base_held-case when v_source='base' then 1 else 0 end,0)
    +case when v_bonus.id is null then 0 else greatest(v_bonus.units_granted-v_bonus_held-case when v_source='referral_bonus' then 1 else 0 end,0) end;
  return query select v_existing.id,'reserved',v_total_remaining,v_access.quota_period_end,null::uuid;
end $$;

revoke all on function public.reserve_analysis_credit_for_user(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_analysis_credit_for_user(uuid,text,text,uuid) to service_role;
