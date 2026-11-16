package com.tungph7.learnpostgres.feature.product.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.tungph7.learnpostgres.common.error.BusinessException;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.error.NotFoundException;
import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.dto.StoreProduct;
import com.tungph7.learnpostgres.feature.product.repository.ProductRepository;

/**
 * {@link StoreProductService}: a shopper sees a product only while it is {@code ACTIVE}, and a
 * hidden product is the same 404 as a slug that never existed (NFR9).
 */
class StoreProductServiceTest {

  private static final UUID ID = UUID.fromString("019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f");

  private ProductRepository repository;
  private StoreProductService service;

  @BeforeEach
  void setUp() {
    repository = mock(ProductRepository.class);
    service = new StoreProductService(repository);
  }

  @Test
  void get_anActiveProduct_returnsItsStoreFields() {
    Product product = product(ProductStatus.ACTIVE, Instant.parse("2026-11-16T02:15:30.123456Z"));
    when(repository.findBySlugIgnoringCase("ao-thun-co-tron")).thenReturn(Optional.of(product));

    StoreProduct found = service.get("ao-thun-co-tron");

    assertThat(found)
        .isEqualTo(
            new StoreProduct(
                ID,
                "Áo thun cổ tròn",
                "ao-thun-co-tron",
                200_000L,
                250_000L,
                ProductAvailability.IN_STOCK,
                "Áo thun cotton 100%.\nCổ tròn, tay ngắn.",
                Instant.parse("2026-11-16T02:15:30.123Z")));
  }

  @Test
  void get_aHiddenProduct_throwsProductNotFound() {
    when(repository.findBySlugIgnoringCase("ao-thun-co-tron"))
        .thenReturn(Optional.of(product(ProductStatus.HIDDEN, Instant.now())));

    assertThatThrownBy(() -> service.get("ao-thun-co-tron"))
        .isInstanceOf(NotFoundException.class)
        .hasMessage("Product not found.")
        .extracting(e -> ((BusinessException) e).getCode())
        .isEqualTo(ErrorCode.PRODUCT_NOT_FOUND);
  }

  @Test
  void get_aSlugWithNoProduct_throwsProductNotFound() {
    when(repository.findBySlugIgnoringCase("khong-co")).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.get("khong-co"))
        .isInstanceOf(NotFoundException.class)
        .hasMessage("Product not found.")
        .extracting(e -> ((BusinessException) e).getCode())
        .isEqualTo(ErrorCode.PRODUCT_NOT_FOUND);
  }

  @Test
  void get_aHiddenProduct_carriesNoPropertyThatTellsItApartFromAMissingOne() {
    when(repository.findBySlugIgnoringCase("an"))
        .thenReturn(Optional.of(product(ProductStatus.HIDDEN, null)));

    assertThatThrownBy(() -> service.get("an"))
        .extracting(e -> ((BusinessException) e).getProperties())
        .isEqualTo(Map.of());
  }

  @Test
  void isVisible_anActiveProduct_isTrue() {
    when(repository.findBySlugIgnoringCase("ao-thun-co-tron"))
        .thenReturn(Optional.of(product(ProductStatus.ACTIVE, null)));

    assertThat(service.isVisible("ao-thun-co-tron")).isTrue();
  }

  @Test
  void isVisible_aHiddenProduct_isFalse() {
    when(repository.findBySlugIgnoringCase("ao-thun-co-tron"))
        .thenReturn(Optional.of(product(ProductStatus.HIDDEN, null)));

    assertThat(service.isVisible("ao-thun-co-tron")).isFalse();
  }

  @Test
  void isVisible_aSlugWithNoProduct_isFalse() {
    when(repository.findBySlugIgnoringCase("khong-co")).thenReturn(Optional.empty());

    assertThat(service.isVisible("khong-co")).isFalse();
  }

  private static Product product(ProductStatus status, Instant updatedAt) {
    Product product =
        new Product(
            "Áo thun cổ tròn",
            "ao-thun-co-tron",
            "Áo thun cotton 100%.\nCổ tròn, tay ngắn.",
            200_000L,
            250_000L,
            status,
            ProductAvailability.IN_STOCK);
    ReflectionTestUtils.setField(product, "id", ID);
    ReflectionTestUtils.setField(product, "updatedAt", updatedAt);
    return product;
  }
}
