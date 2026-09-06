-- The isolated production journey passed; remove its executable harness from
-- the public schema so only application RPCs remain exposed.
drop function if exists public.run_creator_program_live_acceptance();
