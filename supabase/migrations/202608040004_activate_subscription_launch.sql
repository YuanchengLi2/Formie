-- Turn on server-side subscription enforcement after the access schema exists.
-- The function preserves accounts that predate activation as legacy_unlimited and
-- is idempotent, so reapplying the migration cannot rewrite paid access rows.
select public.activate_subscription_launch();
