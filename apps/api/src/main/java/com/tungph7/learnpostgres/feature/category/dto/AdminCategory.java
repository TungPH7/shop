package com.tungph7.learnpostgres.feature.category.dto;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import com.tungph7.learnpostgres.common.dto.ApiInstant;
import com.tungph7.learnpostgres.feature.category.domain.Category;
import com.tungph7.learnpostgres.feature.category.domain.Category.CategoryStatus;

/**
 * A category as the admin API returns it: {@code AdminCategory} of the API Contract of the plan of
 * SHOP-81. {@code version} is sent back when the category is edited (NFR12).
 */
public record AdminCategory(
    UUID id,
    String name,
    String slug,
    CategoryStatus status,
    @ApiInstant Instant createdAt,
    @ApiInstant Instant updatedAt,
    long version) {

  /** The category as it was saved, with its instants cut to milliseconds ({@link ApiInstant}). */
  public static AdminCategory from(Category category) {
    return new AdminCategory(
        category.getId(),
        category.getName(),
        category.getSlug(),
        category.getStatus(),
        toMillis(category.getCreatedAt()),
        toMillis(category.getUpdatedAt()),
        category.getVersion());
  }

  private static Instant toMillis(Instant instant) {
    return instant == null ? null : instant.truncatedTo(ChronoUnit.MILLIS);
  }
}
