package com.tungph7.learnpostgres.feature.product.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.simple.JdbcClient;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;

/**
 * V4, the expand step of {@code app.products} (SHOP-13; plan of SHOP-7, Database Changes; ADR-0001,
 * ADR-0002): run on a V3 database that holds Production-like rows, then each row is checked against
 * the Product Rules and NFR16.
 */
class V4ExpandProductsCatalogMigrationTest extends AbstractContainerBaseTest {

  private static final String V4_LOG_NAME = "V4__expand_products_catalog";

  /** The legacy columns of V3, which V4 must leave as they were on every row. */
  private static final String LEGACY_COLUMNS =
      "id, name, slug, price, description, created_at, updated_at, created_by, updated_by, version";

  /**
   * 'Áo ' 85 times: 255 characters, the longest name V3 takes. Its folded form is 'ao' 85 times.
   */
  private static final String NAME_OF_255 = "Áo ".repeat(85);

  private MigrationDatabase db;
  private JdbcClient jdbc;

  @BeforeEach
  void createV3Database() {
    db = MigrationDatabase.create(POSTGRES);
    jdbc = db.jdbc();
    db.flyway(MigrationDatabase.V3).migrate();
  }

  @AfterEach
  void dropDatabase() {
    db.close();
  }

  // ============================================================
  // Production-like rows: each one after V4
  // ============================================================

  /** A row as v0.2.0 wrote it, and what V4 must make of it. */
  private record LegacyRow(
      String name,
      String slug,
      String price,
      String description,
      long expectedPriceVnd,
      String expectedStatus,
      String expectedNameSearch) {}

  private static final List<LegacyRow> PRODUCTION_LIKE_ROWS =
      List.of(
          // The five products of SHOP-12 (T5), as on Staging and Production.
          new LegacyRow(
              "Áo thun cổ tròn",
              "ao-thun-co-tron",
              "250000.00",
              "Áo thun cotton 100%.\nCổ tròn, tay ngắn.",
              250_000L,
              "ACTIVE",
              " ao thun co tron "),
          new LegacyRow(
              "Quần jean nam",
              "quan-jean-nam",
              "450000.00",
              null,
              450_000L,
              "ACTIVE",
              " quan jean nam "),
          new LegacyRow(
              "Đầm maxi đỏ 2026",
              "dam-maxi-do-2026",
              "1250000.00",
              "Kích thước < 5 cm",
              1_250_000L,
              "ACTIVE",
              " dam maxi do 2026 "),
          new LegacyRow(
              "Combo 3 áo thun",
              "combo-3-ao",
              "399000.00",
              "Ba áo thun basic.",
              399_000L,
              "ACTIVE",
              " combo 3 ao thun "),
          new LegacyRow("Bao tay len", "bao-tay-len", "0.00", null, 0L, "HIDDEN", " bao tay len "),
          // NFR16: the largest price V3 takes is kept, rounded, and the product is hidden.
          new LegacyRow(
              "Máy ảnh cổ",
              "may-anh-co",
              "9999999999.99",
              null,
              10_000_000_000L,
              "HIDDEN",
              " may anh co "),
          // A price with a fraction is rounded to the dong, half up.
          new LegacyRow(
              "Khăn lụa", "khan-lua", "199999.50", "Lụa tơ tằm.", 200_000L, "ACTIVE", " khan lua "),
          // A name longer than 150 characters is kept: api checks 150 only when it is saved again.
          new LegacyRow(
              NAME_OF_255,
              "ten-dai-255",
              "120000.00",
              null,
              120_000L,
              "ACTIVE",
              " " + String.join(" ", Collections.nCopies(85, "ao")) + " "),
          // NFR16: a slug of the V3 format, which the new format refuses, is kept.
          new LegacyRow("Slug cũ", "-a--b-", "50000.00", null, 50_000L, "ACTIVE", " slug cu "),
          // Edges of the rounding: 0 and above 999,999,999 are hidden, the rest stay on sale.
          new LegacyRow("Giá lẻ nhỏ", "gia-le-nho", "0.49", null, 0L, "HIDDEN", " gia le nho "),
          new LegacyRow(
              "Giá một đồng", "gia-mot-dong", "0.50", null, 1L, "ACTIVE", " gia mot dong "),
          new LegacyRow(
              "Giá trần", "gia-tran", "999999999.49", null, 999_999_999L, "ACTIVE", " gia tran "),
          new LegacyRow(
              "Giá vượt trần",
              "gia-vuot-tran",
              "999999999.50",
              null,
              1_000_000_000L,
              "HIDDEN",
              " gia vuot tran "));

  @Test
  void each_production_like_row_gets_its_price_status_and_availability_and_keeps_its_old_columns() {
    Map<String, UUID> idsBySlug = insertAsV020(PRODUCTION_LIKE_ROWS);
    Map<UUID, Map<String, Object>> before = legacyColumnsById();

    db.flyway().migrate();

    assertThat(legacyColumnsById()).as("V3 columns, updated_at and version").isEqualTo(before);
    for (LegacyRow row : PRODUCTION_LIKE_ROWS) {
      Map<String, Object> after =
          jdbc.sql(
                  """
                  SELECT price_vnd, compare_at_price_vnd, status, availability, name_search
                    FROM app.products WHERE id = ?
                  """)
              .param(idsBySlug.get(row.slug()))
              .query()
              .singleRow();
      assertThat(after.get("price_vnd"))
          .as(row.slug() + " price_vnd")
          .isEqualTo(row.expectedPriceVnd());
      assertThat(after.get("compare_at_price_vnd"))
          .as(row.slug() + " compare_at_price_vnd")
          .isNull();
      assertThat(after.get("status")).as(row.slug() + " status").isEqualTo(row.expectedStatus());
      assertThat(after.get("availability")).as(row.slug() + " availability").isEqualTo("IN_STOCK");
      assertThat(after.get("name_search"))
          .as(row.slug() + " name_search")
          .isEqualTo(row.expectedNameSearch());
    }
  }

  @Test
  void the_updated_at_trigger_is_on_again_after_the_migration() {
    insertAsV020(PRODUCTION_LIKE_ROWS.subList(0, 1));

    db.flyway().migrate();

    assertThat(
            jdbc.sql(
                    """
                    SELECT tgenabled FROM pg_trigger
                     WHERE tgrelid = 'app.products'::regclass
                       AND tgname = 'trg_products_set_updated_at'
                    """)
                .query(String.class)
                .single())
        .isEqualTo("O");
    jdbc.sql("UPDATE app.products SET name = 'Áo thun cổ tròn mới' WHERE slug = 'ao-thun-co-tron'")
        .update();
    assertThat(
            jdbc.sql(
                    "SELECT updated_at > TIMESTAMPTZ '2026-11-14 02:00:00.123456+00' FROM"
                        + " app.products")
                .query(Boolean.class)
                .single())
        .as("an UPDATE after V4 still refreshes updated_at")
        .isTrue();
  }

  @Test
  void v4_writes_one_row_to_the_migration_log() {
    db.flyway().migrate();

    assertThat(
            jdbc.sql("SELECT count(*) FROM app._app_migration_log WHERE migration_name = ?")
                .param(V4_LOG_NAME)
                .query(Long.class)
                .single())
        .isEqualTo(1L);
  }

  // ============================================================
  // The schema after V4
  // ============================================================

  @Test
  void new_columns_have_the_types_nullability_and_defaults_of_the_plan() {
    db.flyway().migrate();

    Map<String, List<Object>> columns = new LinkedHashMap<>();
    jdbc.sql(
            """
            SELECT column_name, data_type, character_maximum_length, is_nullable,
                   column_default, is_generated
              FROM information_schema.columns
             WHERE table_schema = 'app' AND table_name = 'products'
            """)
        .query()
        .listOfRows()
        .forEach(
            row ->
                columns.put(
                    (String) row.get("column_name"),
                    Arrays.asList(
                        row.get("data_type"),
                        row.get("character_maximum_length"),
                        row.get("is_nullable"),
                        row.get("column_default"),
                        row.get("is_generated"))));

    // price_vnd has no default: the trigger tells a v0.2.0 INSERT by its NULL.
    assertThat(columns.get("price_vnd")).containsExactly("bigint", null, "NO", null, "NEVER");
    assertThat(columns.get("compare_at_price_vnd"))
        .containsExactly("bigint", null, "YES", null, "NEVER");
    assertThat(columns.get("status"))
        .containsExactly("character varying", 16, "NO", "'ACTIVE'::character varying", "NEVER");
    assertThat(columns.get("availability"))
        .containsExactly("character varying", 16, "NO", "'IN_STOCK'::character varying", "NEVER");
    assertThat(columns.get("name_search")).containsExactly("text", null, "YES", null, "ALWAYS");
    // Kept as V3 made them, for v0.2.0 and its ddl-auto: validate (NFR22).
    assertThat(columns.get("price")).containsExactly("numeric", null, "NO", null, "NEVER");
    assertThat(columns.get("name")).containsExactly("character varying", 255, "NO", null, "NEVER");
  }

  @Test
  void name_search_is_generated_from_search_fold_with_a_space_on_each_side() {
    db.flyway().migrate();

    assertThat(
            jdbc.sql(
                    """
                    SELECT generation_expression FROM information_schema.columns
                     WHERE table_schema = 'app' AND table_name = 'products'
                       AND column_name = 'name_search'
                    """)
                .query(String.class)
                .single())
        // PostgreSQL leaves out the schema app when it is on the search_path of the session.
        .matches(
            "\\(\\(' '::text \\|\\| (app\\.)?search_fold\\(\\(name\\)::text\\)\\) \\|\\| '"
                + " '::text\\)");
  }

  @Test
  void the_four_check_constraints_of_the_plan_exist_and_the_v3_ones_stay() {
    db.flyway().migrate();

    assertThat(
            jdbc.sql(
                    """
                    SELECT conname FROM pg_constraint
                     WHERE conrelid = 'app.products'::regclass AND contype IN ('c', 'u')
                    """)
                .query(String.class)
                .list())
        .containsExactlyInAnyOrder(
            "products_price_non_negative",
            "products_slug_unique",
            "products_price_vnd_valid",
            "products_compare_at_price_valid",
            "products_status_valid",
            "products_availability_valid");
  }

  @Test
  void v4_adds_no_index() {
    db.flyway().migrate();

    assertThat(
            jdbc.sql(
                    "SELECT indexname FROM pg_indexes WHERE schemaname = 'app' AND tablename ="
                        + " 'products'")
                .query(String.class)
                .list())
        .containsExactlyInAnyOrder(
            "products_pkey", "products_slug_unique", "idx_products_created_at_desc");
  }

  @Test
  void search_fold_is_immutable_strict_and_parallel_safe() {
    db.flyway().migrate();

    Map<String, Object> function =
        jdbc.sql(
                """
                SELECT provolatile::text AS volatility, proisstrict AS strict,
                       proparallel::text AS parallel
                  FROM pg_proc WHERE oid = 'app.search_fold(text)'::regprocedure
                """)
            .query()
            .singleRow();

    assertThat(function)
        .containsEntry("volatility", "i")
        .containsEntry("strict", true)
        .containsEntry("parallel", "s");
  }

  @Test
  void search_fold_drops_accents_and_case_and_turns_every_other_run_into_one_space() {
    db.flyway().migrate();

    Map<String, String> folds = new LinkedHashMap<>();
    folds.put("Áo thun cổ tròn", "ao thun co tron");
    folds.put("Đầm maxi đỏ 2026", "dam maxi do 2026");
    folds.put("Quần jean (Nam) – Slim", "quan jean nam slim");
    folds.put("  Combo   3 ÁO\tthun  ", "combo 3 ao thun");
    folds.put("ĐƯỜNG ổi Ữ ẵ ặ ợ", "duong oi u a a o");
    folds.put("100%_cotton\\x'y", "100 cotton x y");
    folds.put("!!!", "");
    folds.put("", "");
    folds.forEach(
        (name, folded) ->
            assertThat(
                    jdbc.sql("SELECT app.search_fold(?)").param(name).query(String.class).single())
                .as(name)
                .isEqualTo(folded));
    assertThat(jdbc.sql("SELECT app.search_fold(NULL) IS NULL").query(Boolean.class).single())
        .as("STRICT")
        .isTrue();
  }

  // ============================================================
  // NFR17: the whole file, on 10,000 rows, in one transaction
  // ============================================================

  @Test
  void v4_runs_on_ten_thousand_rows_in_under_ten_seconds() {
    insertGeneratedRowsAsV020(10_000);
    String updatedAtBefore = updatedAtDigest();

    long started = System.nanoTime();
    MigrateResult result = db.flyway(MigrationDatabase.V4).migrate();
    Duration took = Duration.ofNanos(System.nanoTime() - started);

    assertThat(result.migrationsExecuted).isEqualTo(1);
    assertThat(took).as("NFR17").isLessThan(Duration.ofSeconds(10));
    assertThat(updatedAtDigest()).isEqualTo(updatedAtBefore);
    assertThat(
            jdbc.sql(
                    """
                    SELECT count(*) FROM app.products
                     WHERE price_vnd <> round(price)
                        OR status <> CASE WHEN round(price) = 0 OR round(price) > 999999999
                                          THEN 'HIDDEN' ELSE 'ACTIVE' END
                        OR availability <> 'IN_STOCK'
                        OR compare_at_price_vnd IS NOT NULL
                        OR name_search <> ' ' || app.search_fold(name) || ' '
                    """)
                .query(Long.class)
                .single())
        .isZero();
  }

  @Test
  void a_v4_that_fails_while_the_updated_at_trigger_is_off_leaves_v3_as_it_was() {
    insertAsV020(PRODUCTION_LIKE_ROWS);
    Map<UUID, Map<String, Object>> before = legacyColumnsById();
    // Any UPDATE of the table fails: so does the backfill of V4, between the two ALTER TRIGGER.
    jdbc.sql(
            """
            CREATE FUNCTION app.refuse_update() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                RAISE EXCEPTION 'refused by the test';
            END;
            $$
            """)
        .update();
    jdbc.sql(
            """
            CREATE TRIGGER trg_test_refuse_update BEFORE UPDATE ON app.products
               FOR EACH ROW EXECUTE FUNCTION app.refuse_update()
            """)
        .update();

    assertThatThrownBy(() -> db.flyway().migrate()).isInstanceOf(FlywayException.class);

    assertThat(db.flyway().info().current().getVersion().getVersion()).isEqualTo("3");
    assertThat(
            jdbc.sql(
                    """
                    SELECT count(*) FROM information_schema.columns
                     WHERE table_schema = 'app' AND table_name = 'products'
                       AND column_name IN ('price_vnd', 'compare_at_price_vnd', 'status',
                                           'availability', 'name_search')
                    """)
                .query(Long.class)
                .single())
        .isZero();
    assertThat(
            jdbc.sql(
                    """
                    SELECT tgenabled FROM pg_trigger
                     WHERE tgrelid = 'app.products'::regclass
                       AND tgname = 'trg_products_set_updated_at'
                    """)
                .query(String.class)
                .single())
        .isEqualTo("O");
    assertThat(
            jdbc.sql("SELECT count(*) FROM app._app_migration_log WHERE migration_name = ?")
                .param(V4_LOG_NAME)
                .query(Long.class)
                .single())
        .isZero();
    assertThat(legacyColumnsById()).isEqualTo(before);
  }

  // ============================================================
  // Rollback to v0.2.0: its Flyway knows V1–V3 only
  // ============================================================

  @Test
  void flyway_of_v020_validates_and_migrates_a_database_that_has_v4(@TempDir Path folder) {
    db.flyway().migrate();
    Flyway v020 = db.flywayOfV020(folder);

    assertThat(v020.validateWithResult().validationSuccessful).isTrue();
    assertThat(v020.migrate().migrationsExecuted).isZero();
  }

  @Test
  void no_application_yml_sets_ignore_migration_patterns() throws IOException {
    Resource[] files =
        new PathMatchingResourcePatternResolver().getResources("classpath*:application*.yml");

    assertThat(files).isNotEmpty();
    for (Resource file : files) {
      assertThat(file.getContentAsString(StandardCharsets.UTF_8))
          .as(file.getFilename())
          .doesNotContainIgnoringCase("ignore-migration-patterns")
          .doesNotContainIgnoringCase("ignoreMigrationPatterns");
    }
  }

  // ============================================================
  // Helpers
  // ============================================================

  /**
   * INSERT with the column list Hibernate uses for the entity of v0.2.0, and fixed audit values.
   */
  private Map<String, UUID> insertAsV020(List<LegacyRow> rows) {
    Map<String, UUID> ids = new LinkedHashMap<>();
    int minute = 0;
    for (LegacyRow row : rows) {
      UUID id = UUID.randomUUID();
      jdbc.sql(
              """
INSERT INTO app.products
    (created_at, created_by, description, name, price, slug, updated_at, updated_by,
     version, id)
VALUES (TIMESTAMPTZ '2026-11-14 01:00:00+00' + make_interval(mins => ?), 'system', ?,
        ?, ?, ?, TIMESTAMPTZ '2026-11-14 02:00:00.123456+00' + make_interval(mins => ?),
        'system', ?, ?)
""")
          .params(minute, row.description(), row.name(), new BigDecimal(row.price()), row.slug())
          .param(minute)
          .param((long) minute % 3)
          .param(id)
          .update();
      ids.put(row.slug(), id);
      minute++;
    }
    return ids;
  }

  /** 10,000 rows like Production: accented names, long descriptions, prices of every kind. */
  private void insertGeneratedRowsAsV020(int count) {
    jdbc.sql(
            """
INSERT INTO app.products
    (created_at, created_by, description, name, price, slug, updated_at, updated_by,
     version, id)
SELECT TIMESTAMPTZ '2026-01-01 00:00:00+00' + make_interval(mins => g), 'system',
       CASE WHEN g % 3 = 0 THEN NULL ELSE repeat('Mô tả sản phẩm, dòng ' || g || E'.\\n', 20) END,
       'Áo thun Đặc Biệt số ' || g || ' – bản ' || (g % 7),
       CASE WHEN g % 50 = 0 THEN 0
            WHEN g % 97 = 0 THEN 9999999999.99
            ELSE (g * 1000 + 0.5)::numeric(12, 2) END,
       'san-pham-' || g,
       TIMESTAMPTZ '2026-02-01 00:00:00.000001+00' + make_interval(mins => g), 'system',
       g % 4, gen_random_uuid()
  FROM generate_series(1, ?) AS g
""")
        .param(count)
        .update();
  }

  private Map<UUID, Map<String, Object>> legacyColumnsById() {
    Map<UUID, Map<String, Object>> rows = new LinkedHashMap<>();
    jdbc.sql("SELECT " + LEGACY_COLUMNS + " FROM app.products ORDER BY id")
        .query()
        .listOfRows()
        .forEach(row -> rows.put((UUID) row.get("id"), row));
    return rows;
  }

  private String updatedAtDigest() {
    return jdbc.sql(
            "SELECT md5(string_agg(id::text || updated_at::text || version, ',' ORDER BY id)) FROM"
                + " app.products")
        .query(String.class)
        .single();
  }
}
