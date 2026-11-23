package com.tungph7.learnpostgres.feature.product.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
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
 * V8, the display order of categories (SHOP-96; plan of SHOP-95, Database Changes; ADR-0006): the
 * column {@code app.categories.display_order}, checked on a V7 database as the {@code api} of
 * SHOP-81 leaves it, then against NFR2, NFR9 and NFR10 of SHOP-95.
 */
class V8AddCategoryDisplayOrderMigrationTest extends AbstractContainerBaseTest {

  private static final String V8_LOG_NAME = "V8__add_category_display_order";

  /**
   * The INSERT Hibernate writes for {@code Category} in SHOP-81, copied from the SQL log of {@code
   * AdminCategoryEditIntegrationTest} at the first commit of SHOP-96, when the code of categories
   * was still that of SHOP-81.
   */
  private static final String SHOP81_INSERT =
      "insert into app.categories (created_at,created_by,name,slug,status,updated_at,updated_by,"
          + "version,id) values (?,?,?,?,?,?,?,?,?)";

  /** The UPDATE of SHOP-81, from the same log. */
  private static final String SHOP81_UPDATE =
      "update app.categories set name=?,slug=?,status=?,updated_at=?,updated_by=?,version=?"
          + " where id=? and version=?";

  /** The admin list of SHOP-81: every category, in the order of names. */
  private static final String SHOP81_ADMIN_ORDER =
      "SELECT c.slug::text FROM app.categories c ORDER BY c.name, c.id";

  /**
   * The store list of SHOP-81: visible categories with a product on sale, in the order of names.
   */
  private static final String SHOP81_STORE_ORDER =
      "SELECT c.slug::text FROM app.categories c WHERE c.status = 'VISIBLE'"
          + " AND EXISTS (SELECT 1 FROM app.products p"
          + " WHERE p.category_id = c.id AND p.status = 'ACTIVE') ORDER BY c.name, c.id";

  /** The order of SHOP-95 (NFR11): display order, then name, then id. */
  private static final String ORDER_OF_SHOP95 = " ORDER BY c.display_order, c.name, c.id";

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
  void createV7Database() {
    db = MigrationDatabase.create(POSTGRES);
    jdbc = db.jdbc();
    db.flyway(MigrationDatabase.V7).migrate();
  }

  @AfterEach
  void dropDatabase() {
    db.close();
  }

  // ============================================================
  // On the image the deployer runs
  // ============================================================

  @Test
  void every_migration_runs_up_to_v8_on_the_postgres_image_of_deploy_yaml() throws IOException {
    DockerImageName image =
        DockerImageName.parse("postgres@" + deployImageDigest())
            .asCompatibleSubstituteFor("postgres");
    try (PostgreSQLContainer deployed = new PostgreSQLContainer(image)) {
      deployed.start();
      try (MigrationDatabase onDeployed = MigrationDatabase.create(deployed)) {
        MigrateResult result = onDeployed.flyway(MigrationDatabase.V8).migrate();

        assertThat(result.targetSchemaVersion).isEqualTo(MigrationDatabase.V8);
        assertThat(
                onDeployed
                    .jdbc()
                    .sql(
                        "INSERT INTO app.categories (name, slug) VALUES ('Áo', 'ao')"
                            + " RETURNING display_order")
                    .query(Integer.class)
                    .single())
            .isZero();
      }
    }
  }

  @Test
  void v8_writes_one_row_to_the_migration_log() {
    db.flyway(MigrationDatabase.V8).migrate();

    assertThat(
            jdbc.sql("SELECT count(*) FROM app._app_migration_log WHERE migration_name = ?")
                .param(V8_LOG_NAME)
                .query(Long.class)
                .single())
        .isEqualTo(1L);
  }

  // ============================================================
  // NFR9: the column and its constraint
  // ============================================================

  @Test
  void display_order_is_a_not_null_integer_with_default_zero_and_a_comment() {
    db.flyway(MigrationDatabase.V8).migrate();

    Map<String, Object> column =
        jdbc.sql(
                """
                SELECT data_type, is_nullable, column_default,
                       col_description('app.categories'::regclass, ordinal_position) AS comment
                  FROM information_schema.columns
                 WHERE table_schema = 'app' AND table_name = 'categories'
                   AND column_name = 'display_order'
                """)
            .query()
            .singleRow();

    assertThat(column)
        .containsEntry("data_type", "integer")
        .containsEntry("is_nullable", "NO")
        .containsEntry("column_default", "0");
    assertThat((String) column.get("comment")).isNotBlank();
  }

  @Test
  void the_range_check_is_the_only_new_constraint_and_no_index_is_added() {
    List<String> indexesBefore = indexesOfCategories();

    db.flyway(MigrationDatabase.V8).migrate();

    assertThat(
            jdbc.sql(
                    """
                    SELECT pg_get_constraintdef(oid) FROM pg_constraint
                     WHERE conrelid = 'app.categories'::regclass
                       AND conname = 'categories_display_order_range'
                    """)
                .query(String.class)
                .single())
        .isEqualTo("CHECK (((display_order >= 0) AND (display_order <= 9999)))");
    assertThat(
            jdbc.sql(
                    """
                    SELECT conname FROM pg_constraint
                     WHERE conrelid = 'app.categories'::regclass AND contype IN ('c', 'u', 'p')
                    """)
                .query(String.class)
                .list())
        .as("no UNIQUE on the display order (ADR-0006)")
        .containsExactlyInAnyOrder(
            "categories_pkey",
            "categories_name_unique",
            "categories_slug_unique",
            "categories_name_length",
            "categories_slug_format",
            "categories_status_valid",
            "categories_display_order_range");
    assertThat(indexesOfCategories()).as("NFR2").isEqualTo(indexesBefore);
  }

  @Test
  void the_database_refuses_minus_one_ten_thousand_and_null() {
    db.flyway(MigrationDatabase.V8).migrate();

    assertThat(refusal(() -> insertCategory("Âm", "am", -1)))
        .isEqualTo("categories_display_order_range");
    assertThat(refusal(() -> insertCategory("Mười nghìn", "muoi-nghin", 10_000)))
        .isEqualTo("categories_display_order_range");
    assertThat(refusal(() -> insertCategory("Rỗng", "rong", null)))
        .as("not-null violation")
        .isEqualTo("23502");
    assertThat(count("SELECT count(*) FROM app.categories")).isZero();
  }

  @Test
  void the_database_takes_zero_and_9999_and_two_categories_with_the_same_number() {
    db.flyway(MigrationDatabase.V8).migrate();

    insertCategory("Quần", "quan", 0);
    insertCategory("Áo", "ao", 9999);
    insertCategory("Đầm", "dam", 9999);

    assertThat(
            jdbc.sql("SELECT display_order FROM app.categories ORDER BY display_order, name")
                .query(Integer.class)
                .list())
        .containsExactly(0, 9999, 9999);
  }

  // ============================================================
  // NFR10 and AC8: existing data
  // ============================================================

  @Test
  void v8_runs_on_200_categories_in_under_a_second_and_changes_no_row() {
    insertGeneratedCategoriesWithProducts(200);
    String categoriesBefore = digestOfCategories();
    String productsBefore = digestOfProducts();
    List<String> adminBefore = slugs(SHOP81_ADMIN_ORDER);
    List<String> storeBefore = slugs(SHOP81_STORE_ORDER);

    long started = System.nanoTime();
    MigrateResult result = db.flyway(MigrationDatabase.V8).migrate();
    Duration took = Duration.ofNanos(System.nanoTime() - started);

    assertThat(result.migrationsExecuted).isEqualTo(1);
    assertThat(took).as("NFR10").isLessThan(Duration.ofSeconds(1));
    assertThat(count("SELECT count(*) FROM app.categories WHERE display_order = 0"))
        .isEqualTo(200L);
    assertThat(digestOfCategories())
        .as("every column of V7, updated_at, updated_by and version too")
        .isEqualTo(categoriesBefore);
    assertThat(digestOfProducts()).as("app.products is not touched").isEqualTo(productsBefore);
    assertThat(slugs(SHOP81_ADMIN_ORDER.replace(" ORDER BY c.name, c.id", ORDER_OF_SHOP95)))
        .as("the admin list, AC8")
        .isEqualTo(adminBefore);
    assertThat(slugs(SHOP81_STORE_ORDER.replace(" ORDER BY c.name, c.id", ORDER_OF_SHOP95)))
        .as("the store list, AC8")
        .isEqualTo(storeBefore)
        .isNotEmpty();
  }

  @Test
  void v8_gives_up_after_its_lock_timeout_and_runs_again_once_the_lock_is_gone()
      throws SQLException {
    insertCategory7("Áo", "ao");

    try (Connection holder = db.connect()) {
      holder.setAutoCommit(false);
      try (Statement statement = holder.createStatement()) {
        statement.execute("LOCK TABLE app.categories IN ACCESS SHARE MODE");
      }
      long started = System.nanoTime();
      Throwable thrown = catchThrowable(() -> db.flyway(MigrationDatabase.V8).migrate());
      Duration took = Duration.ofNanos(System.nanoTime() - started);

      assertThat(thrown).as("lock_timeout of V8").isNotNull();
      assertThat(took).isBetween(Duration.ofSeconds(4), Duration.ofSeconds(20));
      holder.rollback();
    }

    assertThat(db.flyway(MigrationDatabase.V8).migrate().migrationsExecuted).isEqualTo(1);
    assertThat(count("SELECT count(*) FROM app.categories WHERE display_order = 0")).isEqualTo(1L);
  }

  // ============================================================
  // NFR10: the api of SHOP-81 and v0.3.0 on a database that has V8
  // ============================================================

  @Test
  void flyway_of_v1_to_v7_validates_and_migrates_nothing_on_a_database_that_has_v8(
      @TempDir Path folder) {
    db.flyway(MigrationDatabase.V8).migrate();
    Flyway shop81 = db.flywayOfV1ToV7(folder);

    assertThat(shop81.validateWithResult().validationSuccessful).isTrue();
    assertThat(shop81.migrate().migrationsExecuted).isZero();
  }

  @Test
  void flyway_of_v030_validates_and_migrates_nothing_on_a_database_that_has_v8(
      @TempDir Path folder) {
    db.flyway(MigrationDatabase.V8).migrate();
    Flyway v030 = db.flywayOfV030(folder);

    assertThat(v030.validateWithResult().validationSuccessful).isTrue();
    assertThat(v030.migrate().migrationsExecuted).isZero();
  }

  @Test
  void the_insert_of_shop81_gives_the_category_zero() {
    db.flyway(MigrationDatabase.V8).migrate();
    UUID id = UUID.randomUUID();

    jdbc.sql(SHOP81_INSERT)
        .params(CREATED, "system", "Áo", "ao", "VISIBLE", CREATED, "system", 0L, id)
        .update();

    assertThat(
            jdbc.sql("SELECT display_order FROM app.categories WHERE id = ?")
                .param(id)
                .query(Integer.class)
                .single())
        .isZero();
  }

  @Test
  void the_update_of_shop81_keeps_the_display_order_of_the_category() {
    db.flyway(MigrationDatabase.V8).migrate();
    UUID id = insertCategory("Áo", "ao", 7);
    jdbc.sql("UPDATE app.categories SET version = 2 WHERE id = ?").param(id).update();

    int updated =
        jdbc.sql(SHOP81_UPDATE)
            .params("Áo thun", "ao-thun", "HIDDEN", UPDATED, "system", 3L, id, 2L)
            .update();

    assertThat(updated).isEqualTo(1);
    Map<String, Object> row =
        jdbc.sql("SELECT name, display_order, version FROM app.categories WHERE id = ?")
            .param(id)
            .query()
            .singleRow();
    assertThat(row)
        .containsEntry("name", "Áo thun")
        .containsEntry("display_order", 7)
        .containsEntry("version", 3L);
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
   * {@code 23502} for a {@code NULL} in a {@code NOT NULL} column.
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

  private UUID insertCategory(String name, String slug, Integer displayOrder) {
    return jdbc.sql(
            "INSERT INTO app.categories (name, slug, display_order) VALUES (?, ?, ?) RETURNING id")
        .params(name, slug, displayOrder)
        .query(UUID.class)
        .single();
  }

  /** A category on the schema of V7, which has no display order yet. */
  private UUID insertCategory7(String name, String slug) {
    return jdbc.sql("INSERT INTO app.categories (name, slug) VALUES (?, ?) RETURNING id")
        .params(name, slug)
        .query(UUID.class)
        .single();
  }

  /**
   * Categories as SHOP-81 writes them on the schema of V7, with fixed audit values in the past:
   * accented names, one in five hidden, one in three without products, the others with a product on
   * sale and a hidden one.
   */
  private void insertGeneratedCategoriesWithProducts(int count) {
    jdbc.sql(
            """
INSERT INTO app.categories
    (id, name, slug, status, created_at, updated_at, created_by, updated_by, version)
SELECT gen_random_uuid(),
       (ARRAY['Áo', 'Ăn', 'Bao', 'Đầm', 'Dép', 'Quần'])[g % 6 + 1] || ' số ' || g,
       'danh-muc-' || g,
       CASE WHEN g % 5 = 0 THEN 'HIDDEN' ELSE 'VISIBLE' END,
       TIMESTAMPTZ '2026-01-01 00:00:00+00' + make_interval(mins => g),
       TIMESTAMPTZ '2026-02-01 00:00:00.000001+00' + make_interval(mins => g),
       'system', 'admin-' || (g % 3), g % 4
  FROM generate_series(1, ?) AS g
""")
        .param(count)
        .update();
    jdbc.sql(
            """
INSERT INTO app.products (name, slug, price_vnd, status, category_id)
SELECT 'Sản phẩm ' || c.slug || ' ' || s, c.slug || '-sp-' || s, 100000,
       CASE WHEN s = 1 THEN 'ACTIVE' ELSE 'HIDDEN' END, c.id
  FROM app.categories c CROSS JOIN generate_series(1, 2) AS s
 WHERE (substring(c.slug::text FROM '[0-9]+$'))::int % 3 <> 0
""")
        .update();
  }

  private List<String> indexesOfCategories() {
    return jdbc.sql(
            "SELECT indexdef FROM pg_indexes"
                + " WHERE schemaname = 'app' AND tablename = 'categories' ORDER BY indexname")
        .query(String.class)
        .list();
  }

  private String digestOfCategories() {
    return jdbc.sql(
            "SELECT md5(string_agg((id, name, slug, status, created_at, updated_at, created_by,"
                + " updated_by, version)::text, ',' ORDER BY id)) FROM app.categories")
        .query(String.class)
        .single();
  }

  private String digestOfProducts() {
    return jdbc.sql("SELECT md5(string_agg(p::text, ',' ORDER BY p.id)) FROM app.products p")
        .query(String.class)
        .single();
  }

  private List<String> slugs(String sql) {
    return jdbc.sql(sql).query(String.class).list();
  }

  private long count(String sql) {
    return jdbc.sql(sql).query(Long.class).single();
  }
}
