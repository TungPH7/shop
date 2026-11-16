package com.tungph7.learnpostgres.feature.product.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.Test;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;

/**
 * SHOP-50: V5 makes {@code app.gen_uuid_v7()} call {@code public.gen_random_bytes()}, but the body
 * of a {@code plpgsql} function is resolved only when it runs. On a database whose {@code pgcrypto}
 * lives in another schema, V5 succeeds and the function fails at the first insert without an id. V6
 * checks it at the deploy instead, on each database the migrations run on.
 */
class V6AssertPgcryptoMigrationTest extends AbstractContainerBaseTest {

  @Test
  void v6_passes_and_writes_its_line_in_the_migration_log_when_pgcrypto_is_in_public() {
    try (MigrationDatabase db = MigrationDatabase.create(POSTGRES)) {
      db.flyway().migrate();

      assertThat(db.flyway().info().current().getVersion().getVersion()).isEqualTo("6");
      assertThat(
              db.jdbc()
                  .sql("SELECT count(*) FROM app._app_migration_log WHERE migration_name = ?")
                  .param("V6__assert_pgcrypto_in_public")
                  .query(Long.class)
                  .single())
          .isEqualTo(1L);
    }
  }

  @Test
  void v6_stops_the_deploy_and_names_the_schema_when_pgcrypto_is_in_another_schema() {
    try (MigrationDatabase db = MigrationDatabase.create(POSTGRES)) {
      db.jdbc().sql("CREATE SCHEMA extensions").update();
      db.jdbc().sql("ALTER EXTENSION pgcrypto SET SCHEMA extensions").update();

      assertThatThrownBy(() -> db.flyway().migrate())
          .isInstanceOf(FlywayException.class)
          .hasMessageContaining("pgcrypto")
          .hasMessageContaining("extensions")
          .hasMessageContaining("public");
      // The migration of V6 rolls back as a whole: the database stays on V5.
      assertThat(db.flyway().info().current().getVersion().getVersion()).isEqualTo("5");
    }
  }
}
