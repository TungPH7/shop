package com.tungph7.learnpostgres.feature.product.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.postgresql.util.PSQLException;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;

/**
 * V7, the categories (SHOP-82; plan of SHOP-81, Database Changes; ADR-0004, ADR-0005): the
 * collation {@code app.vi_ci}, the table {@code app.categories} and the column {@code
 * app.products.category_id}, checked on a V6 database as Production has it, then against NFR14,
 * NFR15, NFR16 and NFR17.
 */
class V7CreateCategoriesMigrationTest extends AbstractContainerBaseTest {

  private static final String V7_LOG_NAME = "V7__create_categories";

  /** Every column of {@code app.products} at V6: V7 must leave each of them as it was. */
  private static final String V6_COLUMNS =
      "id, name, slug, price, description, created_at, updated_at, created_by, updated_by,"
          + " version, price_vnd, compare_at_price_vnd, status, availability, name_search";

  /**
   * The INSERT Hibernate writes for {@code Product} in {@code v0.3.0}, copied from the SQL log of
   * {@code AdminProductServiceIntegrationTest} at the first commit of SHOP-82, when the code of
   * products was still that of the tag.
   */
  private static final String V030_INSERT =
      "insert into app.products (availability,compare_at_price_vnd,created_at,created_by,"
          + "description,name,price_vnd,slug,status,updated_at,updated_by,version,id)"
          + " values (?,?,?,?,?,?,?,?,?,?,?,?,?)";

  /** The UPDATE of {@code v0.3.0}, from the log of {@code AdminProductEditIntegrationTest}. */
  private static final String V030_UPDATE =
      "update app.products set availability=?,compare_at_price_vnd=?,description=?,name=?,"
          + "price_vnd=?,slug=?,status=?,updated_at=?,updated_by=?,version=?"
          + " where id=? and version=?";

  /**
   * The DELETE of {@code v0.3.0}, from the log of {@code AdminProductListDeleteIntegrationTest}.
   */
  private static final String V030_DELETE = "delete from app.products p1_0 where p1_0.id=?";

  /** The image of the database in {@code deploy.yaml}: {@code postgres:17-alpine} by digest. */
  private static final Pattern DEPLOY_IMAGE =
      Pattern.compile("image:\\s*postgres:17-alpine@(sha256:[0-9a-f]{64})");

  private static final OffsetDateTime CREATED =
      OffsetDateTime.of(2026, 11, 1, 1, 0, 0, 0, ZoneOffset.UTC);
  private static final OffsetDateTime UPDATED =
      OffsetDateTime.of(2026, 11, 14, 2, 0, 0, 123_456_000, ZoneOffset.UTC);

  private MigrationDatabase db;
  private JdbcClient jdbc;

  @BeforeEach
  void createV6Database() {
    db = MigrationDatabase.create(POSTGRES);
    jdbc = db.jdbc();
    db.flyway(MigrationDatabase.V6).migrate();
  }

  @AfterEach
  void dropDatabase() {
    db.close();
  }

  // ============================================================
  // The collation, on the image the deployer runs
  // ============================================================

  @Test
  void v7_runs_and_its_collation_check_passes_on_the_postgres_image_of_deploy_yaml()
      throws IOException {
    DockerImageName image =
        DockerImageName.parse("postgres@" + deployImageDigest())
            .asCompatibleSubstituteFor("postgres");
    try (PostgreSQLContainer deployed = new PostgreSQLContainer(image)) {
      deployed.start();
      try (MigrationDatabase onDeployed = MigrationDatabase.create(deployed)) {
        MigrateResult result = onDeployed.flyway().migrate();

        assertThat(result.targetSchemaVersion).isEqualTo(MigrationDatabase.V7);
        assertThat(
                onDeployed
                    .jdbc()
                    .sql(
                        """
                        SELECT 'Az' < 'Ăn' COLLATE app.vi_ci
                           AND 'Dép' < 'Đầm' COLLATE app.vi_ci
                           AND 'áo' = 'Áo' COLLATE app.vi_ci
                           AND 'Ao' <> 'Áo' COLLATE app.vi_ci
                        """)
                    .query(Boolean.class)
                    .single())
            .isTrue();
      }
    }
  }

  @Test
  void v7_writes_one_row_to_the_migration_log() {
    db.flyway().migrate();

    assertThat(
            jdbc.sql("SELECT count(*) FROM app._app_migration_log WHERE migration_name = ?")
                .param(V7_LOG_NAME)
                .query(Long.class)
                .single())
        .isEqualTo(1L);
  }

  // ============================================================
  // Production-like data (NFR16)
  // ============================================================

  @Test
  void v7_runs_on_production_like_rows_in_under_ten_seconds_and_leaves_every_product_as_it_was() {
    insertTheFiveProductsOfShop12();
    insertGeneratedProducts(10_000);
    String before = digestOfV6Columns();

    long started = System.nanoTime();
    MigrateResult result = db.flyway().migrate();
    Duration took = Duration.ofNanos(System.nanoTime() - started);

    assertThat(result.migrationsExecuted).isEqualTo(1);
    assertThat(took).as("NFR16").isLessThan(Duration.ofSeconds(10));
    assertThat(digestOfV6Columns()).as("every column of V6, updated_at too").isEqualTo(before);
    assertThat(count("SELECT count(*) FROM app.products")).isEqualTo(10_005L);
    assertThat(count("SELECT count(*) FROM app.products WHERE category_id IS NOT NULL")).isZero();
  }

  @Test
  void the_legacy_price_trigger_still_runs_after_v7() {
    insertTheFiveProductsOfShop12();
    db.flyway().migrate();

    jdbc.sql("UPDATE app.products SET price_vnd = 260000 WHERE slug = 'ao-thun-co-tron'").update();
    jdbc.sql(
            """
            INSERT INTO app.products (id, name, slug, price, description)
            VALUES (gen_random_uuid(), 'Khăn của v0.2.0', 'khan-v020', 99000.40, NULL)
            """)
        .update();

    assertThat(
            jdbc.sql("SELECT price FROM app.products WHERE slug = 'ao-thun-co-tron'")
                .query(String.class)
                .single())
        .isEqualTo("260000.00");
    assertThat(
            jdbc.sql("SELECT price_vnd FROM app.products WHERE slug = 'khan-v020'")
                .query(Long.class)
                .single())
        .isEqualTo(99_000L);
  }

  // ============================================================
  // The schema after V7
  // ============================================================

  @Test
  void categories_has_the_columns_of_the_plan() {
    db.flyway().migrate();

    Map<String, List<Object>> columns = new LinkedHashMap<>();
    jdbc.sql(
            """
            SELECT column_name, data_type, character_maximum_length, is_nullable,
                   column_default, collation_name
              FROM information_schema.columns
             WHERE table_schema = 'app' AND table_name = 'categories'
             ORDER BY ordinal_position
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
                        row.get("collation_name"))));

    assertThat(columns.keySet())
        .containsExactly(
            "id",
            "name",
            "slug",
            "status",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "version");
    assertThat(columns.get("id")).startsWith("uuid", null, "NO");
    assertThat((String) columns.get("id").get(3)).endsWith("gen_uuid_v7()");
    assertThat(columns.get("name")).containsExactly("character varying", 60, "NO", null, "vi_ci");
    assertThat(columns.get("slug")).containsExactly("USER-DEFINED", null, "NO", null, null);
    assertThat(columns.get("status"))
        .containsExactly("character varying", 16, "NO", "'VISIBLE'::character varying", null);
    assertThat(columns.get("version")).containsExactly("bigint", null, "NO", "0", null);
  }

  @Test
  void category_id_is_a_nullable_uuid_without_default_with_its_foreign_key_and_index() {
    db.flyway().migrate();

    assertThat(
            jdbc.sql(
                    """
                    SELECT data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '-')
                      FROM information_schema.columns
                     WHERE table_schema = 'app' AND table_name = 'products'
                       AND column_name = 'category_id'
                    """)
                .query(String.class)
                .single())
        .isEqualTo("uuid YES -");
    assertThat(
            jdbc.sql(
                    """
                    SELECT pg_get_constraintdef(oid) FROM pg_constraint
                     WHERE conrelid = 'app.products'::regclass
                       AND conname = 'products_category_fk'
                    """)
                .query(String.class)
                .single())
        .isEqualTo("FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL");
    assertThat(
            jdbc.sql(
                    """
                    SELECT indexdef FROM pg_indexes
                     WHERE schemaname = 'app' AND indexname = 'idx_products_category_id'
                    """)
                .query(String.class)
                .single())
        .isEqualTo(
            "CREATE INDEX idx_products_category_id ON app.products USING btree (category_id)");
  }

  @Test
  void the_constraints_of_categories_are_those_of_the_plan() {
    db.flyway().migrate();

    assertThat(
            jdbc.sql(
                    """
                    SELECT conname FROM pg_constraint
                     WHERE conrelid = 'app.categories'::regclass AND contype IN ('c', 'u', 'p')
                    """)
                .query(String.class)
                .list())
        .containsExactlyInAnyOrder(
            "categories_pkey",
            "categories_name_unique",
            "categories_slug_unique",
            "categories_name_length",
            "categories_slug_format",
            "categories_status_valid");
  }

  @Test
  void the_table_the_new_columns_the_foreign_key_and_the_collation_have_a_comment() {
    db.flyway().migrate();

    assertThat(
            jdbc.sql(
                    """
SELECT obj_description('app.categories'::regclass, 'pg_class') IS NOT NULL
   AND col_description('app.categories'::regclass, 2) IS NOT NULL
   AND col_description('app.categories'::regclass, 3) IS NOT NULL
   AND col_description('app.categories'::regclass, 4) IS NOT NULL
   AND (SELECT description FROM pg_description d
          JOIN pg_attribute a ON a.attrelid = d.objoid AND a.attnum = d.objsubid
         WHERE d.objoid = 'app.products'::regclass
           AND a.attname = 'category_id') IS NOT NULL
   AND (SELECT obj_description(oid, 'pg_constraint') FROM pg_constraint
         WHERE conname = 'products_category_fk') IS NOT NULL
   AND (SELECT obj_description(oid, 'pg_collation') FROM pg_collation
         WHERE collname = 'vi_ci') IS NOT NULL
""")
                .query(Boolean.class)
                .single())
        .isTrue();
  }

  @Test
  void an_update_of_a_category_refreshes_its_updated_at() {
    db.flyway().migrate();
    UUID id = insertCategory("Áo", "ao", "VISIBLE");
    jdbc.sql("UPDATE app.categories SET updated_at = ? WHERE id = ?").params(UPDATED, id).update();

    jdbc.sql("UPDATE app.categories SET status = 'HIDDEN' WHERE id = ?").param(id).update();

    assertThat(
            jdbc.sql("SELECT updated_at > ? FROM app.categories WHERE id = ?")
                .params(UPDATED, id)
                .query(Boolean.class)
                .single())
        .isTrue();
  }

  // ============================================================
  // NFR14: the database refuses each wrong value
  // ============================================================

  @Test
  void a_new_category_is_visible_by_default_and_gets_an_id() {
    db.flyway().migrate();

    Map<String, Object> row =
        jdbc.sql(
                "INSERT INTO app.categories (name, slug) VALUES ('Áo', 'ao')"
                    + " RETURNING id IS NOT NULL AS has_id, status, version")
            .query()
            .singleRow();

    assertThat(row).containsEntry("has_id", true).containsEntry("status", "VISIBLE");
    assertThat(row.get("version")).isEqualTo(0L);
  }

  @Test
  void the_database_refuses_each_wrong_value_of_nfr14() {
    db.flyway().migrate();
    insertCategory("Áo", "ao", "VISIBLE");

    assertThat(refusal(() -> insertCategory("", "rong", "VISIBLE")))
        .isEqualTo("categories_name_length");
    assertThat(refusal(() -> insertCategory("a".repeat(61), "dai", "VISIBLE")))
        .as("61 characters")
        .isEqualTo("22001");
    assertThat(refusal(() -> insertCategory("áo", "ao-thuong", "VISIBLE")))
        .isEqualTo("categories_name_unique");
    assertThat(refusal(() -> insertCategory("ÁO", "ao-hoa", "VISIBLE")))
        .isEqualTo("categories_name_unique");
    assertThat(refusal(() -> insertCategory("Áo khác", "AO", "VISIBLE")))
        .as("slug AO: the CHECK runs before the UNIQUE index")
        .isEqualTo("categories_slug_format");
    assertThat(refusal(() -> insertCategory("Chữ hoa", "CHU-HOA", "VISIBLE")))
        .isEqualTo("categories_slug_format");
    assertThat(refusal(() -> insertCategory("Gạch đầu", "-ao", "VISIBLE")))
        .isEqualTo("categories_slug_format");
    assertThat(refusal(() -> insertCategory("Có dấu", "áo", "VISIBLE")))
        .isEqualTo("categories_slug_format");
    assertThat(refusal(() -> insertCategory("Khoảng trắng", "ao thun", "VISIBLE")))
        .isEqualTo("categories_slug_format");
    assertThat(refusal(() -> insertCategory("Slug dài", "a".repeat(101), "VISIBLE")))
        .isEqualTo("categories_slug_format");
    assertThat(refusal(() -> insertCategory("Trạng thái", "trang-thai", "X")))
        .isEqualTo("categories_status_valid");
    assertThat(
            refusal(
                () ->
                    jdbc.sql(
                            "INSERT INTO app.products (name, slug, price_vnd, category_id)"
                                + " VALUES ('Áo len', 'ao-len', 300000, ?)")
                        .param(UUID.randomUUID())
                        .update()))
        .isEqualTo("products_category_fk");
  }

  @Test
  void the_database_takes_the_edges_of_nfr14() {
    db.flyway().migrate();
    insertCategory("Áo", "ao", "VISIBLE");

    insertCategory("Ao", "ao-khong-dau", "VISIBLE");
    insertCategory("a".repeat(60), "a".repeat(100), "HIDDEN");
    insertCategory("Ă", "a-0-9", "VISIBLE");

    assertThat(count("SELECT count(*) FROM app.categories")).isEqualTo(4L);
  }

  // ============================================================
  // NFR17: the order of names
  // ============================================================

  @Test
  void names_come_in_the_vietnamese_order_of_nfr17() {
    db.flyway().migrate();
    List<String> expected =
        List.of("An toàn", "Áo khoác", "Ăn vặt", "Bao tay", "Dép", "Đầm", "quần");
    List<String> shuffled = new ArrayList<>(expected);
    Collections.reverse(shuffled);
    shuffled.add(0, shuffled.remove(3));
    for (int i = 0; i < shuffled.size(); i++) {
      insertCategory(shuffled.get(i), "danh-muc-" + i, "VISIBLE");
    }

    assertThat(
            jdbc.sql("SELECT name FROM app.categories ORDER BY name, id")
                .query(String.class)
                .list())
        .containsExactlyElementsOf(expected);
  }

  // ============================================================
  // NFR15 and AC8: deleting a category with products
  // ============================================================

  @Test
  void deleting_a_category_empties_the_category_of_its_products_and_changes_nothing_else() {
    db.flyway().migrate();
    UUID ao = insertCategory("Áo", "ao", "VISIBLE");
    UUID quan = insertCategory("Quần", "quan", "VISIBLE");
    UUID onSale = insertProduct("Áo thun cổ tròn", "ao-thun-co-tron", "ACTIVE", ao, 3L);
    UUID hidden = insertProduct("Áo len", "ao-len", "HIDDEN", ao, 5L);
    UUID otherCategory = insertProduct("Quần jean nam", "quan-jean-nam", "ACTIVE", quan, 1L);
    UUID noCategory = insertProduct("Khăn lụa", "khan-lua", "ACTIVE", null, 0L);
    Map<UUID, Map<String, Object>> before = productsById();

    OffsetDateTime deletedAt =
        jdbc.sql("DELETE FROM app.categories WHERE id = ? RETURNING now()")
            .param(ao)
            .query(OffsetDateTime.class)
            .single();

    Map<UUID, Map<String, Object>> after = productsById();
    for (UUID product : List.of(onSale, hidden)) {
      Map<String, Object> expected = new LinkedHashMap<>(before.get(product));
      expected.put("category_id", null);
      expected.remove("updated_at");
      Map<String, Object> actual = new LinkedHashMap<>(after.get(product));
      Object updatedAt = actual.remove("updated_at");
      assertThat(actual).as("every column but updated_at, version too").isEqualTo(expected);
      assertThat(((Timestamp) updatedAt).toInstant())
          .as("updated_at is the instant of the delete")
          .isEqualTo(deletedAt.toInstant());
    }
    assertThat(after.get(otherCategory)).isEqualTo(before.get(otherCategory));
    assertThat(after.get(noCategory)).isEqualTo(before.get(noCategory));
    assertThat(count("SELECT count(*) FROM app.categories")).isEqualTo(1L);
  }

  // ============================================================
  // NFR16: v0.3.0 on a database that has V7
  // ============================================================

  @Test
  void flyway_of_v030_validates_and_migrates_nothing_on_a_database_that_has_v7(
      @TempDir Path folder) {
    db.flyway().migrate();
    Flyway v030 = db.flywayOfV030(folder);

    assertThat(v030.validateWithResult().validationSuccessful).isTrue();
    assertThat(v030.migrate().migrationsExecuted).isZero();
  }

  @Test
  void the_insert_of_v030_leaves_the_category_empty() {
    db.flyway().migrate();
    UUID id = UUID.randomUUID();

    jdbc.sql(V030_INSERT)
        .params(
            "IN_STOCK",
            null,
            CREATED,
            "system",
            "Áo thun.",
            "Áo thun cổ tròn",
            250_000L,
            "ao-thun-co-tron",
            "ACTIVE",
            CREATED,
            "system",
            0L,
            id)
        .update();

    assertThat(
            jdbc.sql("SELECT category_id IS NULL FROM app.products WHERE id = ?")
                .param(id)
                .query(Boolean.class)
                .single())
        .isTrue();
  }

  @Test
  void the_update_of_v030_keeps_the_category_of_the_product() {
    db.flyway().migrate();
    UUID ao = insertCategory("Áo", "ao", "VISIBLE");
    UUID id = insertProduct("Áo thun cổ tròn", "ao-thun-co-tron", "ACTIVE", ao, 2L);

    int updated =
        jdbc.sql(V030_UPDATE)
            .params(
                "OUT_OF_STOCK",
                300_000L,
                "Áo thun mới.",
                "Áo thun cổ tròn mới",
                260_000L,
                "ao-thun-co-tron",
                "HIDDEN",
                UPDATED,
                "system",
                3L,
                id,
                2L)
            .update();

    assertThat(updated).isEqualTo(1);
    Map<String, Object> row =
        jdbc.sql("SELECT category_id, name, version FROM app.products WHERE id = ?")
            .param(id)
            .query()
            .singleRow();
    assertThat(row)
        .containsEntry("category_id", ao)
        .containsEntry("name", "Áo thun cổ tròn mới")
        .containsEntry("version", 3L);
  }

  @Test
  void the_delete_of_v030_deletes_a_product_that_has_a_category_and_keeps_the_category() {
    db.flyway().migrate();
    UUID ao = insertCategory("Áo", "ao", "VISIBLE");
    UUID id = insertProduct("Áo thun cổ tròn", "ao-thun-co-tron", "ACTIVE", ao, 0L);

    int deleted = jdbc.sql(V030_DELETE).param(id).update();

    assertThat(deleted).isEqualTo(1);
    assertThat(count("SELECT count(*) FROM app.products")).isZero();
    assertThat(count("SELECT count(*) FROM app.categories")).isEqualTo(1L);
  }

  // ============================================================
  // Helpers
  // ============================================================

  /** The digest of the image of the database in {@code .ai-orchestrator/deploy.yaml}. */
  private static String deployImageDigest() throws IOException {
    Path deploy =
        Path.of("").toAbsolutePath().resolve("../../.ai-orchestrator/deploy.yaml").normalize();
    Matcher matcher = DEPLOY_IMAGE.matcher(Files.readString(deploy, StandardCharsets.UTF_8));
    assertThat(matcher.find()).as("postgres:17-alpine by digest in " + deploy).isTrue();
    return matcher.group(1);
  }

  /**
   * The name of the constraint the statement broke, or the SQL state when it broke none, such as
   * {@code 22001} for a value too long for its {@code VARCHAR}.
   */
  private static String refusal(Runnable statement) {
    Throwable thrown = catchThrowable(statement::run);
    assertThat(thrown).as("the database refuses it").isInstanceOf(DataAccessException.class);
    for (Throwable cause = thrown; cause != null; cause = cause.getCause()) {
      if (cause instanceof PSQLException psql && psql.getServerErrorMessage() != null) {
        String constraint = psql.getServerErrorMessage().getConstraint();
        return constraint != null ? constraint : psql.getSQLState();
      }
    }
    throw new AssertionError("No PSQLException in " + thrown);
  }

  private UUID insertCategory(String name, String slug, String status) {
    return jdbc.sql("INSERT INTO app.categories (name, slug, status) VALUES (?, ?, ?) RETURNING id")
        .params(name, slug, status)
        .query(UUID.class)
        .single();
  }

  /** A product as {@code v0.4.0} writes it, with fixed audit values in the past. */
  private UUID insertProduct(
      String name, String slug, String status, UUID categoryId, long version) {
    UUID id = UUID.randomUUID();
    jdbc.sql(
            """
            INSERT INTO app.products
                (id, name, slug, description, price_vnd, compare_at_price_vnd, status,
                 availability, created_at, updated_at, created_by, updated_by, version,
                 category_id)
            VALUES (?, ?, ?, 'Mô tả.', 250000, 300000, ?, 'IN_STOCK', ?, ?, 'system',
                    'system', ?, ?)
            """)
        .params(id, name, slug, status, CREATED, UPDATED, version, categoryId)
        .update();
    return id;
  }

  /** The five products of SHOP-12 (T5), as {@code v0.3.0} writes them on Production. */
  private void insertTheFiveProductsOfShop12() {
    Object[][] products = {
      {"Áo thun cổ tròn", "ao-thun-co-tron", 250_000L, "ACTIVE", "Áo thun cotton 100%."},
      {"Quần jean nam", "quan-jean-nam", 450_000L, "ACTIVE", null},
      {"Đầm maxi đỏ 2026", "dam-maxi-do-2026", 1_250_000L, "ACTIVE", "Kích thước < 5 cm"},
      {"Combo 3 áo thun", "combo-3-ao", 399_000L, "ACTIVE", "Ba áo thun basic."},
      {"Bao tay len", "bao-tay-len", 0L, "HIDDEN", null}
    };
    for (Object[] product : products) {
      jdbc.sql(V030_INSERT)
          .params(
              "IN_STOCK",
              null,
              CREATED,
              "system",
              product[4],
              product[0],
              product[2],
              product[1],
              product[3],
              UPDATED,
              "system",
              0L,
              UUID.randomUUID())
          .update();
    }
  }

  /** Products like those of Production: accented names, long descriptions, every status. */
  private void insertGeneratedProducts(int count) {
    jdbc.sql(
            """
INSERT INTO app.products
    (availability, compare_at_price_vnd, created_at, created_by, description, name,
     price_vnd, slug, status, updated_at, updated_by, version, id)
SELECT CASE WHEN g % 5 = 0 THEN 'OUT_OF_STOCK' ELSE 'IN_STOCK' END,
       CASE WHEN g % 4 = 0 THEN g * 1000 + 50000 END,
       TIMESTAMPTZ '2026-01-01 00:00:00+00' + make_interval(mins => g), 'system',
       CASE WHEN g % 3 = 0 THEN NULL ELSE repeat('Mô tả sản phẩm, dòng ' || g || E'.\\n', 20) END,
       'Áo thun Đặc Biệt số ' || g || ' – bản ' || (g % 7),
       g * 1000,
       'san-pham-' || g,
       CASE WHEN g % 10 = 0 THEN 'HIDDEN' ELSE 'ACTIVE' END,
       TIMESTAMPTZ '2026-02-01 00:00:00.000001+00' + make_interval(mins => g), 'system',
       g % 4, gen_random_uuid()
  FROM generate_series(1, ?) AS g
""")
        .param(count)
        .update();
  }

  private String digestOfV6Columns() {
    return jdbc.sql(
            "SELECT md5(string_agg((" + V6_COLUMNS + ")::text, ',' ORDER BY id)) FROM app.products")
        .query(String.class)
        .single();
  }

  private Map<UUID, Map<String, Object>> productsById() {
    Map<UUID, Map<String, Object>> rows = new LinkedHashMap<>();
    jdbc.sql("SELECT * FROM app.products ORDER BY id")
        .query()
        .listOfRows()
        .forEach(row -> rows.put((UUID) row.get("id"), row));
    return rows;
  }

  private long count(String sql) {
    return jdbc.sql(sql).query(Long.class).single();
  }
}
