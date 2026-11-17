package com.tungph7.learnpostgres.feature.product.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.EntityManager;

import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;

import com.tungph7.learnpostgres.common.error.BusinessException;
import com.tungph7.learnpostgres.common.error.ConflictException;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.logging.CorrelationContext;
import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.domain.ProductSlugs;
import com.tungph7.learnpostgres.feature.product.dto.CreateProductRequest;
import com.tungph7.learnpostgres.feature.product.dto.UpdateProductRequest;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository;
import com.tungph7.learnpostgres.feature.product.repository.ProductRepository;

/**
 * The retries of {@link AdminProductService} when the database refuses an insert or an update,
 * which the integration tests cannot make happen on purpose: a generated slug taken at every try, a
 * slug taken between the check and the write, and a constraint other than the slug.
 */
class AdminProductServiceTest {

  private ProductRepository repository;
  private AdminProductService service;

  @BeforeEach
  void setUp() {
    repository = mock(ProductRepository.class);
    CorrelationContext correlation = mock(CorrelationContext.class);
    when(correlation.currentId()).thenReturn(Optional.empty());
    service =
        new AdminProductService(
            repository, mock(ProductQueryRepository.class), correlation, mock(EntityManager.class));
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

  @Test
  void create_withoutSlug_readsTheTakenSlugsOnceAndTakesTheFirstFreeNumber() {
    when(repository.findSlugsAmong(any(String[].class)))
        .thenReturn(List.of("ao-thun", "Ao-Thun-2", "ao-thun-3", "ao-thun-5"));
    Product saved = savedProduct();
    when(repository.saveAndFlush(any(Product.class))).thenReturn(saved);

    service.create(request(null));

    assertThat(savedSlug()).isEqualTo("ao-thun-4");
    verify(repository, times(1)).findSlugsAmong(any(String[].class));
    verify(repository, never()).existsBySlug(anyString());
  }

  @Test
  void create_withoutSlug_asksForExactlyTheBaseAndItsNumberedSlugs() {
    when(repository.findSlugsAmong(any(String[].class))).thenReturn(List.of());
    Product saved = savedProduct();
    when(repository.saveAndFlush(any(Product.class))).thenReturn(saved);

    service.create(request(null));

    ArgumentCaptor<String[]> slugs = ArgumentCaptor.forClass(String[].class);
    verify(repository).findSlugsAmong(slugs.capture());
    assertThat(slugs.getValue())
        .hasSize(AdminProductService.MAX_SLUG_NUMBER)
        .startsWith("ao-thun", "ao-thun-2", "ao-thun-3")
        .endsWith("ao-thun-999", "ao-thun-1000")
        .doesNotHaveDuplicates();
  }

  @Test
  void slugCandidates_ofABaseCutForItsSuffix_areTheSlugsWithSuffixBuildsAndKeep100Characters() {
    String base = "ao-thun-" + "a".repeat(87) + "-bcde";

    List<String> candidates = AdminProductService.slugCandidates(base);

    assertThat(candidates.get(0)).isEqualTo(base);
    for (int number = 2; number <= AdminProductService.MAX_SLUG_NUMBER; number++) {
      assertThat(candidates.get(number - 1))
          .isEqualTo(ProductSlugs.withSuffix(base, number))
          .endsWith("-" + number);
    }
    assertThat(candidates)
        .hasSize(AdminProductService.MAX_SLUG_NUMBER)
        .doesNotHaveDuplicates()
        .allSatisfy(slug -> assertThat(ProductSlugs.isValid(slug)).as(slug).isTrue());
  }

  @Test
  void create_withoutSlug_whenEveryNumberUpToTheLimitIsTaken_returns409AndSavesNothing() {
    List<String> taken = new ArrayList<>(List.of("ao-thun"));
    for (int number = 2; number <= AdminProductService.MAX_SLUG_NUMBER; number++) {
      taken.add("ao-thun-" + number);
    }
    when(repository.findSlugsAmong(any(String[].class))).thenReturn(taken);

    assertThatThrownBy(() -> service.create(request(null)))
        .isInstanceOf(ConflictException.class)
        .extracting(e -> ((BusinessException) e).getCode())
        .isEqualTo(ErrorCode.PRODUCT_SLUG_DUPLICATED);

    verify(repository, never()).saveAndFlush(any(Product.class));
  }

  @Test
  void create_withALongName_takesTheFirstFreeSlugOfTheBaseCutForItsSuffix() {
    String base = "a".repeat(100);
    when(repository.findSlugsAmong(any(String[].class)))
        .thenReturn(List.of(base, "a".repeat(98) + "-2"));
    Product saved = savedProduct();
    when(repository.saveAndFlush(any(Product.class))).thenReturn(saved);

    service.create(
        new CreateProductRequest(
            "a".repeat(150), null, null, new BigDecimal("1"), null, null, null));

    assertThat(savedSlug()).isEqualTo("a".repeat(98) + "-3");
  }

  /**
   * An edit to a slug another edit or add takes between the check and the write: the UNIQUE
   * constraint stops it, and it is the same 409 as a slug taken before (NFR12).
   */
  @Test
  void update_toASlugTakenMeanwhile_returns409SlugDuplicated() {
    UUID id = UUID.randomUUID();
    Product stored = storedProduct();
    when(repository.findById(id)).thenReturn(Optional.of(stored));
    when(repository.existsBySlug("ao-thun-basic")).thenReturn(false);
    when(repository.saveAndFlush(any(Product.class))).thenThrow(violation("products_slug_unique"));

    assertThatThrownBy(() -> service.update(id, updateRequest("ao-thun-basic")))
        .isInstanceOf(ConflictException.class)
        .extracting(e -> ((BusinessException) e).getCode())
        .isEqualTo(ErrorCode.PRODUCT_SLUG_DUPLICATED);
  }

  @Test
  void update_whenAnotherConstraintFails_passesTheErrorOn() {
    UUID id = UUID.randomUUID();
    DataIntegrityViolationException other = violation("products_price_vnd_valid");
    Product stored = storedProduct();
    when(repository.findById(id)).thenReturn(Optional.of(stored));
    when(repository.saveAndFlush(any(Product.class))).thenThrow(other);

    assertThatThrownBy(() -> service.update(id, updateRequest("ao-thun"))).isSameAs(other);
  }

  /** A stored product at version 0, slug {@code ao-thun}. */
  private static Product storedProduct() {
    Product stored = mock(Product.class);
    when(stored.getVersion()).thenReturn(0L);
    when(stored.getSlug()).thenReturn("ao-thun");
    return stored;
  }

  private static UpdateProductRequest updateRequest(String slug) {
    return new UpdateProductRequest(
        "Áo thun",
        slug,
        null,
        new BigDecimal("200000"),
        null,
        ProductStatus.ACTIVE,
        ProductAvailability.IN_STOCK,
        0L);
  }

  /** The product the repository returns once saved: only its version is read back. */
  private static Product savedProduct() {
    Product saved = mock(Product.class);
    when(saved.getVersion()).thenReturn(0L);
    return saved;
  }

  /** The slug of the product the service handed to the repository. */
  private String savedSlug() {
    ArgumentCaptor<Product> product = ArgumentCaptor.forClass(Product.class);
    verify(repository).saveAndFlush(product.capture());
    return product.getValue().getSlug();
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
