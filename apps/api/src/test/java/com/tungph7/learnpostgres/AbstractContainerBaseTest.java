package com.tungph7.learnpostgres;

import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Singleton Postgres container — shared by every test class that extends this base. The container
 * is started in a static block and never stopped (Testcontainers' Ryuk reaps it when the JVM
 * exits).
 *
 * <p>{@code @Container} / {@code @Testcontainers} are intentionally NOT used: the JUnit extension
 * would call {@code stop()} after each test class, leaving subsequent classes unable to connect.
 * The singleton pattern needs the lifecycle to be owned by the static block and cleaned up by Ryuk
 * at JVM exit. {@code @ServiceConnection} (Spring Boot 3.1+) auto-binds the container to {@code
 * spring.datasource.*} so no manual {@code @DynamicPropertySource} is needed.
 */
@ActiveProfiles("test")
public abstract class AbstractContainerBaseTest {

  /** MUST match the Postgres version declared in docker-compose.yml. */
  private static final DockerImageName POSTGRES_IMAGE = DockerImageName.parse("postgres:17-alpine");

  @ServiceConnection
  protected static final PostgreSQLContainer POSTGRES =
      (PostgreSQLContainer)
          new PostgreSQLContainer(POSTGRES_IMAGE)
              .withDatabaseName("learn_postgres_test")
              .withUsername("test")
              .withPassword("test")
              // creates extensions + schema 'app' before Flyway runs
              .withInitScript("db/init/test-init.sql")
              // bind String via Oid.UNSPECIFIED so citext receives plain text
              .withUrlParam("stringtype", "unspecified")
              // only takes effect when ~/.testcontainers.properties enables reuse
              .withReuse(true);

  static {
    POSTGRES.start();
  }
}
