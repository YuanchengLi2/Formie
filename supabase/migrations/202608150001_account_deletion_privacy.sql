alter table public.product_analytics_events
  drop constraint if exists product_analytics_events_user_id_fkey;

alter table public.product_analytics_events
  add constraint product_analytics_events_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

comment on constraint product_analytics_events_user_id_fkey
  on public.product_analytics_events
  is 'Remove identity-linked product analytics when the owning account is deleted.';
