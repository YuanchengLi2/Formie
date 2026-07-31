alter table public.coach_messages
  add column if not exists grounding jsonb,
  add column if not exists exchange_key text;

alter table public.coach_messages
  drop constraint if exists coach_messages_grounding_role_check,
  add constraint coach_messages_grounding_role_check
    check (grounding is null or (role = 'assistant' and jsonb_typeof(grounding) = 'object')),
  drop constraint if exists coach_messages_exchange_key_length_check,
  add constraint coach_messages_exchange_key_length_check
    check (exchange_key is null or char_length(exchange_key) between 1 and 120);

create unique index if not exists coach_messages_thread_exchange_role_idx
  on public.coach_messages (thread_id, exchange_key, role)
  where exchange_key is not null;

create or replace function public.append_coach_exchange(
  p_thread_id uuid,
  p_user_id uuid,
  p_exchange_key text,
  p_user_content text,
  p_assistant_content text,
  p_grounding jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_row public.coach_messages%rowtype;
  assistant_row public.coach_messages%rowtype;
begin
  if p_exchange_key is null or char_length(p_exchange_key) not between 1 and 120 then
    raise exception 'invalid exchange key';
  end if;

  perform 1
  from public.coach_threads
  where id = p_thread_id and user_id = p_user_id
  for update;
  if not found then raise exception 'conversation not found'; end if;

  select * into user_row
  from public.coach_messages
  where thread_id = p_thread_id and exchange_key = p_exchange_key and role = 'user';
  select * into assistant_row
  from public.coach_messages
  where thread_id = p_thread_id and exchange_key = p_exchange_key and role = 'assistant';

  if user_row.id is null and assistant_row.id is null then
    insert into public.coach_messages (thread_id, user_id, role, content, exchange_key)
    values (p_thread_id, p_user_id, 'user', p_user_content, p_exchange_key)
    returning * into user_row;

    insert into public.coach_messages (thread_id, user_id, role, content, grounding, exchange_key)
    values (p_thread_id, p_user_id, 'assistant', p_assistant_content, p_grounding, p_exchange_key)
    returning * into assistant_row;

    update public.coach_threads
    set updated_at = now()
    where id = p_thread_id and user_id = p_user_id;
  elsif user_row.id is null or assistant_row.id is null then
    raise exception 'incomplete coach exchange';
  end if;

  return jsonb_build_object(
    'userMessage', jsonb_build_object(
      'id', user_row.id,
      'threadId', user_row.thread_id,
      'role', user_row.role,
      'content', user_row.content,
      'createdAt', user_row.created_at,
      'grounding', user_row.grounding
    ),
    'assistantMessage', jsonb_build_object(
      'id', assistant_row.id,
      'threadId', assistant_row.thread_id,
      'role', assistant_row.role,
      'content', assistant_row.content,
      'createdAt', assistant_row.created_at,
      'grounding', assistant_row.grounding
    )
  );
end;
$$;

revoke all on function public.append_coach_exchange(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.append_coach_exchange(uuid, uuid, text, text, text, jsonb) to service_role;
