-- Tighten SECURITY DEFINER RPCs found by the production database security advisor.
-- PostgreSQL grants EXECUTE to PUBLIC for new functions unless it is revoked explicitly.

revoke all on function public.get_my_access_status() from public, anon;
grant execute on function public.get_my_access_status() to authenticated;

revoke all on function public.cancel_analysis_reservation(uuid) from public, anon;
grant execute on function public.cancel_analysis_reservation(uuid) to authenticated;

-- This legacy validation helper is not called by the mobile client. Keep it available
-- to trusted backend jobs without exposing its SECURITY DEFINER privileges to users.
revoke all on function public.validate_active_analysis_credit_reservation() from public, anon, authenticated;
grant execute on function public.validate_active_analysis_credit_reservation() to service_role;

revoke all on function public.delete_stale_exercise_catalog_batch(text, text, integer) from public, anon, authenticated;
grant execute on function public.delete_stale_exercise_catalog_batch(text, text, integer) to service_role;
