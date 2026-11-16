package com.tungph7.learnpostgres.feature.product.dto;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;

/**
 * A product as the admin API returns it: {@code AdminProduct} of the API Contract of the plan of
 * SHOP-7. Prices are whole dong; {@code version} is sent back when the product is edited (AC13).
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
    Instant createdAt,
    Instant updatedAt,
    long version) {

  /**
   * The product as it was saved. The instants are cut to milliseconds, as the API Contract writes
   * them: the clock of the JVM may give nanoseconds, the database keeps microseconds, and a later
   * read must not show another value.
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
        product.getVersion());
  }

  private static Instant toMillis(Instant instant) {
    return instant == null ? null : instant.truncatedTo(ChronoUnit.MILLIS);
  }
}
