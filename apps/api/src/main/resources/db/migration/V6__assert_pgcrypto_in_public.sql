-- =====================================================================
-- V6__assert_pgcrypto_in_public.sql
-- Stops the deploy when app.gen_uuid_v7() cannot run (SHOP-50).
--
-- V5 makes app.gen_uuid_v7() call public.gen_random_bytes() (pgcrypto).
-- The body of a plpgsql function is resolved only when it runs: on a
-- database whose pgcrypto lives in another schema, V5 succeeds and the
-- function fails at the first INSERT without an id. This migration runs
-- on every database the release deploys to: it checks the function of
-- pgcrypto that app.gen_uuid_v7() calls, then calls app.gen_uuid_v7()
-- once, so such a database stops here, with a message that says why.
--
-- No schema change; V5 stays as it was (Flyway checks its checksum).
-- Rollback: a release without V6 does not know it and ignores it (Flyway
-- default *:future); there is nothing to undo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Assert that app.gen_uuid_v7() can run
-- ---------------------------------------------------------------------
DO $$
DECLARE
    v_schema text;
BEGIN
    IF to_regprocedure('public.gen_random_bytes(integer)') IS NULL THEN
        SELECT n.nspname INTO v_schema
          FROM pg_catalog.pg_extension e
          JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
         WHERE e.extname = 'pgcrypto';

        RAISE EXCEPTION
            'app.gen_uuid_v7() calls public.gen_random_bytes(), but extension pgcrypto is in schema "%", not "public".',
            coalesce(v_schema, '(not installed)')
            USING HINT = 'Move it: ALTER EXTENSION pgcrypto SET SCHEMA public; then deploy again.';
    END IF;

    PERFORM app.gen_uuid_v7();
END $$;

-- ---------------------------------------------------------------------
-- 2. Log
-- ---------------------------------------------------------------------
INSERT INTO app._app_migration_log (migration_name, notes)
VALUES (
    'V6__assert_pgcrypto_in_public',
    'Checked that pgcrypto provides public.gen_random_bytes() and that app.gen_uuid_v7() '
    'runs, so a database with pgcrypto elsewhere fails at the deploy (SHOP-50).'
);
