alter table public.analysis_sessions
  add column if not exists pinned_at timestamptz;

create policy analysis_sessions_owner_update_pin
on public.analysis_sessions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant update (pinned_at) on public.analysis_sessions to authenticated;

create index if not exists analysis_sessions_user_pinned_idx
on public.analysis_sessions(user_id, pinned_at desc nulls last, created_at desc);
