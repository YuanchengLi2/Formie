-- Scalable criteria catalog, camera constraints, match audit, and retry state.

alter table public.exercise_variants_v2
  add column if not exists equipment_class text
  generated always as (mechanics ->> 'equipmentClass') stored;

alter table public.exercise_variants_v2
  add column if not exists execution_style text
  generated always as (mechanics ->> 'executionStyle') stored;

create index if not exists exercise_variants_v2_family_equipment_idx
  on public.exercise_variants_v2 (family, equipment_class)
  where is_active = true;

create index if not exists exercise_variants_v2_execution_style_idx
  on public.exercise_variants_v2 (execution_style)
  where is_active = true and execution_style is not null;

alter table public.exercise_criteria_v2
  add column if not exists camera_constraints jsonb not null default
  '{"perspective":"robust","allowedFraming":["full-body","partial-body"],"machineOcclusionSafe":false}'::jsonb;

alter table public.exercise_criteria_v2
  drop constraint if exists exercise_criteria_v2_camera_constraints_check;

alter table public.exercise_criteria_v2
  add constraint exercise_criteria_v2_camera_constraints_check check (
    jsonb_typeof(camera_constraints) = 'object'
    and camera_constraints ->> 'perspective' in ('robust', 'level-sensitive')
    and jsonb_typeof(camera_constraints -> 'allowedFraming') = 'array'
    and jsonb_typeof(camera_constraints -> 'machineOcclusionSafe') = 'boolean'
  );

create table if not exists public.exercise_catalog_seed_chunks (
  file text primary key,
  catalog_version text not null,
  kind text not null check (kind in ('variants', 'criteria')),
  row_count integer not null check (row_count > 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  applied_at timestamptz not null default now()
);

alter table public.exercise_catalog_seed_chunks enable row level security;
grant select, insert, update, delete on public.exercise_catalog_seed_chunks to service_role;

alter table public.analysis_sessions
  add column if not exists catalog_match_v3 jsonb;

alter table public.analysis_sessions
  add column if not exists stage_attempts_v3 jsonb not null default '{}'::jsonb;

create or replace function public.record_analysis_stage_failure(
  p_session_id uuid,
  p_stage text,
  p_error_code text,
  p_max_attempts integer default 2
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempts jsonb;
  next_attempt integer;
begin
  if p_stage is null or btrim(p_stage) = '' or p_max_attempts < 1 then
    raise exception 'Invalid stage failure input';
  end if;

  select stage_attempts_v3
    into current_attempts
    from public.analysis_sessions
    where id = p_session_id
    for update;

  if not found then
    raise exception 'Analysis session not found';
  end if;

  next_attempt := coalesce((current_attempts ->> p_stage)::integer, 0) + 1;
  update public.analysis_sessions
    set stage_attempts_v3 = jsonb_set(current_attempts, array[p_stage], to_jsonb(next_attempt), true),
        updated_at = now()
    where id = p_session_id;

  return jsonb_build_object(
    'attempts', next_attempt,
    'terminal', next_attempt >= p_max_attempts,
    'code', p_error_code
  );
end;
$$;

revoke all on function public.record_analysis_stage_failure(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.record_analysis_stage_failure(uuid, text, text, integer) to service_role;
