alter table public.analysis_sessions
  add column if not exists client_request_id text;

create unique index if not exists analysis_sessions_user_client_request_uidx
  on public.analysis_sessions(user_id, client_request_id);

comment on column public.analysis_sessions.client_request_id is
  'Client-generated idempotency key used to reconnect or retry session creation without duplicating an upload.';
