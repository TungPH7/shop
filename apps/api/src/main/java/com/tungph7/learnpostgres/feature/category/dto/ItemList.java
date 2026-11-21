package com.tungph7.learnpostgres.feature.category.dto;

import java.util.List;

/**
 * A list returned whole in one response, without pages: {@code ItemList<T>} of the API Contract of
 * the plan of SHOP-81 (NFR1). An object around the array, so pages can be added later without
 * changing the type.
 */
public record ItemList<T>(List<T> items) {

  public ItemList {
    items = List.copyOf(items);
  }
}
