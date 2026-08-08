-- Persist privacy-safe cancellation and resume intent without storing free-form
-- feedback or payment details.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.product_analytics_events'::regclass
      and conname = 'product_analytics_events_event_name_check'
  ) then
    alter table public.product_analytics_events
      drop constraint product_analytics_events_event_name_check;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.product_analytics_events'::regclass
      and conname = 'product_analytics_events_event_name_check'
  ) then
    alter table public.product_analytics_events
      add constraint product_analytics_events_event_name_check check (event_name in (
        'onboarding_screen_viewed', 'onboarding_cta_pressed', 'onboarding_demo_tab_opened',
        'paywall_viewed', 'purchase_started', 'purchase_succeeded', 'purchase_cancelled',
        'purchase_failed', 'purchase_restored', 'analysis_reservation_denied',
        'analysis_cancelled', 'subscription_management_intent'
      ));
  end if;
end;
$$;

create or replace function public.record_product_analytics(p_event_name text, p_properties jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_event_name not in (
    'onboarding_screen_viewed', 'onboarding_cta_pressed', 'onboarding_demo_tab_opened',
    'paywall_viewed', 'purchase_started', 'purchase_succeeded', 'purchase_cancelled',
    'purchase_failed', 'purchase_restored', 'analysis_reservation_denied',
    'analysis_cancelled', 'subscription_management_intent'
  ) then
    raise exception 'analytics event is not allowed';
  end if;
  insert into public.product_analytics_events(user_id, event_name, properties)
  values (auth.uid(), p_event_name, case when jsonb_typeof(p_properties) = 'object' then p_properties else '{}'::jsonb end);
end;
$$;

create or replace function public.record_subscription_management_intent(
  p_action text,
  p_reason text,
  p_surface text,
  p_store text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authenticated user is required';
  end if;
  if p_action not in ('cancel', 'resume') then
    raise exception 'subscription intent action is not allowed';
  end if;
  if p_action = 'cancel' and p_reason not in ('too_expensive', 'not_using_enough', 'coaching_not_helpful', 'technical_issues', 'other', 'prefer_not_to_say') then
    raise exception 'subscription cancellation reason is required';
  end if;
  if p_action = 'resume' and p_reason is not null then
    raise exception 'resume intent cannot include a cancellation reason';
  end if;
  if p_surface not in ('mobile', 'website') then
    raise exception 'subscription intent surface is not allowed';
  end if;
  if p_store not in ('app_store', 'play_store', 'test_store', 'unknown') then
    raise exception 'subscription intent store is not allowed';
  end if;

  insert into public.product_analytics_events(user_id, event_name, properties)
  values (
    auth.uid(),
    'subscription_management_intent',
    jsonb_build_object(
      'action', p_action,
      'reason', p_reason,
      'surface', p_surface,
      'store', p_store
    )
  );
end;
$$;

revoke all on function public.record_product_analytics(text, jsonb) from public, anon, authenticated;
grant execute on function public.record_product_analytics(text, jsonb) to authenticated;
revoke all on function public.record_subscription_management_intent(text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_subscription_management_intent(text, text, text, text) to authenticated;
