-- Canonical store-receipt ownership. RevenueCat lifecycle webhooks are the only
-- provider surface that exposes Apple's stable original transaction ID, so the
-- ledger stores that identity and permits only one active Formie owner.

alter table public.user_access_entitlements
  add column if not exists provider_original_transaction_id text,
  add column if not exists provider_transaction_id text;

alter table public.revenuecat_webhook_events
  add column if not exists store text,
  add column if not exists original_transaction_id text,
  add column if not exists transaction_id text,
  add column if not exists aliases text[] not null default '{}',
  add column if not exists transferred_from text[] not null default '{}',
  add column if not exists transferred_to text[] not null default '{}';

-- Earlier reconciliation could copy one Apple period to two Formie accounts.
-- Retain the row with the freshest provider evidence and expire all exact
-- fingerprint duplicates before adding the receipt-owner uniqueness rule.
with ranked as (
  select
    entitlement.user_id,
    row_number() over (
      partition by entitlement.store, entitlement.store_product_id,
        coalesce(entitlement.billing_period_start, entitlement.current_period_start),
        coalesce(entitlement.billing_period_end, entitlement.current_period_end)
      order by entitlement.latest_event_at desc nulls last,
        entitlement.updated_at desc nulls last,
        entitlement.user_id desc
    ) as owner_rank,
    first_value(coalesce(entitlement.latest_event_at, entitlement.updated_at, now())) over (
      partition by entitlement.store, entitlement.store_product_id,
        coalesce(entitlement.billing_period_start, entitlement.current_period_start),
        coalesce(entitlement.billing_period_end, entitlement.current_period_end)
      order by entitlement.latest_event_at desc nulls last,
        entitlement.updated_at desc nulls last,
        entitlement.user_id desc
    ) as transfer_at
  from public.user_access_entitlements entitlement
  where entitlement.status = 'active'
    and entitlement.store in ('app_store', 'mac_app_store')
    and entitlement.store_product_id is not null
    and coalesce(entitlement.billing_period_start, entitlement.current_period_start) is not null
    and coalesce(entitlement.billing_period_end, entitlement.current_period_end) is not null
), expired_duplicates as (
  update public.user_access_entitlements entitlement
  set status = 'expired',
      lifecycle_state = 'expired',
      will_renew = false,
      current_period_end = least(coalesce(entitlement.current_period_end, ranked.transfer_at), ranked.transfer_at),
      billing_period_end = least(coalesce(entitlement.billing_period_end, ranked.transfer_at), ranked.transfer_at),
      latest_event_at = greatest(coalesce(entitlement.latest_event_at, '-infinity'::timestamptz), ranked.transfer_at),
      state_version = entitlement.state_version + 1,
      updated_at = now()
  from ranked
  where ranked.user_id = entitlement.user_id
    and ranked.owner_rank > 1
  returning entitlement.user_id
)
delete from public.subscription_test_scenarios scenario
using expired_duplicates duplicate
where scenario.user_id = duplicate.user_id;

create unique index if not exists user_access_entitlements_active_provider_owner_idx
  on public.user_access_entitlements(store, provider_original_transaction_id)
  where status = 'active' and provider_original_transaction_id is not null;

create index if not exists revenuecat_webhook_events_original_transaction_idx
  on public.revenuecat_webhook_events(store, original_transaction_id)
  where original_transaction_id is not null;

comment on column public.user_access_entitlements.provider_original_transaction_id is
  'Stable store subscription identity from RevenueCat lifecycle webhooks; unique among active owners.';
comment on column public.user_access_entitlements.provider_transaction_id is
  'Latest store transaction observed for the canonical subscription owner.';
