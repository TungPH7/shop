package com.tungph7.learnpostgres.feature.product.dto;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import com.tungph7.learnpostgres.common.dto.ApiInstant;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.SitemapRow;

/**
 * One product of the sitemap of the store: {@code SitemapEntry} of the API Contract of the plan of
 * SHOP-7. {@code user} builds the URL of the product page from the slug, and its {@code lastmod}
 * from {@code updatedAt} (AC28).
 *
 * @param slug the slug as saved, which is the canonical one
 * @param updatedAt the last update of the product
 */
public record SitemapEntry(String slug, @ApiInstant Instant updatedAt) {

  /** The row as it was read, with {@code updatedAt} cut to milliseconds ({@link ApiInstant}). */
  public static SitemapEntry from(SitemapRow row) {
    return new SitemapEntry(row.slug(), row.updatedAt().truncatedTo(ChronoUnit.MILLIS));
  }
}
