package com.tungph7.learnpostgres.feature.category.dto;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import com.tungph7.learnpostgres.common.dto.ApiInstant;
import com.tungph7.learnpostgres.feature.category.domain.Category.CategoryStatus;
import com.tungph7.learnpostgres.feature.category.repository.CategoryQueryRepository.AdminRow;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * One category of the admin list: {@code AdminCategoryListItem} of the API Contract of the plan of
 * SHOP-81, {@code AdminCategory} with the number of its products.
 *
 * @param displayOrder always there, 0–9999 (plan of SHOP-95, API Contract)
 * @param productCount every product of the category, on sale or hidden (AC1, AC8)
 */
public record AdminCategoryListItem(
    UUID id,
    String name,
    String slug,
    CategoryStatus status,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int displayOrder,
    long productCount,
    @ApiInstant Instant createdAt,
    @ApiInstant Instant updatedAt,
    long version) {

  /** The item of a row of the admin list, its instants cut to milliseconds. */
  public static AdminCategoryListItem from(AdminRow row) {
    return new AdminCategoryListItem(
        row.id(),
        row.name(),
        row.slug(),
        row.status(),
        row.displayOrder(),
        row.productCount(),
        row.createdAt().truncatedTo(ChronoUnit.MILLIS),
        row.updatedAt().truncatedTo(ChronoUnit.MILLIS),
        row.version());
  }
}
