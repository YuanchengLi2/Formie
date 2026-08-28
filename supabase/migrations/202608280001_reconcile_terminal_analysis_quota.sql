-- Keep quota usage aligned with the terminal outcome of each analysis attempt.
-- Reanalysis reuses an analysis_sessions row, so only its newest still-reserved
-- credit belongs to the terminal attempt; older orphaned reservations must not
-- be charged by a later successful redo.
create or replace function public.reconcile_analysis_credit_for_session(
  p_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.analysis_sessions%rowtype;
  winning_reservation_id uuid;
  terminal_at timestamptz;
begin
  select * into target
  from public.analysis_sessions
  where id = p_session_id
  for update;

  if not found or target.status not in ('complete', 'partial', 'failed', 'unable') then
    return;
  end if;

  terminal_at := coalesce(target.completed_at, target.updated_at, now());

  if target.status in ('complete', 'partial') then
    select reservation.id into winning_reservation_id
    from public.analysis_credit_reservations reservation
    where reservation.session_id = target.id
      and reservation.user_id = target.user_id
      and reservation.status = 'reserved'
      and reservation.created_at <= terminal_at
    order by reservation.created_at desc, reservation.id desc
    limit 1;

    if winning_reservation_id is not null then
      update public.analysis_credit_reservations
      set status = 'committed',
          committed_at = coalesce(committed_at, terminal_at),
          expires_at = least(expires_at, terminal_at)
      where id = winning_reservation_id
        and status = 'reserved';

      update public.analysis_credit_reservations
      set status = 'cancelled',
          cancelled_at = coalesce(cancelled_at, terminal_at),
          expires_at = least(expires_at, terminal_at)
      where session_id = target.id
        and user_id = target.user_id
        and status = 'reserved'
        and id <> winning_reservation_id;
    end if;
  else
    update public.analysis_credit_reservations
    set status = 'cancelled',
        cancelled_at = coalesce(cancelled_at, terminal_at),
        expires_at = least(expires_at, terminal_at)
    where session_id = target.id
      and user_id = target.user_id
      and status = 'reserved';
  end if;
end;
$$;

create or replace function public.commit_analysis_credit_for_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('complete', 'partial', 'failed', 'unable')
     and (
       old.status is distinct from new.status
       or old.completed_at is distinct from new.completed_at
     ) then
    perform public.reconcile_analysis_credit_for_session(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists commit_analysis_credit_after_session on public.analysis_sessions;
create trigger commit_analysis_credit_after_session
after update of status, completed_at on public.analysis_sessions
for each row execute function public.commit_analysis_credit_for_session();

-- Repair production rows that reached a terminal session state without their
-- reservation following it. The helper deliberately commits only the newest
-- reservation for a reused session and releases older orphaned attempts.
do $$
declare
  terminal_session record;
begin
  for terminal_session in
    select distinct session.id
    from public.analysis_sessions session
    join public.analysis_credit_reservations reservation
      on reservation.session_id = session.id
     and reservation.user_id = session.user_id
    where reservation.status = 'reserved'
      and session.status in ('complete', 'partial', 'failed', 'unable')
  loop
    perform public.reconcile_analysis_credit_for_session(terminal_session.id);
  end loop;
end;
$$;

revoke all on function public.reconcile_analysis_credit_for_session(uuid) from public, anon, authenticated, service_role;
revoke all on function public.commit_analysis_credit_for_session() from public, anon, authenticated, service_role;

comment on function public.reconcile_analysis_credit_for_session(uuid) is
  'Commits the newest reservation for a successful terminal attempt and releases older or failed reservations.';
