-- Quota windows must be derived from the provider-confirmed billing period.
-- A sandbox flag changes delivery/reconciliation behavior, not subscription time.
-- This removes the legacy Test Store-only five-minute quota clock without
-- inventing or extending any Apple or RevenueCat expiration timestamp.
create or replace function public.resolve_subscription_quota_period(
  p_plan_code text,
  p_billing_start timestamptz,
  p_billing_end timestamptz,
  p_store text,
  p_sandbox boolean,
  p_now timestamptz default now()
)
returns table(quota_period_start timestamptz, quota_period_end timestamptz)
language plpgsql immutable set search_path = '' as $$
declare
  cursor_start timestamptz;
  cursor_end timestamptz;
  month_index integer := 0;
begin
  if p_billing_start is null or p_billing_end is null or p_billing_start >= p_billing_end then
    return;
  end if;

  -- Monthly plans, including Apple sandbox periods, use the exact period sent
  -- by the provider. Short sandbox periods are not expanded or subdivided.
  if p_plan_code <> 'annual' then
    return query select p_billing_start, p_billing_end;
    return;
  end if;

  -- Annual plans receive monthly analysis allowances. If a sandbox provider
  -- supplies a shorter period, least() keeps the quota inside that real period.
  cursor_start := p_billing_start;
  cursor_end := least(p_billing_start + interval '1 month', p_billing_end);
  while cursor_end <= p_now and cursor_end < p_billing_end and month_index < 11 loop
    month_index := month_index + 1;
    cursor_start := p_billing_start + make_interval(months => month_index);
    cursor_end := least(p_billing_start + make_interval(months => month_index + 1), p_billing_end);
  end loop;
  return query select cursor_start, cursor_end;
end;
$$;

revoke all on function public.resolve_subscription_quota_period(text,timestamptz,timestamptz,text,boolean,timestamptz) from public, anon, authenticated;
grant execute on function public.resolve_subscription_quota_period(text,timestamptz,timestamptz,text,boolean,timestamptz) to service_role;
