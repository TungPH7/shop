package com.tungph7.learnpostgres.feature.category.dto;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import com.tungph7.learnpostgres.common.dto.ApiInstant;

/**
 * One category of the sitemap of the store: {@code CategorySitemapEntry} of the API Contract of the
 * plan of SHOP-81.
 *
 * @param slug the slug as stored
 * @param updatedAt the later of the last update of the category and of its {@code ACTIVE} products
 *     (AC19), cut to milliseconds ({@link ApiInstant})
 */
public record CategorySitemapEntry(String slug, @ApiInstant Instant updatedAt) {

  public CategorySitemapEntry {
    updatedAt = updatedAt == null ? null : updatedAt.truncatedTo(ChronoUnit.MILLIS);
  }
}
