-- Durable transaction, reconciliation, commission, and payout ledgers.
alter table public.revenuecat_webhook_events
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists environment text,
  add column if not exists transaction_id text,
  add column if not exists original_transaction_id text,
  add column if not exists store text,
  add column if not exists product_identifier text,
  add column if not exists currency text,
  add column if not exists country_code text,
  add column if not exists price_in_purchased_currency numeric,
  add column if not exists tax_percentage numeric,
  add column if not exists commission_percentage numeric,
  add column if not exists cancel_reason text,
  add column if not exists purchased_at timestamptz,
  add column if not exists expiration_at timestamptz,
  add column if not exists event_timestamp timestamptz,
  add column if not exists raw_event jsonb,
  add column if not exists financial_projection_status text not null default 'pending',
  add column if not exists financial_projected_at timestamptz;

create table if not exists public.subscription_transactions (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  creator_id uuid references public.creators(id) on delete restrict,
  account_fingerprint text not null check (account_fingerprint ~ '^[0-9a-f]{64}$'),
  store text not null,
  environment text not null check (environment in ('PRODUCTION','SANDBOX')),
  transaction_id text not null,
  original_transaction_id text,
  product_identifier text,
  event_type text not null,
  purchased_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  gross_amount numeric,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  storefront_country text,
  estimated_tax_percentage numeric check (estimated_tax_percentage is null or estimated_tax_percentage between 0 and 1),
  estimated_commission_percentage numeric check (estimated_commission_percentage is null or estimated_commission_percentage between 0 and 1),
  estimated_net_proceeds numeric,
  proceeds_currency text check (proceeds_currency is null or proceeds_currency ~ '^[A-Z]{3}$'),
  financial_status text not null default 'estimated' check (financial_status in ('estimated','refunded','final','unmatched')),
  refunded_at timestamptz,
  refund_reversed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store,environment,transaction_id)
);
create index if not exists subscription_transactions_user_time_idx on public.subscription_transactions(user_id,purchased_at);
create index if not exists subscription_transactions_original_idx on public.subscription_transactions(store,environment,original_transaction_id);

create table if not exists public.subscription_reward_redemptions (
  store text not null,
  environment text not null check(environment in ('PRODUCTION','SANDBOX')),
  original_transaction_id text not null,
  account_fingerprint text not null check(account_fingerprint ~ '^[0-9a-f]{64}$'),
  qualifying_transaction_id uuid not null references public.subscription_transactions(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  primary key(store,environment,original_transaction_id),
  unique(qualifying_transaction_id)
);

create table if not exists public.apple_financial_imports (
  id uuid primary key default gen_random_uuid(),
  file_sha256 text not null unique check (file_sha256 ~ '^[0-9a-f]{64}$'),
  source_file_name text not null,
  storage_path text not null,
  fiscal_period_start date not null,
  fiscal_period_end date not null,
  report_currency text not null check (report_currency ~ '^[A-Z]{3}$'),
  status text not null default 'uploaded' check (status in ('uploaded','validated','reconciled','rejected')),
  row_count integer not null default 0 check (row_count>=0),
  rejected_row_count integer not null default 0 check (rejected_row_count>=0),
  validation_error text,
  imported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reconciled_at timestamptz,
  check (fiscal_period_end>=fiscal_period_start)
);

create table if not exists public.apple_financial_lines (
  id bigint generated always as identity primary key,
  import_id uuid not null references public.apple_financial_imports(id) on delete restrict,
  line_number integer not null check (line_number>0),
  transaction_date date,
  settlement_date date,
  sku text not null,
  product_type_identifier text,
  country_of_sale text,
  quantity integer not null,
  sale_or_return text not null check (sale_or_return in ('S','R')),
  partner_share numeric not null,
  extended_partner_share numeric not null,
  partner_share_currency text not null check (partner_share_currency ~ '^[A-Z]{3}$'),
  customer_price numeric,
  customer_currency text,
  unique(import_id,line_number)
);
create index if not exists apple_financial_lines_bucket_idx on public.apple_financial_lines(import_id,sku,country_of_sale,partner_share_currency,sale_or_return);

create table if not exists public.transaction_reconciliation_allocations (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.apple_financial_imports(id) on delete restrict,
  transaction_id uuid not null references public.subscription_transactions(id) on delete restrict,
  financial_line_id bigint not null references public.apple_financial_lines(id) on delete restrict,
  allocated_proceeds numeric not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  allocation_method text not null default 'compatible_bucket_weighted' check (allocation_method='compatible_bucket_weighted'),
  created_at timestamptz not null default now(),
  unique(import_id,transaction_id)
);

create table if not exists public.creator_commission_entries (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete restrict,
  referred_user_id uuid references auth.users(id) on delete set null,
  transaction_id uuid not null references public.subscription_transactions(id) on delete restrict,
  entry_type text not null check (entry_type in ('accrual','reconciliation_adjustment','refund_adjustment','refund_reversal')),
  amount numeric not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  commission_basis_points integer not null check (commission_basis_points between 0 and 2000),
  status text not null default 'pending' check (status in ('pending','payable','allocated','paid')),
  hold_until timestamptz not null,
  created_at timestamptz not null default now(),
  unique(transaction_id,entry_type)
);
create unique index if not exists creator_commission_first_accrual_idx on public.creator_commission_entries(referred_user_id) where entry_type='accrual' and referred_user_id is not null;
create index if not exists creator_commission_payable_idx on public.creator_commission_entries(creator_id,currency,hold_until) where status in ('pending','payable');

create table if not exists public.creator_payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount numeric not null check (amount>=0),
  status text not null default 'prepared' check (status in ('prepared','paid','cancelled')),
  prepared_by uuid references auth.users(id) on delete set null,
  prepared_at timestamptz not null default now(),
  paid_at timestamptz,
  external_reference text,
  check ((status='paid' and paid_at is not null and nullif(btrim(external_reference),'') is not null) or status<>'paid')
);

create table if not exists public.creator_payout_items (
  payout_id uuid not null references public.creator_payouts(id) on delete restrict,
  commission_entry_id uuid not null unique references public.creator_commission_entries(id) on delete restrict,
  amount numeric not null,
  primary key(payout_id,commission_entry_id)
);

alter table public.subscription_transactions enable row level security;
alter table public.subscription_reward_redemptions enable row level security;
alter table public.apple_financial_imports enable row level security;
alter table public.apple_financial_lines enable row level security;
alter table public.transaction_reconciliation_allocations enable row level security;
alter table public.creator_commission_entries enable row level security;
alter table public.creator_payouts enable row level security;
alter table public.creator_payout_items enable row level security;
revoke all on public.subscription_transactions,public.subscription_reward_redemptions,public.apple_financial_imports,public.apple_financial_lines,public.transaction_reconciliation_allocations,public.creator_commission_entries,public.creator_payouts,public.creator_payout_items from public,anon,authenticated;
grant select,insert,update on public.subscription_transactions,public.subscription_reward_redemptions,public.apple_financial_imports,public.apple_financial_lines,public.transaction_reconciliation_allocations,public.creator_commission_entries,public.creator_payouts,public.creator_payout_items to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('apple-financial-reports','apple-financial-reports',false,5000000,array['text/plain','text/csv','text/tab-separated-values'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.reconcile_apple_financial_import(p_import_id uuid,p_actor_user_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare report public.apple_financial_imports%rowtype; bucket record; candidate_count integer; unmatched integer:=0; weight_total numeric; allocated_count integer:=0;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  select * into report from public.apple_financial_imports where id=p_import_id and status in ('validated','reconciled') for update;
  if not found then raise exception 'IMPORT_NOT_VALIDATED'; end if;
  delete from public.transaction_reconciliation_allocations where import_id=p_import_id;
  for bucket in
    select min(id)::bigint financial_line_id,sku,country_of_sale,customer_currency,partner_share_currency,sale_or_return,
      sum(quantity)::integer quantity,sum(extended_partner_share) extended_partner_share
    from public.apple_financial_lines where import_id=p_import_id
    group by sku,country_of_sale,customer_currency,partner_share_currency,sale_or_return
    order by sku,country_of_sale,customer_currency,partner_share_currency,sale_or_return
  loop
    if bucket.customer_currency is null or bucket.customer_currency<>bucket.partner_share_currency then unmatched:=unmatched+1; continue; end if;
    select count(*),coalesce(sum(greatest(abs(transaction.gross_amount),0.000001)),0) into candidate_count,weight_total
    from public.subscription_transactions transaction
    where transaction.environment='PRODUCTION' and transaction.product_identifier=bucket.sku
      and transaction.purchased_at::date between report.fiscal_period_start and report.fiscal_period_end
      and transaction.currency=bucket.customer_currency
      and (bucket.country_of_sale is null or transaction.storefront_country=bucket.country_of_sale)
      and ((bucket.sale_or_return='S' and transaction.financial_status<>'refunded') or (bucket.sale_or_return='R' and transaction.financial_status='refunded'));
    if candidate_count<>abs(bucket.quantity) or candidate_count=0 or weight_total<=0 then unmatched:=unmatched+1; continue; end if;
    insert into public.transaction_reconciliation_allocations(import_id,transaction_id,financial_line_id,allocated_proceeds,currency)
    with candidates as (
      select transaction.id,greatest(abs(transaction.gross_amount),0.000001) weight,
        row_number() over(order by transaction.id) sequence
      from public.subscription_transactions transaction
      where transaction.environment='PRODUCTION' and transaction.product_identifier=bucket.sku
        and transaction.purchased_at::date between report.fiscal_period_start and report.fiscal_period_end
        and transaction.currency=bucket.customer_currency
        and (bucket.country_of_sale is null or transaction.storefront_country=bucket.country_of_sale)
        and ((bucket.sale_or_return='S' and transaction.financial_status<>'refunded') or (bucket.sale_or_return='R' and transaction.financial_status='refunded'))
    ), shares as (
      select id,sequence,round(bucket.extended_partner_share*weight/weight_total,6) share from candidates
    )
    select p_import_id,id,bucket.financial_line_id,
      case when sequence=candidate_count then bucket.extended_partner_share-coalesce(sum(share) over(order by sequence rows between unbounded preceding and 1 preceding),0) else share end,
      bucket.partner_share_currency from shares;
    get diagnostics candidate_count=row_count; allocated_count:=allocated_count+candidate_count;
  end loop;
  update public.subscription_transactions transaction set estimated_net_proceeds=allocated.total,proceeds_currency=allocated.currency,financial_status=case when transaction.financial_status='refunded' then 'refunded' else 'final' end,updated_at=now()
  from (select allocation.transaction_id,sum(allocation.allocated_proceeds) total,min(allocation.currency) currency from public.transaction_reconciliation_allocations allocation where allocation.import_id=p_import_id group by allocation.transaction_id) allocated
  where transaction.id=allocated.transaction_id;
  insert into public.creator_commission_entries(creator_id,referred_user_id,transaction_id,entry_type,amount,currency,commission_basis_points,hold_until)
  select accrual.creator_id,accrual.referred_user_id,accrual.transaction_id,'reconciliation_adjustment',round(transaction.estimated_net_proceeds*accrual.commission_basis_points/10000,6)-accrual.amount,accrual.currency,accrual.commission_basis_points,accrual.hold_until
  from public.creator_commission_entries accrual join public.subscription_transactions transaction on transaction.id=accrual.transaction_id
  where accrual.entry_type='accrual' and transaction.financial_status='final' and transaction.proceeds_currency=accrual.currency and exists(select 1 from public.transaction_reconciliation_allocations allocation where allocation.import_id=p_import_id and allocation.transaction_id=transaction.id)
  on conflict(transaction_id,entry_type) do update set amount=excluded.amount;
  update public.apple_financial_imports set status=case when unmatched=0 then 'reconciled' else 'validated' end,reconciled_at=case when unmatched=0 then now() else null end,validation_error=case when unmatched=0 then null else unmatched::text||' financial buckets remain unmatched' end where id=p_import_id;
  insert into public.founder_action_audit(actor_user_id,action,entity_type,entity_id,details) values(p_actor_user_id,'apple_report_reconciled','apple_financial_import',p_import_id::text,jsonb_build_object('allocatedTransactions',allocated_count,'unmatchedBuckets',unmatched));
  return case when unmatched=0 then allocated_count::text||' transactions reconciled.' else allocated_count::text||' transactions allocated; '||unmatched::text||' buckets remain pending.' end;
end $$;

create or replace function public.import_and_reconcile_apple_financial_report(
  p_file_sha256 text,
  p_source_file_name text,
  p_storage_path text,
  p_fiscal_period_start date,
  p_fiscal_period_end date,
  p_report_currency text,
  p_lines jsonb,
  p_actor_user_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_import_id uuid;
  v_inserted integer;
  v_result text;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 or jsonb_array_length(p_lines)>10000 then
    raise exception 'INVALID_REPORT_LINES';
  end if;
  insert into public.apple_financial_imports(
    file_sha256,source_file_name,storage_path,fiscal_period_start,fiscal_period_end,
    report_currency,status,row_count,imported_by
  ) values(
    lower(p_file_sha256),btrim(p_source_file_name),p_storage_path,p_fiscal_period_start,p_fiscal_period_end,
    upper(p_report_currency),'validated',jsonb_array_length(p_lines),p_actor_user_id
  ) returning id into v_import_id;
  insert into public.apple_financial_lines(
    import_id,line_number,transaction_date,settlement_date,sku,product_type_identifier,
    country_of_sale,quantity,sale_or_return,partner_share,extended_partner_share,
    partner_share_currency,customer_price,customer_currency
  )
  select v_import_id,line_number,transaction_date,settlement_date,btrim(sku),nullif(btrim(product_type_identifier),''),
    nullif(btrim(country_of_sale),''),quantity,upper(sale_or_return),partner_share,extended_partner_share,
    upper(partner_share_currency),customer_price,case when customer_currency is null then null else upper(customer_currency) end
  from jsonb_to_recordset(p_lines) as line(
    line_number integer,transaction_date date,settlement_date date,sku text,product_type_identifier text,
    country_of_sale text,quantity integer,sale_or_return text,partner_share numeric,
    extended_partner_share numeric,partner_share_currency text,customer_price numeric,customer_currency text
  );
  get diagnostics v_inserted=row_count;
  if v_inserted<>jsonb_array_length(p_lines) then raise exception 'REPORT_LINE_COUNT_MISMATCH'; end if;
  v_result:=public.reconcile_apple_financial_import(v_import_id,p_actor_user_id);
  return jsonb_build_object('importId',v_import_id,'result',v_result);
end $$;

create or replace function public.prepare_creator_payout(p_creator_id uuid,p_currency text,p_actor uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_amount numeric;
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  perform pg_advisory_xact_lock(hashtext(p_creator_id::text||upper(p_currency)));
  update public.creator_commission_entries entry set status='payable'
  where entry.creator_id=p_creator_id and entry.currency=upper(p_currency) and entry.status='pending'
    and entry.hold_until<=now()
    and exists(select 1 from public.transaction_reconciliation_allocations allocation where allocation.transaction_id=entry.transaction_id);
  select coalesce(sum(amount),0) into v_amount from public.creator_commission_entries
  where creator_id=p_creator_id and currency=upper(p_currency) and status='payable';
  if v_amount<=0 then raise exception 'NO_PAYABLE_BALANCE'; end if;
  insert into public.creator_payouts(creator_id,currency,amount,prepared_by) values(p_creator_id,upper(p_currency),v_amount,p_actor) returning id into v_id;
  insert into public.creator_payout_items(payout_id,commission_entry_id,amount)
  select v_id,id,amount from public.creator_commission_entries where creator_id=p_creator_id and currency=upper(p_currency) and status='payable';
  update public.creator_commission_entries entry set status='allocated'
  where exists(select 1 from public.creator_payout_items item where item.payout_id=v_id and item.commission_entry_id=entry.id);
  return v_id;
end $$;

create or replace function public.mark_creator_payout_paid(p_payout_id uuid,p_paid_at timestamptz,p_external_reference text,p_actor uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if current_user not in ('postgres','service_role') then raise exception 'UNAUTHORIZED'; end if;
  if p_paid_at is null or nullif(btrim(p_external_reference),'') is null then raise exception 'PAYMENT_REFERENCE_REQUIRED'; end if;
  update public.creator_payouts set status='paid',paid_at=p_paid_at,external_reference=btrim(p_external_reference)
  where id=p_payout_id and status='prepared';
  if not found then raise exception 'PAYOUT_NOT_PREPARED'; end if;
  update public.creator_commission_entries entry set status='paid'
  where exists(select 1 from public.creator_payout_items item where item.payout_id=p_payout_id and item.commission_entry_id=entry.id);
  insert into public.founder_action_audit(actor_user_id,action,entity_type,entity_id,details)
  values(p_actor,'mark_paid','creator_payout',p_payout_id::text,jsonb_build_object('externalReference',btrim(p_external_reference),'paidAt',p_paid_at));
end $$;

revoke all on function public.reconcile_apple_financial_import(uuid,uuid),public.import_and_reconcile_apple_financial_report(text,text,text,date,date,text,jsonb,uuid),public.prepare_creator_payout(uuid,text,uuid),public.mark_creator_payout_paid(uuid,timestamptz,text,uuid) from public,anon,authenticated;
grant execute on function public.reconcile_apple_financial_import(uuid,uuid),public.import_and_reconcile_apple_financial_report(text,text,text,date,date,text,jsonb,uuid),public.prepare_creator_payout(uuid,text,uuid),public.mark_creator_payout_paid(uuid,timestamptz,text,uuid) to service_role;
