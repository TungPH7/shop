-- =====================================================================
-- V2__app_helpers.sql
-- Database-side helpers shared by every future entity:
--   1) app.gen_uuid_v7()  — native UUIDv7 generator (RFC 9562 § 5.7).
--   2) app.set_updated_at() — trigger function that sets
--      NEW.updated_at = now() BEFORE UPDATE (defense-in-depth for JPA Auditing).
--
-- Preconditions (already satisfied by V1):
--   - Schema 'app' exists.
--   - Extension pgcrypto is installed (needed for gen_random_bytes).
--   - search_path = "app, public".
--
-- Idempotent: uses CREATE OR REPLACE FUNCTION, so re-running is safe.
-- Flyway will not re-run V2 normally, but a manual rerun will not break.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. UUIDv7 generator
-- ---------------------------------------------------------------------
-- RFC 9562 § 5.7:
--   bytes 0..5  = unix_ts_ms (48 bit, big-endian)
--   byte  6     = (version=7 << 4) | (random & 0x0F)   ; version in high 4 bits
--   byte  8     = (variant=2 << 6) | (random & 0x3F)   ; variant '10' in high 2 bits
--   remaining bytes = random (already provided by gen_random_bytes).
--
-- VOLATILE: clock_timestamp() and gen_random_bytes() are non-deterministic.
-- Marking IMMUTABLE would be semantically wrong.
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
    v_bytes := gen_random_bytes(16);

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
    'Used as the DEFAULT for primary-key columns on business entities.';

-- ---------------------------------------------------------------------
-- 2. Trigger function: set NEW.updated_at = now() BEFORE UPDATE
-- ---------------------------------------------------------------------
-- This is the safety net for JPA Auditing:
--   - JPA @LastModifiedDate fills updated_at when save() flows through
--     the repository.
--   - Bulk updates via JPQL @Modifying, native queries or direct psql
--     do NOT fire the JPA listener, so updated_at would stay stale.
--   - This BEFORE UPDATE trigger guarantees updated_at = now() at the
--     database side, regardless of who issues the UPDATE.
--
-- Attach the trigger per business table in the corresponding migration
-- (V3 and beyond).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION app.set_updated_at() IS
    'BEFORE UPDATE trigger function — sets NEW.updated_at = now(). '
    'Attach to each business table: '
    'CREATE TRIGGER trg_<table>_set_updated_at BEFORE UPDATE ON app.<table> '
    'FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();';

-- ---------------------------------------------------------------------
-- 3. Log to _app_migration_log
-- ---------------------------------------------------------------------
INSERT INTO app._app_migration_log (migration_name, notes)
VALUES (
    'V2__app_helpers',
    'Created app.gen_uuid_v7() (UUIDv7 generator) and app.set_updated_at() '
    '(BEFORE UPDATE trigger function for audit defense-in-depth).'
);
