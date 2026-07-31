-- The mock membership experiment has already been applied in production.
-- Remove only its payment objects while preserving the unrelated onboarding
-- defaults from migration 202607250035.
drop function if exists public.reserve_analysis_session(uuid, uuid);
drop table if exists public.user_memberships;
