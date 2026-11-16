package com.tungph7.learnpostgres.feature.product.dto;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import com.tungph7.learnpostgres.common.dto.ApiInstant;
import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;

/**
 * A product as a shopper sees it: {@code StoreProduct} of the API Contract of the plan of SHOP-7.
 * It has no status, since a shopper only ever sees {@code ACTIVE} products (NFR9), and no version
 * or creation time. Prices are whole dong; the discount percent is computed by {@code user}.
 */
public record StoreProduct(
    UUID id,
    String name,
    String slug,
    long price,
    Long compareAtPrice,
    ProductAvailability availability,
    String description,
    @ApiInstant Instant updatedAt) {

  /**
   * The product as it was saved, with {@code updatedAt} cut to milliseconds ({@link ApiInstant}).
   */
  public static StoreProduct from(Product product) {
    Instant updatedAt = product.getUpdatedAt();
    return new StoreProduct(
        product.getId(),
        product.getName(),
        product.getSlug(),
        product.getPriceVnd(),
        product.getCompareAtPriceVnd(),
        product.getAvailability(),
        product.getDescription(),
        updatedAt == null ? null : updatedAt.truncatedTo(ChronoUnit.MILLIS));
  }
}
