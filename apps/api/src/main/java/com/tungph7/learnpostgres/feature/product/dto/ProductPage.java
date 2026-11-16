package com.tungph7.learnpostgres.feature.product.dto;

import java.util.List;

/**
 * One page of a product list: {@code Page<T>} of the API Contract of the plan of SHOP-7.
 *
 * @param items the products of the page, in the order of the list
 * @param totalItems every product that matches the filters, not only those of the page
 * @param offset the offset of the request
 * @param limit the limit of the request
 */
public record ProductPage<T>(List<T> items, long totalItems, int offset, int limit) {

  public ProductPage {
    items = List.copyOf(items);
  }
}
