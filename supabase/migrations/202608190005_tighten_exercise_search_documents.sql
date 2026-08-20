-- Keep exercise-name search about the named movement. Broad category and
-- movement-family metadata can combine into plausible but wrong matches such
-- as "leg extension" -> "Single Leg Hip Thrust".
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
              new.mechanics ->> 'equipmentClass',
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

-- Rebuild every persisted document through the maintenance trigger.
update public.exercise_variants_v2
set name = name;
