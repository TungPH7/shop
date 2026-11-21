package com.tungph7.learnpostgres.feature.product.dto;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import com.tungph7.learnpostgres.common.dto.ApiInstant;
import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;

/**
 * A product as the admin API returns it: {@code AdminProduct} of the API Contract of the plan of
 * SHOP-7. Prices are whole dong; {@code version} is sent back when the product is edited (AC13).
 * {@code categoryId} is the category of the product, hidden too, or {@code null} (SHOP-81).
 */
public record AdminProduct(
    UUID id,
    String name,
    String slug,
    String description,
    long price,
    Long compareAtPrice,
    ProductStatus status,
    ProductAvailability availability,
    @ApiInstant Instant createdAt,
    @ApiInstant Instant updatedAt,
    long version,
    UUID categoryId) {

  /**
   * The product as it was saved. The instants are cut to milliseconds, as the API Contract writes
   * them ({@link ApiInstant}). They are already in microseconds, the precision the database keeps
   * (see {@code JpaAuditingConfig}), so a later read of the product cuts the same value and shows
   * the same milliseconds.
   */
  public static AdminProduct from(Product product) {
    return new AdminProduct(
        product.getId(),
        product.getName(),
        product.getSlug(),
        product.getDescription(),
        product.getPriceVnd(),
        product.getCompareAtPriceVnd(),
        product.getStatus(),
        product.getAvailability(),
        toMillis(product.getCreatedAt()),
        toMillis(product.getUpdatedAt()),
        product.getVersion(),
        product.getCategoryId());
  }

  private static Instant toMillis(Instant instant) {
    return instant == null ? null : instant.truncatedTo(ChronoUnit.MILLIS);
  }
}
