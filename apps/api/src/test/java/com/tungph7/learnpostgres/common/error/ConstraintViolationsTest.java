package com.tungph7.learnpostgres.common.error;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.SQLException;

import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * SHOP-59: the name of the broken constraint is read from Hibernate, never from the text of the
 * driver, for both the code of the error and the log line.
 */
class ConstraintViolationsTest {

  @Test
  void nameOf_readsTheConstraintNameOfHibernate_throughTheWrappers() {
    DataIntegrityViolationException ex =
        new DataIntegrityViolationException(
            "could not execute statement", violation("products_slug_unique"));

    assertThat(ConstraintViolations.nameOf(ex)).contains("products_slug_unique");
  }

  @Test
  void nameOf_ofADriverMessageOnly_isEmpty_evenWhenTheMessageNamesAConstraint() {
    DataIntegrityViolationException ex =
        new DataIntegrityViolationException(
            "wrapper",
            new RuntimeException(
                "duplicate key value violates unique constraint \"products_slug_unique\""));

    assertThat(ConstraintViolations.nameOf(ex)).isEmpty();
  }

  @Test
  void nameOf_skipsAViolationWithoutName_andReadsTheNamedOneBelow() {
    ConstraintViolationException unnamed =
        new ConstraintViolationException(
            "outer", new SQLException("ERROR", violation("products_price_vnd_valid")), null);

    assertThat(ConstraintViolations.nameOf(new DataIntegrityViolationException("w", unnamed)))
        .contains("products_price_vnd_valid");
  }

  @Test
  void isViolationOf_comparesTheNameIgnoringCase() {
    DataIntegrityViolationException ex =
        new DataIntegrityViolationException("w", violation("PRODUCTS_SLUG_UNIQUE"));

    assertThat(ConstraintViolations.isViolationOf(ex, ConstraintViolations.PRODUCT_SLUG_UNIQUE))
        .isTrue();
  }

  @Test
  void isViolationOf_anotherConstraint_isFalse_evenWhenTheDriverMessageSaysUniqueAndSlug() {
    DataIntegrityViolationException ex =
        new DataIntegrityViolationException(
            "w",
            new ConstraintViolationException(
                "could not execute statement",
                new SQLException("duplicate key value violates unique constraint on slug_history"),
                "slug_history_unique"));

    assertThat(ConstraintViolations.isViolationOf(ex, ConstraintViolations.PRODUCT_SLUG_UNIQUE))
        .isFalse();
  }

  @Test
  void isViolationOf_ofAnExceptionWithoutViolation_isFalse() {
    assertThat(
            ConstraintViolations.isViolationOf(
                new IllegalStateException("products_slug_unique"),
                ConstraintViolations.PRODUCT_SLUG_UNIQUE))
        .isFalse();
  }

  private static ConstraintViolationException violation(String constraint) {
    return new ConstraintViolationException(
        "could not execute statement", new SQLException("ERROR"), constraint);
  }
}
