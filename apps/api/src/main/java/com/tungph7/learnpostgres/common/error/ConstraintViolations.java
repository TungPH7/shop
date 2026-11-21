package com.tungph7.learnpostgres.common.error;

import java.util.Optional;

import org.hibernate.exception.ConstraintViolationException;

/**
 * Reads which database constraint a failed statement broke, from the name Hibernate gives it in
 * {@link ConstraintViolationException}, and never from the text of the driver message (SHOP-59).
 *
 * <p>The code of an error and the log line that tells of it read the same name, so they cannot
 * disagree; and the message of the driver, which may carry the values of the row, is not read.
 */
public final class ConstraintViolations {

  /** The UNIQUE constraint on {@code app.products.slug} (V3). */
  public static final String PRODUCT_SLUG_UNIQUE = "products_slug_unique";

  /** The UNIQUE constraint on {@code app.categories.name}, collation {@code app.vi_ci} (V7). */
  public static final String CATEGORY_NAME_UNIQUE = "categories_name_unique";

  /** The UNIQUE constraint on {@code app.categories.slug} (V7). */
  public static final String CATEGORY_SLUG_UNIQUE = "categories_slug_unique";

  /**
   * The foreign key of {@code app.products.category_id} (V7, ADR-0004): a product written with a
   * category that is gone, such as one deleted in another tab (AC10).
   */
  public static final String PRODUCT_CATEGORY_FK = "products_category_fk";

  /** The field of the request a violation of {@link #PRODUCT_CATEGORY_FK} is reported on. */
  public static final String CATEGORY_ID_FIELD = "categoryId";

  /**
   * The message of a {@code categoryId} that names no category: the same for the check before the
   * write and for {@link #PRODUCT_CATEGORY_FK} (plan of SHOP-81, API Contract).
   */
  public static final String NOT_AN_EXISTING_CATEGORY = "must be an existing category";

  private ConstraintViolations() {}

  /**
   * The name of the first constraint violation with a name in the causes of {@code failure}, {@code
   * failure} itself first; empty when there is none.
   */
  public static Optional<String> nameOf(Throwable failure) {
    for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
      if (cause instanceof ConstraintViolationException violation
          && violation.getConstraintName() != null) {
        return Optional.of(violation.getConstraintName());
      }
    }
    return Optional.empty();
  }

  /** Whether {@code failure} broke the constraint {@code constraint}, its name in any case. */
  public static boolean isViolationOf(Throwable failure, String constraint) {
    return nameOf(failure).filter(constraint::equalsIgnoreCase).isPresent();
  }
}
