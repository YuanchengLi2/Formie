alter table public.analysis_sessions
  add column if not exists set_declaration jsonb;

alter table public.analysis_sessions
  drop constraint if exists analysis_sessions_set_declaration_object_check;

alter table public.analysis_sessions
  add constraint analysis_sessions_set_declaration_object_check
  check (set_declaration is null or jsonb_typeof(set_declaration) = 'object');

create extension if not exists pg_trgm;

create index if not exists exercise_variants_v2_search_idx
  on public.exercise_variants_v2
  using gin (
    lower(name || ' ' || aliases::text) gin_trgm_ops
  )
  where is_active;

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
set search_path = public
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
      lower(variant.name) % query.value
      or lower(variant.name) like '%' || query.value || '%'
      or exists (
        select 1
        from jsonb_array_elements_text(variant.aliases) as alias(value)
        where lower(alias.value) % query.value
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
    similarity(lower(variant.name), query.value) desc,
    variant.name asc
  limit least(greatest(coalesce(p_limit, 12), 1), 12);
$$;

grant execute on function public.search_exercise_variants(text, integer)
  to anon, authenticated;
