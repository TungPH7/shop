package com.tungph7.learnpostgres.feature.product.dto;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Row;

/**
 * A product of the admin list: {@code AdminProductSummary} of the API Contract of the plan of
 * SHOP-7. The price is whole dong, and may be 0 or above 999,999,999 for a hidden product written
 * before the Epic (NFR16).
 */
public record AdminProductSummary(
    UUID id,
    String name,
    String slug,
    long price,
    ProductStatus status,
    ProductAvailability availability,
    Instant createdAt,
    Instant updatedAt) {

  /** The product of a list row, with the instants cut to milliseconds as {@link AdminProduct}. */
  public static AdminProductSummary from(Row row) {
    return new AdminProductSummary(
        row.id(),
        row.name(),
        row.slug(),
        row.priceVnd(),
        row.status(),
        row.availability(),
        row.createdAt().truncatedTo(ChronoUnit.MILLIS),
        row.updatedAt().truncatedTo(ChronoUnit.MILLIS));
  }
}
