-- Precompute the normalized exercise search document once per catalog write
-- instead of rebuilding it for thousands of rows during every typeahead query.
alter table public.exercise_variants_v2
  add column if not exists search_normalized_name text,
  add column if not exists search_normalized_aliases text[],
  add column if not exists search_text text;

create or replace function public.set_exercise_variant_search_document()
returns trigger
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
begin
  new.search_normalized_name := trim(regexp_replace(
    extensions.unaccent(lower(new.name)),
    '[^a-z0-9]+', ' ', 'g'
  ));

  select coalesce(
    array_agg(
      trim(regexp_replace(
        extensions.unaccent(lower(alias.value)),
        '[^a-z0-9]+', ' ', 'g'
      ))
      order by alias.ordinality
    ),
    '{}'::text[]
  )
  into new.search_normalized_aliases
  from jsonb_array_elements_text(coalesce(new.aliases, '[]'::jsonb))
    with ordinality as alias(value, ordinality);

  new.search_text := trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            extensions.unaccent(lower(concat_ws(' ',
              new.name,
              new.aliases::text,
              new.category,
              new.family,
              new.mechanics ->> 'equipmentClass',
              new.mechanics ->> 'movementFamily',
              new.mechanics ->> 'executionStyle',
              case
                when new.family = 'curl'
                  or new.mechanics ->> 'movementFamily' = 'curl'
                then 'bicep biceps'
              end,
              case
                when lower(new.name) like '%rear foot elevated split squat%'
                then 'bulgarian squat bulgarian split squat'
              end,
              case
                when lower(new.name) like '%overhead press%'
                then 'shoulder press ohp'
              end,
              case
                when lower(new.name) like '%push up%'
                then 'pushup'
              end,
              case
                when lower(new.name) like '%romanian deadlift%'
                then 'rdl'
              end
            ))),
            '[^a-z0-9]+', ' ', 'g'
          ),
          '(^| )pulldowns?( |$)', '\1pull down\2', 'g'
        ),
        '(^| )one (hand|arm)( |$)', '\1single arm\3', 'g'
      ),
      '(^| )tricep( |$)', '\1triceps\2', 'g'
    ),
    '\s+', ' ', 'g'
  ));

  return new;
end;
$$;

revoke all on function public.set_exercise_variant_search_document() from public, anon, authenticated;

drop trigger if exists set_exercise_variant_search_document
  on public.exercise_variants_v2;

create trigger set_exercise_variant_search_document
before insert or update of name, aliases, category, family, mechanics
on public.exercise_variants_v2
for each row
execute function public.set_exercise_variant_search_document();

-- Naming the source column in SET intentionally fires the maintenance trigger
-- for every existing row without changing canonical catalog data.
update public.exercise_variants_v2
set name = name;

alter table public.exercise_variants_v2
  alter column search_normalized_name set not null,
  alter column search_normalized_aliases set not null,
  alter column search_text set not null;

create index if not exists exercise_variants_v2_search_text_trgm_idx
  on public.exercise_variants_v2
  using gin (search_text extensions.gin_trgm_ops)
  where is_active;

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
      trim(regexp_replace(
        extensions.unaccent(lower(coalesce(p_query, ''))),
        '[^a-z0-9]+', ' ', 'g'
      )) as normalized_query,
      least(greatest(coalesce(p_limit, 20), 1), 20) as result_limit
  ),
  expanded as (
    select
      normalized_query as raw_query,
      result_limit,
      trim(regexp_replace(
        regexp_replace(
          regexp_replace(
          regexp_replace(
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
                '(^| )bulgarian( split)? squat( |$)', '\1rear foot elevated split squat\3', 'g'
              ),
              '(^| )pushups?( |$)', '\1push up\2', 'g'
            ),
            '(^| )rdl( |$)', '\1romanian deadlift\2', 'g'
          ),
          '(^| )ohp( |$)', '\1overhead press\2', 'g'
        ),
          '(^| )biceps?( |$)', '\1curl\2', 'g'
        ),
        '\s+', ' ', 'g'
      )) as expanded_query
    from input
  ),
  query_tokens as (
    select distinct
      token,
      case
        when token like '%ies' then regexp_replace(token, 'ies$', 'y')
        when token like '%s' and token not like '%ss' then regexp_replace(token, 's$', '')
        else token
      end as singular_token
    from expanded,
      lateral regexp_split_to_table(expanded.expanded_query, '\s+') as token
    where token <> ''
      and token not in ('a', 'an', 'and', 'for', 'the', 'to', 'with', 'of')
  ),
  query_flags as (
    select
      expanded.*,
      (
        raw_query ~ '(^| )(tempo|pause|paused|lengthened|shortened|partial|constant|tension|dead stop|slow concentric|isometric|hold|one and a half)( |$)'
        or raw_query ~ '(^| )[0-9]+ [0-9]+ [0-9]+( |$)'
        or raw_query ~ '(^| )1 5( |$)'
      ) as style_requested,
      raw_query ~ '(^| )(pause|paused)( |$)' as pause_requested,
      (
        raw_query ~ '(^| )tempo( |$)'
        or raw_query ~ '(^| )[0-9]+ [0-9]+ [0-9]+( |$)'
      ) as tempo_requested,
      raw_query ~ '(^| )partial( |$)' as partial_requested,
      raw_query ~ '(^| )(constant|tension)( |$)' as tension_requested,
      raw_query ~ '(^| )dead stop( |$)' as dead_stop_requested,
      raw_query ~ '(^| )(slow|concentric)( |$)' as slow_concentric_requested,
      raw_query ~ '(^| )(isometric|hold)( |$)' as isometric_requested,
      (
        raw_query ~ '(^| )1 5( |$)'
        or raw_query ~ '(^| )one and a half( |$)'
      ) as one_and_a_half_requested,
      raw_query ~ '(^| )lengthened( |$)' as lengthened_requested,
      raw_query ~ '(^| )shortened( |$)' as shortened_requested
    from expanded
  ),
  searchable as (
    select
      variant.*,
      variant.search_normalized_name as normalized_name,
      variant.search_normalized_aliases as normalized_aliases,
      variant.search_text as searchable_text
    from public.exercise_variants_v2 as variant
    cross join query_flags
    where variant.is_active
      and (
        variant.execution_style is null
        or (
          query_flags.style_requested
          and (
            (query_flags.pause_requested and variant.execution_style like '%pause%')
            or (query_flags.tempo_requested and variant.execution_style like '%tempo%')
            or (query_flags.partial_requested and variant.execution_style like '%partial%')
            or (query_flags.tension_requested and variant.execution_style in ('constant-tension', 'legacy-constant-tension'))
            or (query_flags.dead_stop_requested and variant.execution_style in ('dead-stop', 'legacy-dead-stop'))
            or (
              query_flags.slow_concentric_requested
              and variant.execution_style in ('slow-concentric', 'legacy-slow-concentric')
            )
            or (query_flags.isometric_requested and variant.execution_style = 'legacy-isometric')
            or (query_flags.one_and_a_half_requested and variant.execution_style like '%1-5-rep%')
            or (query_flags.lengthened_requested and variant.execution_style like '%lengthened%')
            or (query_flags.shortened_requested and variant.execution_style like '%shortened%')
          )
        )
      )
  ),
  matched as (
    select
      candidate.*,
      array(select token from query_tokens order by token) as matched_terms,
      case
        when candidate.normalized_name = query_flags.expanded_query then 0
        when query_flags.expanded_query = any(candidate.normalized_aliases) then 1
        when candidate.normalized_name like query_flags.expanded_query || '%' then 2
        when exists (
          select 1
          from unnest(candidate.normalized_aliases) as alias(value)
          where alias.value like query_flags.expanded_query || '%'
        ) then 3
        when not exists (
          select 1
          from query_tokens
          where (' ' || candidate.searchable_text || ' ') not like '% ' || token || ' %'
            and (' ' || candidate.searchable_text || ' ') not like '% ' || singular_token || ' %'
        ) then 4
        when not exists (
          select 1
          from query_tokens
          where not exists (
            select 1
            from regexp_split_to_table(candidate.searchable_text, '\s+') as candidate_token(value)
            where length(token) >= 2
              and (
                candidate_token.value like token || '%'
                or candidate_token.value like singular_token || '%'
              )
          )
        ) then 5
        else 6
      end as match_tier
    from searchable as candidate
    cross join query_flags
    where query_flags.raw_query <> ''
      and exists (select 1 from query_tokens)
      and not exists (
        select 1
        from query_tokens
        where not (
          (' ' || candidate.searchable_text || ' ') like '% ' || token || ' %'
          or (' ' || candidate.searchable_text || ' ') like '% ' || singular_token || ' %'
          or exists (
            select 1
            from regexp_split_to_table(candidate.searchable_text, '\s+') as candidate_token(value)
            where length(token) >= 2
              and (
                candidate_token.value like token || '%'
                or candidate_token.value like singular_token || '%'
              )
          )
          or (
            length(token) >= 4
            and (
              extensions.word_similarity(token, candidate.searchable_text) >= 0.72
              or extensions.word_similarity(singular_token, candidate.searchable_text) >= 0.72
            )
          )
        )
      )
  )
  select
    candidate.id,
    candidate.name,
    candidate.family,
    candidate.aliases,
    candidate.mechanics,
    candidate.execution_style,
    candidate.matched_terms
  from matched as candidate
  cross join query_flags
  order by
    candidate.match_tier,
    case when candidate.searchable_text like '%' || query_flags.expanded_query || '%' then 0 else 1 end,
    case when candidate.execution_style is null then 0 else 1 end,
    extensions.similarity(candidate.searchable_text, query_flags.expanded_query) desc,
    length(candidate.normalized_name),
    candidate.normalized_name,
    candidate.id
  limit (select result_limit from query_flags);
$$;

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
  from public.search_exercise_variants_v2(
    p_query,
    least(greatest(coalesce(p_limit, 12), 1), 12)
  ) as result;
$$;

grant usage on schema extensions to anon, authenticated;
revoke all on function public.search_exercise_variants_v2(text, integer) from public;
grant execute on function public.search_exercise_variants_v2(text, integer) to anon, authenticated;
revoke all on function public.search_exercise_variants(text, integer) from public;
grant execute on function public.search_exercise_variants(text, integer) to anon, authenticated;
