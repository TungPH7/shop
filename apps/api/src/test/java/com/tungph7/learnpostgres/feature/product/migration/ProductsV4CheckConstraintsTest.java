package com.tungph7.learnpostgres.feature.product.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.util.UUID;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.postgresql.util.PSQLException;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.jdbc.core.simple.JdbcClient;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;

/**
 * The CHECK constraints of V4 (NFR15): the database is the last guard after {@code api}. Rows are
 * written as {@code v0.3.0} writes them, with the new columns.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ProductsV4CheckConstraintsTest extends AbstractContainerBaseTest {

  private static final String CHECK_VIOLATION = "23514";

  private MigrationDatabase db;
  private JdbcClient jdbc;

  @BeforeAll
  void createV4Database() {
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

  @ParameterizedTest(name = "{0} {1}")
  @CsvSource({
    "ACTIVE, 0",
    "ACTIVE, 1000000000",
  })
  void a_product_on_sale_needs_a_price_from_1_to_999999999(String status, long priceVnd) {
    PSQLException error = insertRefused(priceVnd, null, status, "IN_STOCK");

    assertThat(error.getSQLState()).isEqualTo(CHECK_VIOLATION);
    assertThat(error.getServerErrorMessage().getConstraint()).isEqualTo("products_price_vnd_valid");
  }

  @ParameterizedTest(name = "{0} {1}")
  @CsvSource({
    "ACTIVE, 1",
    "ACTIVE, 999999999",
    "HIDDEN, 0",
    "HIDDEN, 1000000000",
    "HIDDEN, 9999999999",
  })
  void prices_within_the_rules_are_accepted(String status, long priceVnd) {
    assertThatCode(() -> insert(priceVnd, null, status, "IN_STOCK")).doesNotThrowAnyException();
  }

  @Test
  void a_negative_price_is_refused_even_on_a_hidden_product() {
    PSQLException error = insertRefused(-1L, null, "HIDDEN", "IN_STOCK");

    assertThat(error.getSQLState()).isEqualTo(CHECK_VIOLATION);
  }

  @ParameterizedTest(name = "price 200000, compare-at {0}")
  @CsvSource({"200000", "199999", "1000000000"})
  void a_compare_at_price_must_be_above_the_price_and_at_most_999999999(long compareAt) {
    PSQLException error = insertRefused(200_000L, compareAt, "ACTIVE", "IN_STOCK");

    assertThat(error.getSQLState()).isEqualTo(CHECK_VIOLATION);
    assertThat(error.getServerErrorMessage().getConstraint())
        .isEqualTo("products_compare_at_price_valid");
  }

  @Test
  void a_compare_at_price_above_the_price_or_none_is_accepted() {
    assertThatCode(() -> insert(200_000L, 200_001L, "ACTIVE", "IN_STOCK"))
        .doesNotThrowAnyException();
    assertThatCode(() -> insert(200_000L, 999_999_999L, "ACTIVE", "IN_STOCK"))
        .doesNotThrowAnyException();
    assertThatCode(() -> insert(200_000L, null, "ACTIVE", "IN_STOCK")).doesNotThrowAnyException();
  }

  @ParameterizedTest
  @CsvSource({"DRAFT", "active", "''"})
  void the_status_is_active_or_hidden(String status) {
    PSQLException error = insertRefused(200_000L, null, status, "IN_STOCK");

    assertThat(error.getSQLState()).isEqualTo(CHECK_VIOLATION);
    assertThat(error.getServerErrorMessage().getConstraint()).isEqualTo("products_status_valid");
  }

  @ParameterizedTest
  @CsvSource({"BACKORDER", "in_stock", "''"})
  void the_availability_is_in_stock_or_out_of_stock(String availability) {
    PSQLException error = insertRefused(200_000L, null, "ACTIVE", availability);

    assertThat(error.getSQLState()).isEqualTo(CHECK_VIOLATION);
    assertThat(error.getServerErrorMessage().getConstraint())
        .isEqualTo("products_availability_valid");
  }

  @Test
  void out_of_stock_is_accepted() {
    assertThatCode(() -> insert(200_000L, null, "ACTIVE", "OUT_OF_STOCK"))
        .doesNotThrowAnyException();
  }

  private void insert(long priceVnd, Long compareAtPriceVnd, String status, String availability) {
    jdbc.sql(
            """
            INSERT INTO app.products
                (id, name, slug, price_vnd, compare_at_price_vnd, status, availability)
            VALUES (?, 'Sản phẩm', ?, ?, ?, ?, ?)
            """)
        .params(
            UUID.randomUUID(),
            "sp-" + UUID.randomUUID(),
            priceVnd,
            compareAtPriceVnd,
            status,
            availability)
        .update();
  }

  private PSQLException insertRefused(
      long priceVnd, Long compareAtPriceVnd, String status, String availability) {
    Throwable thrown =
        catchThrowable(() -> insert(priceVnd, compareAtPriceVnd, status, availability));
    assertThat(thrown).as("the insert is refused").isNotNull();
    Throwable cause = NestedExceptionUtils.getMostSpecificCause(thrown);
    assertThat(cause).isInstanceOf(PSQLException.class);
    return (PSQLException) cause;
  }
}
