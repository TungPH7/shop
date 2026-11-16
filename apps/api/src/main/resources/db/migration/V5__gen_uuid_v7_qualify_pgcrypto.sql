-- =====================================================================
-- V5__gen_uuid_v7_qualify_pgcrypto.sql
-- Fixes app.gen_uuid_v7() of V2 (SHOP-44): it called gen_random_bytes()
-- without a schema, while pgcrypto lives in schema public. The JDBC URL
-- sets currentSchema=app, so a session of the servers has
-- search_path = app only, and the function failed with
-- "function gen_random_bytes(integer) does not exist". JPA always sets the
-- id itself (UuidV7), so only an INSERT that bypasses JPA, such as a data
-- script, reached the DEFAULT of the primary keys and failed.
--
-- V2 stays as it was: Flyway checks its checksum. This file replaces the
-- function with the same signature, body and comment, calling
-- public.gen_random_bytes(); every other function it calls lives in
-- pg_catalog, which every search_path includes. CREATE OR REPLACE keeps
-- the owner, the grants and every DEFAULT that uses the function.
--
-- Rollback: v0.2.0 and v0.3.0 do not know V5 and ignore it (Flyway default
-- *:future); the function keeps its signature and only works in more
-- sessions, so no release needs V5 undone.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. UUIDv7 generator (RFC 9562 § 5.7), as in V2, pgcrypto qualified
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.gen_uuid_v7()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_ts_ms bigint;
    v_bytes bytea;
BEGIN
    v_ts_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;
    -- pgcrypto lives in schema public: qualify it, so any search_path works.
    v_bytes := public.gen_random_bytes(16);

    -- First 6 bytes = unix_ts_ms (big-endian)
    v_bytes := set_byte(v_bytes, 0, ((v_ts_ms >> 40) & 255)::int);
    v_bytes := set_byte(v_bytes, 1, ((v_ts_ms >> 32) & 255)::int);
    v_bytes := set_byte(v_bytes, 2, ((v_ts_ms >> 24) & 255)::int);
    v_bytes := set_byte(v_bytes, 3, ((v_ts_ms >> 16) & 255)::int);
    v_bytes := set_byte(v_bytes, 4, ((v_ts_ms >>  8) & 255)::int);
    v_bytes := set_byte(v_bytes, 5, ( v_ts_ms        & 255)::int);

    -- Byte 6: version = 7 (high 4 bits = 0111)
    v_bytes := set_byte(v_bytes, 6,
        ((get_byte(v_bytes, 6) & 15) | (7 << 4))::int);

    -- Byte 8: variant = '10' (high 2 bits)
    v_bytes := set_byte(v_bytes, 8,
        ((get_byte(v_bytes, 8) & 63) | 128)::int);

    RETURN encode(v_bytes, 'hex')::uuid;
END;
$$;

COMMENT ON FUNCTION app.gen_uuid_v7() IS
    'Generate UUIDv7 (RFC 9562 §5.7) — 48-bit ms timestamp prefix + random. '
    'Used as the DEFAULT for primary-key columns on business entities. '
    'Calls public.gen_random_bytes (pgcrypto), so it works with any search_path (V5, SHOP-44).';

-- ---------------------------------------------------------------------
-- 2. Log
-- ---------------------------------------------------------------------
INSERT INTO app._app_migration_log (migration_name, notes)
VALUES (
    'V5__gen_uuid_v7_qualify_pgcrypto',
    'Replaced app.gen_uuid_v7() to call public.gen_random_bytes(), so it works with '
    'search_path = app only, as the servers connect (SHOP-44).'
);
