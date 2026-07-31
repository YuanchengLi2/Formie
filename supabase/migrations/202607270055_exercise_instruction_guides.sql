create table if not exists public.exercise_instruction_guides (
  exercise_id integer not null references public.exercise_variants_v2(id) on delete cascade,
  guide_version text not null,
  guide jsonb not null check (
    jsonb_typeof(guide) = 'object'
    and jsonb_typeof(guide -> 'setup') = 'array'
    and jsonb_typeof(guide -> 'execution') = 'array'
    and jsonb_typeof(guide -> 'safety') = 'array'
  ),
  provider_model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (exercise_id, guide_version)
);

alter table public.exercise_instruction_guides enable row level security;

revoke all on table public.exercise_instruction_guides from anon, authenticated;
grant select, insert, update, delete on table public.exercise_instruction_guides to service_role;
