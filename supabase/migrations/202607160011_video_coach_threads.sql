create table public.coach_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.analysis_sessions(id) on delete cascade,
  target_intent text check (target_intent is null or char_length(target_intent) between 1 and 240),
  gemini_file_name text,
  gemini_file_uri text,
  gemini_file_state text check (gemini_file_state in ('PROCESSING', 'ACTIVE', 'FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_id)
);

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.coach_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  created_at timestamptz not null default now()
);

create index coach_messages_thread_created_idx on public.coach_messages (thread_id, created_at);

alter table public.coach_threads enable row level security;
alter table public.coach_messages enable row level security;

create policy "coach thread owners can read"
on public.coach_threads for select
to authenticated
using (auth.uid() = user_id);

create policy "coach thread owners can create"
on public.coach_threads for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.analysis_sessions
    where analysis_sessions.id = session_id
      and analysis_sessions.user_id = auth.uid()
  )
);

create policy "coach message owners can read"
on public.coach_messages for select
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.coach_threads
    where coach_threads.id = thread_id
      and coach_threads.user_id = auth.uid()
  )
);

grant select, insert on public.coach_threads to authenticated;
grant select on public.coach_messages to authenticated;
