-- Search the complete active catalog at the database boundary.  The app must
-- never download an alphabetically truncated exercise table and rank it locally.
create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
alter extension unaccent set schema extensions;

create or replace function public.search_exercise_variants_v2(
  p_query text,
  p_limit integer default 20
)
returns table (
  id integer,
  name text,
  family text,
  aliases jsonb,
  mechanics jsonb,
  execution_style text,
  matched_terms text[]
)
language sql
stable
security invoker
set search_path = pg_catalog, public, extensions
as $$
  with input as (
    select
      extensions.unaccent(lower(trim(coalesce(p_query, '')))) as raw_query,
      least(greatest(coalesce(p_limit, 20), 1), 20) as result_limit
  ),
  normalized as (
    select
      trim(regexp_replace(raw_query, '[^a-z0-9]+', ' ', 'g')) as normalized_query,
      result_limit
    from input
  ),
  expanded as (
    select
      normalized_query as raw_query,
      result_limit,
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      normalized_query,
                      '(^| )dumbells?( |$)', '\1dumbbell\2', 'g'
                    ),
                    '(^| )pulldowns?( |$)', '\1pull down\2', 'g'
                  ),
                  '(^| )dbs?( |$)', '\1dumbbell\2', 'g'
                ),
                '(^| )bbs?( |$)', '\1barbell\2', 'g'
              ),
              '(^| )one (hand|arm)( |$)', '\1single arm\3', 'g'
            ),
            '(^| )triceps?( |$)', '\1triceps\2', 'g'
          ),
          '(^| )bulgarian squat( |$)', '\1rear foot elevated split squat\2', 'g'
        ),
        '\s+', ' ', 'g'
      ) as expanded_query
    from normalized
  ),
  query_tokens as (
    select distinct token,
      case
        when token like '%ies' then regexp_replace(token, 'ies$', 'y')
        when token like '%s' and token not like '%ss' then regexp_replace(token, 's$', '')
        else token
      end as singular_token
    from expanded,
      lateral regexp_split_to_table(regexp_replace(expanded.expanded_query, '[^a-z0-9]+', ' ', 'g'), '\s+') as token
    where token <> ''
      and token not in ('a', 'an', 'and', 'for', 'the', 'to', 'with', 'of')
  ),
  query_flags as (
    select
      expanded.*,
      exists (select 1 from query_tokens where token in ('tempo', 'slow', 'pause', 'paused', 'isometric', 'hold')) as style_requested,
      exists (select 1 from query_tokens where token in ('flat', 'incline', 'decline', 'high', 'low')) as angle_requested
    from expanded
  ),
  searchable as (
    select
      variant.*,
      regexp_replace(
        regexp_replace(
          regexp_replace(extensions.unaccent(lower(regexp_replace(
            concat_ws(' ',
              variant.name,
              variant.aliases::text,
              variant.category,
              variant.family,
              variant.mechanics ->> 'equipmentClass',
              variant.mechanics ->> 'movementFamily',
              variant.mechanics ->> 'executionStyle'
            ),
            '[^a-z0-9]+', ' ', 'g'
          ))), '(^| )pulldowns?( |$)', '\1pull down\2', 'g'),
          '(^| )one (hand|arm)( |$)', '\1single arm\3', 'g'
        ),
        '(^| )tricep( |$)', '\1triceps\2', 'g'
      ) as searchable_text
    from public.exercise_variants_v2 as variant
    where variant.is_active
  ),
  strict_candidates as (
    select
      candidate.*,
      array(
        select token
        from query_tokens
        where (' ' || candidate.searchable_text || ' ') like '% ' || token || ' %'
          or (' ' || candidate.searchable_text || ' ') like '% ' || singular_token || ' %'
      ) as strict_terms
    from searchable as candidate
    cross join query_flags
    where query_flags.raw_query <> ''
      and exists (select 1 from query_tokens)
      and not exists (
        select 1
        from query_tokens
        where (' ' || candidate.searchable_text || ' ') not like '% ' || token || ' %'
          and (' ' || candidate.searchable_text || ' ') not like '% ' || singular_token || ' %'
      )
  ),
  fuzzy_candidates as (
    select
      candidate.*,
      array(
        select token
        from query_tokens
        where extensions.word_similarity(token, candidate.searchable_text) >= 0.72
          or extensions.word_similarity(singular_token, candidate.searchable_text) >= 0.72
      ) as fuzzy_terms
    from searchable as candidate
    cross join query_flags
    where query_flags.raw_query <> ''
      and exists (select 1 from query_tokens)
      and not exists (select 1 from strict_candidates)
      and not exists (
        select 1
        from query_tokens
        where extensions.word_similarity(token, candidate.searchable_text) < 0.72
          and extensions.word_similarity(singular_token, candidate.searchable_text) < 0.72
      )
  ),
  candidates as (
    select strict_candidates.*, strict_terms as matched_terms, false as fuzzy
    from strict_candidates
    union all
    select fuzzy_candidates.*, fuzzy_terms as matched_terms, true as fuzzy
    from fuzzy_candidates
  )
  select
    candidate.id,
    candidate.name,
    candidate.family,
    candidate.aliases,
    candidate.mechanics,
    candidate.execution_style,
    candidate.matched_terms
  from candidates as candidate
  cross join query_flags
  order by
    case when lower(candidate.name) = query_flags.raw_query then 0 else 1 end,
    case when exists (
      select 1
      from jsonb_array_elements_text(candidate.aliases) as alias(value)
      where extensions.unaccent(lower(alias.value)) = query_flags.raw_query
    ) then 0 else 1 end,
    case when lower(candidate.name) like query_flags.raw_query || '%' then 0 else 1 end,
    case when exists (
      select 1
      from jsonb_array_elements_text(candidate.aliases) as alias(value)
      where extensions.unaccent(lower(alias.value)) like query_flags.raw_query || '%'
    ) then 0 else 1 end,
    case when candidate.searchable_text like '%' || query_flags.expanded_query || '%' then 0 else 1 end,
    case when not query_flags.angle_requested and candidate.mechanics ->> 'angle' = 'flat' then 0 else 1 end,
    case when candidate.execution_style is null or query_flags.style_requested then 0 else 1 end,
    case when candidate.fuzzy then 1 else 0 end,
    extensions.similarity(candidate.searchable_text, query_flags.expanded_query) desc,
    candidate.name asc
  limit (select result_limit from query_flags);
$$;

-- Keep the historical RPC callable for older clients, but route it through
-- the corrected implementation so the broken unqualified trigram operator
-- cannot remain in production. Its legacy twelve-row bound is preserved.
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
  select result.id, result.name, result.family, result.aliases, result.mechanics
  from public.search_exercise_variants_v2(p_query, least(greatest(coalesce(p_limit, 12), 1), 12)) as result;
$$;

grant usage on schema extensions to anon, authenticated;
revoke all on function public.search_exercise_variants_v2(text, integer) from public;
grant execute on function public.search_exercise_variants_v2(text, integer) to anon, authenticated;
revoke all on function public.search_exercise_variants(text, integer) from public;
grant execute on function public.search_exercise_variants(text, integer) to anon, authenticated;
