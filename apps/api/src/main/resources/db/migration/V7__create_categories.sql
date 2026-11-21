-- =====================================================================
-- V7__create_categories.sql
-- One-level product categories (SHOP-81, TW1; ADR-0004, ADR-0005; plan
-- of SHOP-81, section Database Changes):
--   - the ICU collation app.vi_ci, for the Vietnamese order of category
--     names and their case-insensitive uniqueness, and a check that it
--     sorts Vietnamese before anything uses it;
--   - the table app.categories;
--   - the column app.products.category_id, a foreign key with ON DELETE
--     SET NULL, and its index.
--
-- The expand step only (NFR16): it adds one collation, one table, one
-- nullable column, one foreign key and one index, and changes no column,
-- constraint, trigger or index of app.products, the legacy price and
-- trg_products_sync_legacy_price included. v0.3.0 runs on this schema:
--   - its Flyway knows V1-V6 and ignores V7 as a "future" migration;
--   - ddl-auto: validate does not look at a table or a column its
--     entities do not map;
--   - its entity Product writes INSERT and UPDATE with an explicit list
--     of columns, without category_id: a product it adds has no category,
--     a product it edits keeps its category, and a product it deletes is
--     on the referencing side of the foreign key, so nothing stops it.
-- No contract step follows: nothing of V7 is ever dropped.
--
-- Flyway runs the whole file in one transaction. The ALTER TABLE of step
-- 4 locks app.products until the end of the file (NFR16: under 10 s with
-- 10,000 products). The new column has no DEFAULT, so the table is not
-- rewritten, and every existing product has no category.
--
-- Schema qualification: the JDBC URL sets currentSchema=app, so the file
-- runs with search_path = app only. Every object of this file is
-- qualified with app, and citext with public, as in V3.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The collation of category names (ADR-0005), then its check
-- ---------------------------------------------------------------------
-- ICU, level 2: upper and lower case are the same letter, accents are
-- not ("Áo" = "áo", "Áo" <> "Ao"). The Vietnamese tailoring sorts ă after
-- a and đ after d, which the root collation of ICU does not.
-- Not an extension: PostgreSQL 16 and later are built with ICU, and
-- CREATE COLLATION needs only CREATE on schema app, which the app user
-- owns (V1).
CREATE COLLATION app.vi_ci (provider = icu, locale = 'vi-u-ks-level2', deterministic = false);

COMMENT ON COLLATION app.vi_ci IS
    'ICU vi, level 2, nondeterministic (ADR-0005): Vietnamese alphabetical order, case-insensitive '
    'and accent-sensitive. Used by app.categories.name for ORDER BY and categories_name_unique. '
    'After an upgrade of PostgreSQL or ICU: REINDEX INDEX app.categories_name_unique.';

-- A database whose ICU has no data for vi falls back to the root
-- collation silently: stop here, before any table exists, with the first
-- rule that fails.
DO $$
DECLARE
    v_failed text;
BEGIN
    v_failed := CASE
        WHEN NOT ('Az'  <  'Ăn'  COLLATE app.vi_ci) THEN '''Az'' < ''Ăn'''
        WHEN NOT ('Dép' <  'Đầm' COLLATE app.vi_ci) THEN '''Dép'' < ''Đầm'''
        WHEN NOT ('áo'  =  'Áo'  COLLATE app.vi_ci) THEN '''áo'' = ''Áo'''
        WHEN NOT ('Ao'  <> 'Áo'  COLLATE app.vi_ci) THEN '''Ao'' <> ''Áo'''
    END;

    IF v_failed IS NOT NULL THEN
        RAISE EXCEPTION 'Collation app.vi_ci does not sort Vietnamese: % is false.', v_failed
            USING HINT = 'PostgreSQL lacks the ICU data of the locale vi. Use an image built with '
                         'full ICU data, such as postgres:17-alpine of deploy.yaml, then deploy again.';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. The table app.categories
-- ---------------------------------------------------------------------
-- The audit columns and their DEFAULTs are those of app.products (V3).
-- categories_slug_format runs ~ on slug::text: the ~ of citext ignores
-- case, so 'AO' would pass it.
CREATE TABLE app.categories (
    -- PK
    id          UUID            PRIMARY KEY DEFAULT app.gen_uuid_v7(),

    -- Business columns
    name        VARCHAR(60)     COLLATE app.vi_ci NOT NULL,
    slug        public.CITEXT   NOT NULL,
    status      VARCHAR(16)     NOT NULL DEFAULT 'VISIBLE',

    -- Audit columns (managed by BaseEntity; the DEFAULTs are a non-JPA fallback)
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    created_by  VARCHAR(64)     NOT NULL DEFAULT 'system',
    updated_by  VARCHAR(64)     NOT NULL DEFAULT 'system',
    version     BIGINT          NOT NULL DEFAULT 0,

    -- Business constraints (NFR14)
    CONSTRAINT categories_name_unique  UNIQUE (name),
    CONSTRAINT categories_slug_unique  UNIQUE (slug),
    CONSTRAINT categories_name_length  CHECK (char_length(name) BETWEEN 1 AND 60),
    CONSTRAINT categories_slug_format  CHECK (slug::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
                                              AND char_length(slug::text) <= 100),
    CONSTRAINT categories_status_valid CHECK (status IN ('VISIBLE', 'HIDDEN'))
);

COMMENT ON TABLE  app.categories            IS 'One-level product category (SHOP-81). A product has at most one, through app.products.category_id.';
COMMENT ON COLUMN app.categories.id         IS 'UUIDv7 (RFC 9562 §5.7), generated by Java @PrePersist or the DB DEFAULT app.gen_uuid_v7().';
COMMENT ON COLUMN app.categories.name       IS 'Name, 1-60 characters, collation app.vi_ci: Vietnamese order, UNIQUE ignoring case but not accents (ADR-0005).';
COMMENT ON COLUMN app.categories.slug       IS 'URL-friendly identifier, case-insensitive (public.citext), UNIQUE, lower-case format checked. Apart from the slugs of products.';
COMMENT ON COLUMN app.categories.status     IS 'VISIBLE (shoppers see it) or HIDDEN.';
COMMENT ON COLUMN app.categories.updated_at IS 'When the row was last updated. JPA @LastModifiedDate plus the app.set_updated_at() trigger (defense-in-depth).';
COMMENT ON COLUMN app.categories.version    IS 'Optimistic locking @Version. Hibernate injects WHERE version=? in UPDATE statements.';

-- ---------------------------------------------------------------------
-- 3. Trigger: app.set_updated_at() (V2) for BEFORE UPDATE, as on app.products
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_categories_set_updated_at
    BEFORE UPDATE ON app.categories
    FOR EACH ROW
    EXECUTE FUNCTION app.set_updated_at();

COMMENT ON TRIGGER trg_categories_set_updated_at ON app.categories IS
    'Defense-in-depth for updated_at: any UPDATE (JPA or direct SQL) sets updated_at = now().';

-- ---------------------------------------------------------------------
-- 4. The category of a product (ADR-0004)
-- ---------------------------------------------------------------------
-- ON DELETE SET NULL: the DELETE of a category sets category_id of its
-- products to NULL in the same statement and transaction (NFR15). That
-- UPDATE fires trg_products_set_updated_at, so updated_at of those
-- products becomes the instant of the delete, and leaves version as it
-- is; trg_products_sync_legacy_price runs and changes nothing, since no
-- price changes. Checking the foreign key on the existing rows reads
-- only NULLs.
ALTER TABLE app.products
    ADD COLUMN category_id UUID
        CONSTRAINT products_category_fk REFERENCES app.categories (id) ON DELETE SET NULL;

-- For the SET NULL of a delete, the product count of a category and the
-- page of a category. No composite index: the NFR2 test of SHOP-82
-- decides, and a later migration may add one safely.
CREATE INDEX idx_products_category_id
    ON app.products (category_id);

COMMENT ON COLUMN app.products.category_id IS
    'The category of the product, NULL when none. Set to NULL by products_category_fk when the category is deleted.';
COMMENT ON CONSTRAINT products_category_fk ON app.products IS
    'ON DELETE SET NULL (ADR-0004): deleting a category leaves its products without one, never deletes them.';

-- ---------------------------------------------------------------------
-- 5. Log
-- ---------------------------------------------------------------------
INSERT INTO app._app_migration_log (migration_name, notes)
VALUES (
    'V7__create_categories',
    'Categories (SHOP-82): collation app.vi_ci (ICU vi, level 2) and its check; app.categories with '
    'name UNIQUE, slug citext UNIQUE, CHECKs of name, slug format and status, trigger '
    'trg_categories_set_updated_at; app.products.category_id with products_category_fk ON DELETE SET NULL '
    'and idx_products_category_id. Existing products have no category.'
);
