package com.tungph7.learnpostgres.feature.product.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.simple.JdbcClient;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;

/**
 * SHOP-44: {@code app.gen_uuid_v7()}, the {@code DEFAULT} of every primary key, works whatever the
 * {@code search_path} of the session. The servers connect with {@code currentSchema=app}, so their
 * {@code search_path} is {@code app} only, while {@code pgcrypto} lives in schema {@code public}.
 * JPA always sets the id itself; these are the inserts that bypass it, such as a data script.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class GenUuidV7SearchPathTest extends AbstractContainerBaseTest {

  /** A UUIDv7 carries the ms of its creation; the database clock must agree within this. */
  private static final long CLOCK_TOLERANCE_MS = 1_000L;

  private static final String URL_KEY = "spring.datasource.url";

  private MigrationDatabase db;
  private JdbcClient jdbc;

  @BeforeAll
  void createDatabase() {
    db = MigrationDatabase.create(POSTGRES);
    jdbc = db.jdbc();
    db.flyway().migrate();
  }

  @AfterEach
  void deleteProducts() {
    jdbc.sql("DELETE FROM app.products").update();
  }

  @AfterAll
  void dropDatabase() {
    db.close();
  }

  @Test
  void v5_writes_its_line_in_the_migration_log() {
    assertThat(
            jdbc.sql("SELECT count(*) FROM app._app_migration_log WHERE migration_name = ?")
                .param("V5__gen_uuid_v7_qualify_pgcrypto")
                .query(Long.class)
                .single())
        .isEqualTo(1L);
  }

  @Test
  void the_connection_of_the_harness_has_search_path_app_only() {
    assertThat(jdbc.sql("SHOW search_path").query(String.class).single()).isEqualTo("app");
  }

  /**
   * The harness above copies {@code currentSchema=app} from the URL of the servers; this checks
   * that URL, with what each profile of a server sets over {@code application.yml}.
   */
  @ParameterizedTest(name = "profile {0}")
  @ValueSource(strings = {"dev", "staging", "prod"})
  void the_datasource_url_of_the_servers_sets_current_schema_app(String profile) {
    Properties base = yaml("application.yml");
    Properties overrides = yaml("application-" + profile + ".yml");

    String url = overrides.getProperty(URL_KEY, base.getProperty(URL_KEY));

    assertThat(url).as(URL_KEY).matches(".*[?&]currentSchema=app(&.*)?");
  }

  @Test
  void gen_uuid_v7_returns_a_uuid_v7_with_search_path_app_only() {
    Map<String, Object> row =
        jdbc.sql(
                """
                SELECT app.gen_uuid_v7() AS id,
                       (extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now_ms
                """)
            .query()
            .singleRow();

    UUID id = (UUID) row.get("id");
    assertThat(id.version()).isEqualTo(7);
    assertThat(id.variant()).isEqualTo(2);
    assertThat(timestampMs(id)).isCloseTo((Long) row.get("now_ms"), within(CLOCK_TOLERANCE_MS));
  }

  @ParameterizedTest(name = "search_path = ''{0}''")
  @ValueSource(strings = {"", "pg_catalog", "app", "public", "app, public"})
  void gen_uuid_v7_returns_a_uuid_v7_whatever_the_search_path(String searchPath)
      throws SQLException {
    UUID id;
    try (Connection connection = db.dataSource().getConnection()) {
      connection.setAutoCommit(false);
      try (Statement statement = connection.createStatement()) {
        statement.execute("SET LOCAL search_path TO " + quoted(searchPath));
        try (ResultSet result = statement.executeQuery("SELECT app.gen_uuid_v7()")) {
          result.next();
          id = result.getObject(1, UUID.class);
        }
      } finally {
        connection.rollback();
      }
    }

    assertThat(id.version()).isEqualTo(7);
    assertThat(id.variant()).isEqualTo(2);
  }

  @Test
  void an_insert_without_an_id_gets_a_uuid_v7_from_the_default() {
    UUID id =
        jdbc.sql(
                """
                INSERT INTO app.products (name, slug, price_vnd)
                VALUES ('Áo thun cổ tròn', 'ao-thun-co-tron', 250000)
                RETURNING id
                """)
            .query(UUID.class)
            .single();

    assertThat(id.version()).isEqualTo(7);
    assertThat(
            jdbc.sql("SELECT count(*) FROM app.products WHERE id = ?")
                .param(id)
                .query(Long.class)
                .single())
        .isEqualTo(1L);
  }

  @Test
  void two_ids_in_a_row_differ_and_keep_their_order() {
    UUID first = jdbc.sql("SELECT app.gen_uuid_v7()").query(UUID.class).single();
    UUID second = jdbc.sql("SELECT app.gen_uuid_v7()").query(UUID.class).single();

    assertThat(second).isNotEqualTo(first);
    assertThat(timestampMs(second)).isGreaterThanOrEqualTo(timestampMs(first));
  }

  /** The properties of one {@code application*.yml} of the classpath, without placeholders. */
  private static Properties yaml(String file) {
    YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
    yaml.setResources(new ClassPathResource(file));
    return yaml.getObject();
  }

  /** The 48-bit unix_ts_ms at the front of a UUIDv7 (RFC 9562 § 5.7). */
  private static long timestampMs(UUID id) {
    return id.getMostSignificantBits() >>> 16;
  }

  /** {@code ''} for an empty path, else the schema names as they are (test constants only). */
  private static String quoted(String searchPath) {
    return searchPath.isEmpty() ? "''" : searchPath;
  }
}
