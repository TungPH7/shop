package com.tungph7.learnpostgres.feature.product.dto;

import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;

/**
 * The parameter {@code status} of the admin list: every product, or only the products of one
 * status. Only the admin list has it; the store always lists {@code ACTIVE} products (NFR9).
 */
public enum ProductStatusFilter {
  ALL(null),
  ACTIVE(ProductStatus.ACTIVE),
  HIDDEN(ProductStatus.HIDDEN);

  private final ProductStatus status;

  ProductStatusFilter(ProductStatus status) {
    this.status = status;
  }

  /** The one status to list, or {@code null} for every status. */
  public ProductStatus status() {
    return status;
  }
}
