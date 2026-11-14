-- =====================================================================
-- V1__init.sql
-- Baseline migration — verify that the 'app' schema and required
-- extensions have already been created by the docker init script.
-- This migration does NOT create any business tables.
--
-- Preconditions (provided by docker/postgres/init/00-load-env.sh):
--   - Schema 'app' exists, owner = learn_postgres_user.
--   - Extensions uuid-ossp, pgcrypto, citext, pg_trgm are installed.
--   - search_path of learn_postgres_user = "app, public".
--
-- This migration:
--   1. Asserts the schema & extensions are present (fail-fast otherwise).
--   2. Creates the internal metadata table `_app_migration_log` to
--      demonstrate Flyway is working (internal — not a business table).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Assert preconditions
-- ---------------------------------------------------------------------

DO $$
BEGIN
    -- Schema 'app' must exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_namespace WHERE nspname = 'app'
    ) THEN
        RAISE EXCEPTION
            'Schema "app" missing. Run the docker init script first '
            '(docker compose down -v && docker compose up -d).';
    END IF;

    -- Required extensions
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
        RAISE EXCEPTION 'Required extension "uuid-ossp" missing.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
        RAISE EXCEPTION 'Required extension "pgcrypto" missing.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') THEN
        RAISE EXCEPTION 'Required extension "citext" missing.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        RAISE EXCEPTION 'Required extension "pg_trgm" missing.';
    END IF;

    RAISE NOTICE 'V1__init: prerequisites OK (schema "app" + 4 extensions).';
END $$;

-- ---------------------------------------------------------------------
-- 2. Internal metadata table — proves Flyway applied successfully
-- ---------------------------------------------------------------------

-- Internal table tracking schema changes with human-readable context,
-- separate from flyway_schema_history (which Flyway manages itself).
CREATE TABLE IF NOT EXISTS app._app_migration_log (
    id              BIGSERIAL PRIMARY KEY,
    applied_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    migration_name  TEXT        NOT NULL,
    notes           TEXT
);

COMMENT ON TABLE  app._app_migration_log IS
    'Internal log of significant schema changes — human-readable companion to flyway_schema_history.';
COMMENT ON COLUMN app._app_migration_log.migration_name IS
    'Matches the Flyway migration filename (e.g. V1__init).';

-- Insert the first row for V1
INSERT INTO app._app_migration_log (migration_name, notes)
VALUES (
    'V1__init',
    'Baseline migration: verified schema "app" + extensions (uuid-ossp, pgcrypto, citext, pg_trgm).'
);
