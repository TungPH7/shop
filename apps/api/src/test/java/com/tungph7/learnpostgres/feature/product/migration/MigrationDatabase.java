package com.tungph7.learnpostgres.feature.product.migration;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.testcontainers.postgresql.PostgreSQLContainer;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

/**
 * A database of its own in the shared Postgres container, for the tests of a migration: it starts
 * as the docker init script leaves a new volume (schema {@code app} and four extensions), and
 * Flyway migrates it with the settings of {@code application.yml}.
 *
 * <p>The connection sets {@code currentSchema=app}, as the JDBC URL of {@code application.yml}
 * does, so the migrations run with {@code search_path = app} only, as on the servers.
 */
final class MigrationDatabase implements AutoCloseable {

  /** The Flyway target of the schema {@code v0.2.0} ships. */
  static final String V3 = "3";

  /** The Flyway target of the expand step of {@code v0.3.0}, the last before V5 (SHOP-44). */
  static final String V4 = "4";

  /** The Flyway target of the check that {@code pgcrypto} is in {@code public} (SHOP-50). */
  static final String V6 = "6";

  /** The Flyway target of the categories, the expand step of {@code v0.4.0} (SHOP-82). */
  static final String V7 = "7";

  /** The migrations of {@code v0.2.0}: the only ones its Flyway resolves. */
  private static final List<String> V0_2_0_MIGRATIONS =
      List.of("V1__init.sql", "V2__app_helpers.sql", "V3__create_products_table.sql");

  /** The migrations of {@code v0.3.0}: the only ones its Flyway resolves. */
  private static final List<String> V0_3_0_MIGRATIONS =
      List.of(
          "V1__init.sql",
          "V2__app_helpers.sql",
          "V3__create_products_table.sql",
          "V4__expand_products_catalog.sql",
          "V5__gen_uuid_v7_qualify_pgcrypto.sql",
          "V6__assert_pgcrypto_in_public.sql");

  private static final String MIGRATIONS = "db/migration/";
  private static final String INIT_SCRIPT = "db/init/test-init.sql";

  private final PostgreSQLContainer container;
  private final String name;
  private final HikariDataSource dataSource;
  private final JdbcClient jdbc;

  private MigrationDatabase(PostgreSQLContainer container, String name) {
    this.container = container;
    this.name = name;
    HikariConfig config = new HikariConfig();
    config.setJdbcUrl(url(container, name) + "?currentSchema=app&stringtype=unspecified");
    config.setUsername(container.getUsername());
    config.setPassword(container.getPassword());
    config.setMaximumPoolSize(2);
    config.setPoolName("migration-" + name);
    this.dataSource = new HikariDataSource(config);
    this.jdbc = JdbcClient.create(dataSource);
  }

  /** Creates the database and runs the test init script in it, as a new volume would. */
  static MigrationDatabase create(PostgreSQLContainer container) {
    String name =
        "migration_" + UUID.randomUUID().toString().replace("-", "").toLowerCase(Locale.ROOT);
    execute(container, container.getJdbcUrl(), "CREATE DATABASE " + name);
    // Without currentSchema: the extensions go to schema public before the script creates app.
    try (Connection connection =
        DriverManager.getConnection(
            url(container, name), container.getUsername(), container.getPassword())) {
      ScriptUtils.executeSqlScript(connection, new ClassPathResource(INIT_SCRIPT));
    } catch (SQLException e) {
      throw new IllegalStateException("Cannot initialise database " + name, e);
    }
    return new MigrationDatabase(container, name);
  }

  JdbcClient jdbc() {
    return jdbc;
  }

  /** The pool behind {@link #jdbc()}, for a test that needs a connection of its own. */
  DataSource dataSource() {
    return dataSource;
  }

  /** Flyway as {@code application.yml} sets it, over every migration of this build. */
  Flyway flyway() {
    return configure().locations("classpath:db/migration").load();
  }

  /** Flyway over every migration of this build, stopping at {@code target}. */
  Flyway flyway(String target) {
    return configure().locations("classpath:db/migration").target(target).load();
  }

  /**
   * Flyway as {@code v0.2.0} runs it: the same settings, but only V1–V3 to resolve. {@code
   * ignoreMigrationPatterns} keeps its default, {@code *:future}, as {@code application*.yml} does.
   */
  Flyway flywayOfV020(Path folder) {
    return flywayOver(V0_2_0_MIGRATIONS, folder);
  }

  /**
   * Flyway as {@code v0.3.0} runs it after a rollback: the same settings, but only V1–V6 to
   * resolve, and {@code ignoreMigrationPatterns} at its default, {@code *:future} (NFR16 of
   * SHOP-81).
   */
  Flyway flywayOfV030(Path folder) {
    return flywayOver(V0_3_0_MIGRATIONS, folder);
  }

  private Flyway flywayOver(List<String> migrations, Path folder) {
    for (String file : migrations) {
      try (InputStream in = new ClassPathResource(MIGRATIONS + file).getInputStream()) {
        Files.copy(in, folder.resolve(file));
      } catch (IOException e) {
        throw new UncheckedIOException(e);
      }
    }
    return configure().locations("filesystem:" + folder.toAbsolutePath()).load();
  }

  private FluentConfiguration configure() {
    return Flyway.configure()
        .dataSource(dataSource)
        .schemas("app")
        .defaultSchema("app")
        .table("flyway_schema_history")
        .validateOnMigrate(true)
        .validateMigrationNaming(true)
        .outOfOrder(false)
        .mixed(false)
        .cleanDisabled(true)
        .encoding(StandardCharsets.UTF_8);
  }

  @Override
  public void close() {
    dataSource.close();
    execute(container, container.getJdbcUrl(), "DROP DATABASE IF EXISTS " + name + " WITH (FORCE)");
  }

  private static String url(PostgreSQLContainer container, String database) {
    return "jdbc:postgresql://%s:%d/%s"
        .formatted(
            container.getHost(),
            container.getMappedPort(PostgreSQLContainer.POSTGRESQL_PORT),
            database);
  }

  private static void execute(PostgreSQLContainer container, String url, String sql) {
    try (Connection connection =
            DriverManager.getConnection(url, container.getUsername(), container.getPassword());
        Statement statement = connection.createStatement()) {
      statement.execute(sql);
    } catch (SQLException e) {
      throw new IllegalStateException("Cannot run: " + sql, e);
    }
  }
}
