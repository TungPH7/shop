-- =====================================================================
-- Test-only DB init script — mirrors `docker/postgres/init/00-load-env.sh`
-- from production, simplified for Testcontainers.
--
-- Triggered by `PostgreSQLContainer.withInitScript("db/init/test-init.sql")`:
--   PostgreSQL container ready  ->  this script runs  ->  Flyway migrate
--   (V1__init.sql asserts the extensions + schema declared below).
--
-- Differences from the production init script:
--   - Does NOT create a dedicated app role (tests use the default 'test' superuser).
--   - Does NOT grant default privileges (the test user already has ALL).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE SCHEMA IF NOT EXISTS app;

-- Session search_path for the 'test' role — Hibernate/Flyway queries see schema 'app' by default.
ALTER ROLE test SET search_path TO app, public;
