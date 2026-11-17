package com.tungph7.learnpostgres.common.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.io.PrintWriter;
import java.io.StringWriter;

import jakarta.persistence.EntityManager;

import org.assertj.core.api.InstanceOfAssertFactories;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;
import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.repository.ProductRepository;

/**
 * NFR12, SHOP-53: by default PgJDBC puts the values of a failed statement into its exceptions, as
 * {@code Batch entry 0 insert … values (…)} and {@code Failing row contains (…)}, and {@code
 * GlobalExceptionHandler.handleAny} logs the whole chain with its stack trace. {@code
 * logServerErrorDetail=false} in {@code application.yml} keeps them out, for every profile and
 * every URL; the name of the constraint stays, so a duplicate slug is still told apart.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(JpaAuditingConfig.class)
class JdbcServerErrorDetailIntegrationTest extends AbstractContainerBaseTest {

  @Autowired ProductRepository repository;
  @Autowired EntityManager em;

  @Test
  void aFailedInsert_namesItsConstraint_butCarriesNoValueOfTheRow() {
    // An ACTIVE product at 0 VND breaks products_price_vnd_valid.
    repository.save(
        new Product(
            "Ao thun SHOP53",
            "ao-thun-shop53",
            "mo-ta-shop53",
            0L,
            null,
            ProductStatus.ACTIVE,
            ProductAvailability.IN_STOCK));

    Throwable failure = catchThrowable(em::flush);

    assertThat(failure)
        .asInstanceOf(InstanceOfAssertFactories.type(ConstraintViolationException.class))
        .extracting(ConstraintViolationException::getConstraintName)
        .isEqualTo("products_price_vnd_valid");
    assertThat(stackTraceOf(failure))
        .contains("products_price_vnd_valid")
        .doesNotContain("Ao thun SHOP53")
        .doesNotContain("ao-thun-shop53")
        .doesNotContain("mo-ta-shop53")
        .doesNotContain("Failing row contains");
  }

  /** The text {@code handleAny} would log: every message and cause, with the stack trace. */
  private static String stackTraceOf(Throwable failure) {
    StringWriter out = new StringWriter();
    failure.printStackTrace(new PrintWriter(out));
    return out.toString();
  }
}
