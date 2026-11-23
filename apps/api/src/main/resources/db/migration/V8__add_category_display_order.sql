-- =====================================================================
-- V8__add_category_display_order.sql
-- The display order of categories (SHOP-96; SHOP-95, TW1; ADR-0006;
-- plan of SHOP-95, section Database Changes): one column,
-- app.categories.display_order, an integer from 0 to 9999, 0 by default.
-- A smaller number comes first; several categories may share a number,
-- and then they come by name, then by id.
--
-- The expand step only (NFR10 of SHOP-95): one column with a constant
-- DEFAULT and one CHECK. No UNIQUE and no index (NFR2): 200 categories
-- fit in a few pages, read whole and sorted in memory. No row is
-- UPDATEd, so updated_at, updated_by and version of every category stay
-- as they are: the deploy changes no lastmod of the sitemap, and an edit
-- form opened before it gets no 409 because of V8. V1-V7 and
-- app.products are not touched. The api before the Epic runs on this
-- schema:
--   - its Flyway knows V1-V7 (or V1-V6 for v0.3.0) and ignores V8 as a
--     "future" migration;
--   - ddl-auto: validate does not look at a column its entities do not
--     map;
--   - its entity Category writes INSERT and UPDATE with an explicit list
--     of columns, without display_order: a category it adds gets 0 from
--     the DEFAULT, and a category it edits keeps its number.
-- No contract step follows: nothing of V8 is ever dropped.
--
-- Flyway runs the whole file in one transaction. The ALTER TABLE locks
-- app.categories (ACCESS EXCLUSIVE) until the end of the file. The
-- DEFAULT is a constant, so PostgreSQL 17 does not rewrite the table; it
-- only reads the existing rows to check the CHECK (under 1 s with 200
-- categories).
--
-- Schema qualification: the JDBC URL sets currentSchema=app, so the file
-- runs with search_path = app only. Every object is qualified with app.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Lock timeout
-- ---------------------------------------------------------------------
-- If a long transaction holds app.categories, V8 fails after 5 s and the
-- deploy stops, rather than every read of categories queueing behind it.
-- Flyway rolls the whole of V8 back, so the next deploy runs it again.
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 2. The column
-- ---------------------------------------------------------------------
ALTER TABLE app.categories
    ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0
        CONSTRAINT categories_display_order_range CHECK (display_order BETWEEN 0 AND 9999);

COMMENT ON COLUMN app.categories.display_order IS
    'Display order, 0-9999, 0 by default (ADR-0006): a smaller number comes first; equal numbers '
    'come by name (collation app.vi_ci), then id. Not UNIQUE, no index. Only admin sees the number.';

-- ---------------------------------------------------------------------
-- 3. Log
-- ---------------------------------------------------------------------
INSERT INTO app._app_migration_log (migration_name, notes)
VALUES (
    'V8__add_category_display_order',
    'Display order of categories (SHOP-96): app.categories.display_order INTEGER NOT NULL DEFAULT 0 '
    'with CHECK categories_display_order_range (0-9999), no UNIQUE, no index. Existing categories '
    'get 0; no row is updated.'
);
