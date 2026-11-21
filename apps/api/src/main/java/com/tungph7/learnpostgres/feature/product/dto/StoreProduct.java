package com.tungph7.learnpostgres.feature.product.dto;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import com.tungph7.learnpostgres.common.dto.ApiInstant;
import com.tungph7.learnpostgres.feature.category.dto.StoreCategory;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.DetailRow;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * A product as a shopper sees it: {@code StoreProduct} of the API Contract of the plan of SHOP-7,
 * with its category of the plan of SHOP-81. It has no status, since a shopper only ever sees {@code
 * ACTIVE} products (NFR9), and no version or creation time. Prices are whole dong; the discount
 * percent is computed by {@code user}.
 *
 * @param category the category of the product when it is {@code VISIBLE}, as {@code StoreCategory}
 *     of the API Contract of SHOP-81; {@code null} when the product has none or its category is
 *     hidden, the same in both cases (AC21, NFR8)
 */
public record StoreProduct(
    UUID id,
    String name,
    String slug,
    long price,
    Long compareAtPrice,
    ProductAvailability availability,
    String description,
    @ApiInstant Instant updatedAt,
    @Schema(
            nullable = true,
            description =
                "The category of the product when it is VISIBLE; null when the product has none or"
                    + " its category is hidden")
        StoreCategory category) {

  /**
   * The product of a detail row, with {@code updatedAt} cut to milliseconds ({@link ApiInstant}).
   */
  public static StoreProduct from(DetailRow row) {
    return new StoreProduct(
        row.id(),
        row.name(),
        row.slug(),
        row.priceVnd(),
        row.compareAtPriceVnd(),
        row.availability(),
        row.description(),
        row.updatedAt().truncatedTo(ChronoUnit.MILLIS),
        row.categorySlug() == null
            ? null
            : new StoreCategory(row.categoryName(), row.categorySlug()));
  }
}
