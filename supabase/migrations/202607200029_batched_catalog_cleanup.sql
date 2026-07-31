create or replace function public.delete_stale_exercise_catalog_batch(
  p_catalog_version text,
  p_kind text,
  p_batch_size integer default 2000
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if p_catalog_version is null or btrim(p_catalog_version) = '' then
    raise exception 'catalog version is required';
  end if;
  if p_batch_size < 1 or p_batch_size > 5000 then
    raise exception 'batch size must be between 1 and 5000';
  end if;

  if p_kind = 'criteria' then
    with stale as (
      select ctid
      from public.exercise_criteria_v2
      where catalog_version <> p_catalog_version
      limit p_batch_size
    )
    delete from public.exercise_criteria_v2 target
    using stale
    where target.ctid = stale.ctid;
  elsif p_kind = 'variants' then
    with stale as (
      select ctid
      from public.exercise_variants_v2
      where catalog_version <> p_catalog_version
      limit p_batch_size
    )
    delete from public.exercise_variants_v2 target
    using stale
    where target.ctid = stale.ctid;
  else
    raise exception 'kind must be criteria or variants';
  end if;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_stale_exercise_catalog_batch(text, text, integer) from public;
grant execute on function public.delete_stale_exercise_catalog_batch(text, text, integer) to service_role;
