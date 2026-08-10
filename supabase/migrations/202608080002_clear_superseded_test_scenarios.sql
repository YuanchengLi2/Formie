create or replace function public.clear_superseded_subscription_test_scenario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.store = 'test_store'
     and new.sandbox = true
     and coalesce(new.billing_period_end, new.current_period_end) is not null then
    delete from public.subscription_test_scenarios scenario
    where scenario.user_id = new.user_id
      and scenario.product_identifier = new.store_product_id
      and scenario.lifecycle_state <> 'active_cancelled'
      and scenario.billing_period_end < coalesce(new.billing_period_end, new.current_period_end);
  end if;

  return new;
end;
$$;

revoke all on function public.clear_superseded_subscription_test_scenario() from public, anon, authenticated, service_role;

drop trigger if exists clear_superseded_subscription_test_scenario_on_ledger
  on public.user_access_entitlements;

create trigger clear_superseded_subscription_test_scenario_on_ledger
after insert or update on public.user_access_entitlements
for each row
execute function public.clear_superseded_subscription_test_scenario();

-- Repair scenarios that were left behind by renewals processed before this
-- invariant existed. Explicit cancellation remains authoritative.
delete from public.subscription_test_scenarios scenario
using public.user_access_entitlements entitlement
where scenario.user_id = entitlement.user_id
  and scenario.product_identifier = entitlement.store_product_id
  and scenario.lifecycle_state <> 'active_cancelled'
  and scenario.billing_period_end < coalesce(entitlement.billing_period_end, entitlement.current_period_end);
