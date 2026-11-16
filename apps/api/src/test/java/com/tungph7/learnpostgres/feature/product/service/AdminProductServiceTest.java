package com.tungph7.learnpostgres.feature.product.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.Optional;

import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import com.tungph7.learnpostgres.common.error.BusinessException;
import com.tungph7.learnpostgres.common.error.ConflictException;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.logging.CorrelationContext;
import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.dto.CreateProductRequest;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository;
import com.tungph7.learnpostgres.feature.product.repository.ProductRepository;

/**
 * The retries of {@link AdminProductService} when the database refuses an insert, which the
 * integration test cannot make happen on purpose: a generated slug taken at every try, and a
 * constraint other than the slug.
 */
class AdminProductServiceTest {

  private ProductRepository repository;
  private AdminProductService service;

  @BeforeEach
  void setUp() {
    repository = mock(ProductRepository.class);
    CorrelationContext correlation = mock(CorrelationContext.class);
    when(correlation.currentId()).thenReturn(Optional.empty());
    service = new AdminProductService(repository, mock(ProductQueryRepository.class), correlation);
  }

  @Test
  void create_whenTheGeneratedSlugIsTakenAtEveryTry_stopsAfterThreeRetriesWith409() {
    when(repository.existsBySlug(anyString())).thenReturn(false);
    when(repository.saveAndFlush(any(Product.class))).thenThrow(violation("products_slug_unique"));

    assertThatThrownBy(() -> service.create(request(null)))
        .isInstanceOf(ConflictException.class)
        .extracting(e -> ((BusinessException) e).getCode())
        .isEqualTo(ErrorCode.PRODUCT_SLUG_DUPLICATED);

    verify(repository, times(1 + AdminProductService.MAX_SLUG_RETRIES))
        .saveAndFlush(any(Product.class));
  }

  @Test
  void create_withAGeneratedSlug_whenAnotherConstraintFails_doesNotRetry() {
    DataIntegrityViolationException other = violation("products_price_vnd_valid");
    when(repository.existsBySlug(anyString())).thenReturn(false);
    when(repository.saveAndFlush(any(Product.class))).thenThrow(other);

    assertThatThrownBy(() -> service.create(request(null))).isSameAs(other);

    verify(repository, times(1)).saveAndFlush(any(Product.class));
  }

  @Test
  void create_withATypedSlug_whenAnotherConstraintFails_passesTheErrorOn() {
    DataIntegrityViolationException other =
        new DataIntegrityViolationException("no constraint name");
    when(repository.existsBySlug(anyString())).thenReturn(false);
    when(repository.saveAndFlush(any(Product.class))).thenThrow(other);

    assertThatThrownBy(() -> service.create(request("ao-thun"))).isSameAs(other);
  }

  private static CreateProductRequest request(String slug) {
    return new CreateProductRequest(
        "Áo thun", slug, null, new BigDecimal("200000"), null, null, null);
  }

  private static DataIntegrityViolationException violation(String constraint) {
    return new DataIntegrityViolationException(
        "could not execute statement",
        new ConstraintViolationException(
            "duplicate key", new SQLException("duplicate key", "23505"), constraint));
  }
}
