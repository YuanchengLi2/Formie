-- pg_trgm was moved out of public in 202608130002. Qualify every
-- extension-owned symbol so exercise search remains valid regardless of the
-- caller or PostgREST search_path.
create or replace function public.search_exercise_variants(
  p_query text,
  p_limit integer default 12
)
returns table (
  id integer,
  name text,
  family text,
  aliases jsonb,
  mechanics jsonb
)
language sql
stable
security invoker
set search_path = pg_catalog, public, extensions
as $$
  with query as (
    select lower(trim(coalesce(p_query, ''))) as value
  )
  select
    variant.id,
    variant.name,
    variant.family,
    variant.aliases,
    variant.mechanics
  from public.exercise_variants_v2 as variant
  cross join query
  where variant.is_active
    and query.value <> ''
    and (
      lower(variant.name) operator(extensions.%) query.value
      or lower(variant.name) like '%' || query.value || '%'
      or exists (
        select 1
        from jsonb_array_elements_text(variant.aliases) as alias(value)
        where lower(alias.value) operator(extensions.%) query.value
           or lower(alias.value) like '%' || query.value || '%'
      )
    )
  order by
    case
      when lower(variant.name) = query.value then 0
      when exists (
        select 1
        from jsonb_array_elements_text(variant.aliases) as alias(value)
        where lower(alias.value) = query.value
      ) then 1
      when lower(variant.name) like query.value || '%' then 2
      else 3
    end,
    extensions.similarity(lower(variant.name), query.value) desc,
    variant.name asc
  limit least(greatest(coalesce(p_limit, 12), 1), 12);
$$;

grant usage on schema extensions to anon, authenticated;
revoke all on function public.search_exercise_variants(text, integer) from public;
grant execute on function public.search_exercise_variants(text, integer) to anon, authenticated;
