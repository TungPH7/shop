package com.tungph7.learnpostgres.feature.product.dto;

import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;

/**
 * The parameter {@code status} of the admin list: every product, or only the products of one
 * status. Only the admin list has it; the store always lists {@code ACTIVE} products (NFR9).
 */
public enum ProductStatusFilter {
  ALL(EnumSet.allOf(ProductStatus.class)),
  ACTIVE(EnumSet.of(ProductStatus.ACTIVE)),
  HIDDEN(EnumSet.of(ProductStatus.HIDDEN));

  private final Set<ProductStatus> statuses;

  ProductStatusFilter(Set<ProductStatus> statuses) {
    this.statuses = Collections.unmodifiableSet(statuses);
  }

  /** The statuses to list: every status for {@link #ALL}, else the one status. */
  public Set<ProductStatus> statuses() {
    return statuses;
  }
}
