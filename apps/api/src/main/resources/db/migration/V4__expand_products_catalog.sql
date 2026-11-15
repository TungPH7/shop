-- =====================================================================
-- V4__expand_products_catalog.sql
-- The expand step of app.products for the product catalog (SHOP-7, TW1;
-- ADR-0001, ADR-0002; plan of SHOP-7, section Database Changes):
--   - price_vnd and compare_at_price_vnd: whole dong, BIGINT (NFR14);
--   - status (ACTIVE | HIDDEN) and availability (IN_STOCK | OUT_OF_STOCK);
--   - app.search_fold(text) and the generated column name_search, for the
--     accent-insensitive search;
--   - a trigger that keeps the legacy price and price_vnd in step both
--     ways, so v0.2.0 reads and writes right on this schema, during the
--     switch and after a rollback (NFR17, NFR22).
--
-- Only adds: price NUMERIC(12,2), its CHECK products_price_non_negative,
-- name VARCHAR(255), slug citext with products_slug_unique, the index and
-- the updated_at trigger of V3 stay as they are. A later release (v0.4.0
-- at the earliest) drops the legacy price, its CHECK and the trigger of
-- step 5, once no rollback to v0.2.0 is needed.
--
-- No index: 10,000 rows scan in a few ms; the NFR2 test of SHOP-14 decides
-- whether a later migration adds a GIN index on name_search.
--
-- Flyway runs the whole file in one transaction (PostgreSQL DDL is
-- transactional): a failure anywhere leaves V3 as it was, with
-- trg_products_set_updated_at on. The lock of the first ALTER TABLE is held
-- until the end of the file (NFR17: under 10 s with 10,000 rows).
--
-- Schema qualification: the JDBC URL sets currentSchema=app, so the file
-- runs with search_path = app only. Every object of this file is
-- qualified with app; the functions it calls live in pg_catalog.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Four new columns; price_vnd allows NULL until step 3
-- ---------------------------------------------------------------------
-- A constant DEFAULT does not rewrite the table (PostgreSQL 11+), and it
-- fills the old rows: every one is IN_STOCK, and ACTIVE until step 2.
-- price_vnd never gets a DEFAULT: the trigger of step 5 tells an INSERT of
-- v0.2.0, which does not know the column, by its NULL.
ALTER TABLE app.products
    ADD COLUMN price_vnd            BIGINT,
    ADD COLUMN compare_at_price_vnd BIGINT,
    ADD COLUMN status               VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN availability         VARCHAR(16) NOT NULL DEFAULT 'IN_STOCK';

-- ---------------------------------------------------------------------
-- 2. Fill the old rows, with the updated_at trigger off
-- ---------------------------------------------------------------------
-- Product Rules ("Sản phẩm có từ trước Epic này") and NFR16: the old price
-- keeps its number, read as dong and rounded to the dong (half away from
-- zero, as round(numeric) does). A rounded price of 0, or above
-- 999,999,999 (V3 takes up to 9,999,999,999.99), hides the product.
--
-- trg_products_set_updated_at would set updated_at = now() on every row;
-- updated_at is the lastmod of the sitemap, and moving data is not a change
-- of the product. The version column is left as it is for the same reason.
ALTER TABLE app.products DISABLE TRIGGER trg_products_set_updated_at;

UPDATE app.products
   SET price_vnd = round(price)::BIGINT,
       status    = CASE
                       WHEN round(price) = 0 OR round(price) > 999999999 THEN 'HIDDEN'
                       ELSE 'ACTIVE'
                   END;

ALTER TABLE app.products ENABLE TRIGGER trg_products_set_updated_at;

-- ---------------------------------------------------------------------
-- 3. NOT NULL on price_vnd, then the CHECK constraints (NFR15)
-- ---------------------------------------------------------------------
-- products_price_vnd_valid: 0 or above 999,999,999 only on a hidden
-- product, so NFR15 ("price 0 only on a hidden product") and NFR16 (an old
-- price above 999,999,999 is kept, hidden) both hold, and a product on sale
-- always has a valid price.
ALTER TABLE app.products
    ALTER COLUMN price_vnd SET NOT NULL,
    ADD CONSTRAINT products_price_vnd_valid
        CHECK (price_vnd >= 0 AND (status = 'HIDDEN' OR price_vnd BETWEEN 1 AND 999999999)),
    ADD CONSTRAINT products_compare_at_price_valid
        CHECK (compare_at_price_vnd IS NULL
               OR (compare_at_price_vnd > price_vnd AND compare_at_price_vnd <= 999999999)),
    ADD CONSTRAINT products_status_valid
        CHECK (status IN ('ACTIVE', 'HIDDEN')),
    ADD CONSTRAINT products_availability_valid
        CHECK (availability IN ('IN_STOCK', 'OUT_OF_STOCK'));

-- ---------------------------------------------------------------------
-- 4. app.search_fold and the generated column name_search (ADR-0002)
-- ---------------------------------------------------------------------
-- The fold, in this order: NFD, drop the combining marks U+0300–U+036F,
-- đ and Đ to d, lower case, every run of characters other than a–z and
-- 0–9 to one space, then no space at either end. Built-in functions only:
-- the extension unaccent is not installed, and unaccent() is STABLE.
-- ProductSearchTerms of api folds a keyword the same way (SHOP-14).
--
-- A SQL-standard body (RETURN ...) is parsed when the function is created,
-- so it does not depend on the search_path of the session that calls it.
-- normalize() needs a UTF8 database, as the database of the kit is.
--
-- Changing this function later does not recompute the stored values: such
-- a migration must drop and add name_search again.
CREATE FUNCTION app.search_fold(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE STRICT PARALLEL SAFE
RETURN btrim(
    regexp_replace(
        lower(
            translate(
                regexp_replace(normalize(input_text, NFD), '[\u0300-\u036f]', '', 'g'),
                'đĐ',
                'dd')),
        '[^a-z0-9]+',
        ' ',
        'g'));

COMMENT ON FUNCTION app.search_fold(TEXT) IS
    'Folds a text for the accent-insensitive search (ADR-0002): NFD, no combining marks, '
    'đ/Đ to d, lower case, each run of non a-z0-9 to one space, trimmed. '
    'ProductSearchTerms of api folds keywords the same way.';

-- A space on each side, so "a word of the name starts with w" is
-- name_search LIKE '% w%'. Generated, so the rows v0.2.0 writes get it too
-- (NFR17). Adding a stored generated column rewrites the table; a rewrite
-- fires no trigger, so updated_at stays as it is.
ALTER TABLE app.products
    ADD COLUMN name_search TEXT GENERATED ALWAYS AS (' ' || app.search_fold(name) || ' ') STORED;

COMMENT ON COLUMN app.products.price_vnd            IS 'Selling price in whole dong, BIGINT (NFR14). 0 or above 999,999,999 only on a HIDDEN product (NFR16).';
COMMENT ON COLUMN app.products.compare_at_price_vnd IS 'Compare-at price in whole dong, above price_vnd and at most 999,999,999; NULL when none.';
COMMENT ON COLUMN app.products.status               IS 'ACTIVE (on sale, shoppers see it) or HIDDEN.';
COMMENT ON COLUMN app.products.availability         IS 'IN_STOCK or OUT_OF_STOCK. An OUT_OF_STOCK product stays in the store list.';
COMMENT ON COLUMN app.products.name_search          IS 'Generated: '' '' || app.search_fold(name) || '' ''. Search matches the start of a word with LIKE ''% word%''.';
COMMENT ON COLUMN app.products.price                IS 'Legacy price, numeric(12,2), kept for v0.2.0 (NFR22) and synced with price_vnd by trg_products_sync_legacy_price. Dropped by the contract step.';

-- ---------------------------------------------------------------------
-- 5. The trigger that keeps price and price_vnd in step (ADR-0001)
-- ---------------------------------------------------------------------
-- Each version writes one of the two price columns: the entity of v0.2.0
-- maps price only, the entity of v0.3.0 maps price_vnd and not price.
--
-- | Statement | Written by              | Told by                         | The trigger                       |
-- |-----------|-------------------------|---------------------------------|-----------------------------------|
-- | INSERT    | v0.2.0                  | price_vnd is NULL               | derives the new columns (below)   |
-- | INSERT    | v0.3.0                  | price_vnd is set, price NULL    | price := price_vnd                |
-- | UPDATE    | v0.3.0                  | price_vnd changes               | price := price_vnd                |
-- | UPDATE    | v0.2.0 (price, bulk)    | price changes, price_vnd not    | derives the new columns (below)   |
-- | UPDATE    | anything else           | neither price column changes    | nothing                           |
--
-- Deriving the new columns from a price v0.2.0 wrote, as step 2 did:
--   price_vnd := round(price); a price of 0 or above 999,999,999 hides the
--   product; a compare-at price no longer above the new price is dropped,
--   since v0.2.0 does not know it. A hidden product stays hidden when
--   v0.2.0 gives it a valid price again: an admin puts it back on sale.
--
-- A statement that writes both columns (only raw SQL does) is treated as
-- one of v0.3.0: price_vnd wins and price follows it.
--
-- NOT NULL and CHECK constraints are checked after BEFORE triggers, so the
-- statements above pass them.
CREATE FUNCTION app.products_sync_legacy_price()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    new_price_written    BOOLEAN;
    legacy_price_written BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' THEN
        new_price_written    := NEW.price_vnd IS NOT NULL;
        legacy_price_written := NOT new_price_written;
    ELSE
        new_price_written    := NEW.price_vnd IS DISTINCT FROM OLD.price_vnd;
        legacy_price_written := NOT new_price_written AND NEW.price IS DISTINCT FROM OLD.price;
    END IF;

    IF new_price_written THEN
        NEW.price := NEW.price_vnd;
    ELSIF legacy_price_written THEN
        NEW.price_vnd := round(NEW.price)::BIGINT;
        IF NEW.price_vnd = 0 OR NEW.price_vnd > 999999999 THEN
            NEW.status := 'HIDDEN';
        END IF;
        IF NEW.compare_at_price_vnd <= NEW.price_vnd THEN
            NEW.compare_at_price_vnd := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION app.products_sync_legacy_price() IS
    'BEFORE INSERT OR UPDATE trigger function of app.products (ADR-0001): keeps the legacy price '
    'and price_vnd in step for v0.2.0 and v0.3.0. Dropped by the contract step (v0.4.0 at the earliest).';

CREATE TRIGGER trg_products_sync_legacy_price
    BEFORE INSERT OR UPDATE ON app.products
    FOR EACH ROW
    EXECUTE FUNCTION app.products_sync_legacy_price();

COMMENT ON TRIGGER trg_products_sync_legacy_price ON app.products IS
    'Expand/contract of the price (ADR-0001): v0.2.0 writes price, v0.3.0 writes price_vnd; this keeps the other one right.';

-- ---------------------------------------------------------------------
-- 6. Log
-- ---------------------------------------------------------------------
INSERT INTO app._app_migration_log (migration_name, notes)
VALUES (
    'V4__expand_products_catalog',
    'Expand of app.products (SHOP-13): price_vnd, compare_at_price_vnd BIGINT, status, availability '
    'with their CHECKs; app.search_fold() and generated name_search; trigger trg_products_sync_legacy_price '
    'keeping the legacy price in step. Old rows: round(price), HIDDEN when 0 or above 999,999,999; '
    'updated_at unchanged.'
);
