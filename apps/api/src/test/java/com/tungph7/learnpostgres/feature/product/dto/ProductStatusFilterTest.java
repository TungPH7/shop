package com.tungph7.learnpostgres.feature.product.dto;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;

/** The statuses each value of the admin parameter {@code status} lists. */
class ProductStatusFilterTest {

  @Test
  void all_listsEveryStatus() {
    assertThat(ProductStatusFilter.ALL.statuses())
        .containsExactlyInAnyOrder(ProductStatus.values());
  }

  @Test
  void active_listsOnlyActive() {
    assertThat(ProductStatusFilter.ACTIVE.statuses()).containsExactly(ProductStatus.ACTIVE);
  }

  @Test
  void hidden_listsOnlyHidden() {
    assertThat(ProductStatusFilter.HIDDEN.statuses()).containsExactly(ProductStatus.HIDDEN);
  }
}
