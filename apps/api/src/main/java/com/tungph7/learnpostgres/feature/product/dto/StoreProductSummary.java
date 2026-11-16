package com.tungph7.learnpostgres.feature.product.dto;

import java.util.UUID;

import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Row;

/**
 * A product of the store list: {@code StoreProductSummary} of the API Contract of the plan of
 * SHOP-7. Like {@link StoreProduct}, it has no status, since a shopper only ever sees {@code
 * ACTIVE} products (NFR9). Prices are whole dong; the discount percent is computed by {@code user}.
 */
public record StoreProductSummary(
    UUID id,
    String name,
    String slug,
    long price,
    Long compareAtPrice,
    ProductAvailability availability) {

  /** The store fields of a list row. */
  public static StoreProductSummary from(Row row) {
    return new StoreProductSummary(
        row.id(),
        row.name(),
        row.slug(),
        row.priceVnd(),
        row.compareAtPriceVnd(),
        row.availability());
  }
}
