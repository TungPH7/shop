package com.tungph7.learnpostgres.feature.product.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import com.tungph7.learnpostgres.common.error.BusinessException;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.error.NotFoundException;
import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.domain.ProductSort;
import com.tungph7.learnpostgres.feature.product.dto.ProductPage;
import com.tungph7.learnpostgres.feature.product.dto.SitemapEntry;
import com.tungph7.learnpostgres.feature.product.dto.StoreProduct;
import com.tungph7.learnpostgres.feature.product.dto.StoreProductSummary;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Criteria;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Result;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Row;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.SitemapResult;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.SitemapRow;
import com.tungph7.learnpostgres.feature.product.repository.ProductRepository;

/**
 * {@link StoreProductService}: a shopper sees a product only while it is {@code ACTIVE}, and a
 * hidden product is the same 404 as a slug that never existed (NFR9). The list asks the query
 * repository for {@code ACTIVE} products only, newest first (SHOP-26).
 */
class StoreProductServiceTest {

  private static final UUID ID = UUID.fromString("019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f");
  private static final UUID OTHER_ID = UUID.fromString("019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e70");

  private ProductRepository repository;
  private ProductQueryRepository queryRepository;
  private StoreProductService service;

  @BeforeEach
  void setUp() {
    repository = mock(ProductRepository.class);
    queryRepository = mock(ProductQueryRepository.class);
    service = new StoreProductService(repository, queryRepository);
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

  // ============================================================
  // list (SHOP-26)
  // ============================================================

  @Test
  void list_asksForActiveProductsOnly_newestFirst_withNoSearch() {
    when(queryRepository.findPage(any())).thenReturn(new Result(List.of(), 0));

    service.list(48, 24);

    ArgumentCaptor<Criteria> criteria = ArgumentCaptor.forClass(Criteria.class);
    verify(queryRepository).findPage(criteria.capture());
    assertThat(criteria.getValue())
        .isEqualTo(new Criteria(null, Set.of(ProductStatus.ACTIVE), ProductSort.NEWEST, 48, 24));
  }

  @Test
  void list_returnsTheStoreFieldsOfEachRow_inTheOrderOfTheRepository() {
    Row first = row(ID, "Áo thun cổ tròn", "ao-thun-co-tron", 1_250_000L, 1_500_000L);
    Row second = row(OTHER_ID, "Bao tay len", "bao-tay-len", 90_000L, null);
    when(queryRepository.findPage(any())).thenReturn(new Result(List.of(first, second), 30));

    ProductPage<StoreProductSummary> page = service.list(0, 24);

    assertThat(page.items())
        .containsExactly(
            new StoreProductSummary(
                ID,
                "Áo thun cổ tròn",
                "ao-thun-co-tron",
                1_250_000L,
                1_500_000L,
                ProductAvailability.OUT_OF_STOCK),
            new StoreProductSummary(
                OTHER_ID,
                "Bao tay len",
                "bao-tay-len",
                90_000L,
                null,
                ProductAvailability.OUT_OF_STOCK));
  }

  @Test
  void list_returnsTheTotalOfTheRepository_andTheOffsetAndLimitOfTheRequest() {
    when(queryRepository.findPage(any())).thenReturn(new Result(List.of(), 30));

    ProductPage<StoreProductSummary> page = service.list(24, 24);

    assertThat(page.totalItems()).isEqualTo(30);
    assertThat(page.offset()).isEqualTo(24);
    assertThat(page.limit()).isEqualTo(24);
  }

  // ============================================================
  // sitemap (SHOP-32)
  // ============================================================

  @Test
  void sitemap_asksTheRepositoryForTheBlockOfTheRequest() {
    when(queryRepository.findSitemapPage(2_000, 1_000)).thenReturn(new SitemapResult(List.of(), 0));

    service.sitemap(2_000, 1_000);

    verify(queryRepository).findSitemapPage(2_000, 1_000);
  }

  @Test
  void sitemap_returnsTheSlugAndTheLastUpdateCutToMilliseconds_inTheOrderOfTheRepository() {
    when(queryRepository.findSitemapPage(0, 1_000))
        .thenReturn(
            new SitemapResult(
                List.of(
                    new SitemapRow("ao-thun-co-tron", Instant.parse("2026-11-16T02:15:30.123456Z")),
                    new SitemapRow("Ao-Thun-Cu", Instant.parse("2026-11-16T02:15:31Z"))),
                2));

    ProductPage<SitemapEntry> page = service.sitemap(0, 1_000);

    assertThat(page.items())
        .containsExactly(
            new SitemapEntry("ao-thun-co-tron", Instant.parse("2026-11-16T02:15:30.123Z")),
            new SitemapEntry("Ao-Thun-Cu", Instant.parse("2026-11-16T02:15:31Z")));
  }

  @Test
  void sitemap_returnsTheTotalOfTheRepository_andTheOffsetAndLimitOfTheRequest() {
    when(queryRepository.findSitemapPage(1_000, 500))
        .thenReturn(new SitemapResult(List.of(), 1_234));

    ProductPage<SitemapEntry> page = service.sitemap(1_000, 500);

    assertThat(page.totalItems()).isEqualTo(1_234);
    assertThat(page.offset()).isEqualTo(1_000);
    assertThat(page.limit()).isEqualTo(500);
  }

  private static Row row(UUID id, String name, String slug, long price, Long compareAtPrice) {
    Instant at = Instant.parse("2026-11-16T02:15:30Z");
    return new Row(
        id,
        name,
        slug,
        price,
        compareAtPrice,
        ProductStatus.ACTIVE,
        ProductAvailability.OUT_OF_STOCK,
        at,
        at);
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
