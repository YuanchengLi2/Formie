alter table public.exercise_variants_v2
  add column if not exists catalog_version text not null default 'criteria-catalog-v5';

alter table public.exercise_criteria_v2
  add column if not exists catalog_version text not null default 'criteria-catalog-v5';

create index if not exists exercise_variants_catalog_version_idx
  on public.exercise_variants_v2 (catalog_version);

create index if not exists exercise_criteria_catalog_version_idx
  on public.exercise_criteria_v2 (catalog_version);

comment on column public.exercise_variants_v2.catalog_version is 'Catalog release that last upserted this exact exercise variation.';
comment on column public.exercise_criteria_v2.catalog_version is 'Catalog release that last upserted this exact criterion.';
