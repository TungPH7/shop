package com.tungph7.learnpostgres.feature.product.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.tungph7.learnpostgres.feature.product.domain.ProductSort;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Criteria;

/**
 * The guards of {@link Criteria}: the API checks its parameters first (NFR3), so a value out of
 * range here is a programming error, never a list of every product.
 */
class ProductQueryRepositoryCriteriaTest {

  @ParameterizedTest
  @ValueSource(ints = {1, 24, 100})
  void criteria_takesALimitFrom1To100(int limit) {
    assertThat(new Criteria(null, null, ProductSort.NEWEST, 0, limit).limit()).isEqualTo(limit);
  }

  @ParameterizedTest
  @ValueSource(ints = {-1, 0, 101, 1000})
  void criteria_withALimitOutOf1To100_isRefused(int limit) {
    assertThatThrownBy(() -> new Criteria(null, null, ProductSort.NEWEST, 0, limit))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("limit");
  }

  @Test
  void criteria_withANegativeOffset_isRefused() {
    assertThatThrownBy(() -> new Criteria(null, null, ProductSort.NEWEST, -1, 20))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("offset");
  }

  @Test
  void criteria_withoutSort_isRefused() {
    assertThatThrownBy(() -> new Criteria(null, null, null, 0, 20))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("sort");
  }

  @Test
  void criteria_byRelevanceWithoutAKeyword_isRefused() {
    assertThatThrownBy(() -> new Criteria(null, null, ProductSort.RELEVANCE, 0, 20))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("RELEVANCE");
  }

  @Test
  void criteria_byRelevanceWithAKeyword_isTaken() {
    ProductSearchTerms search = ProductSearchTerms.of("ao thun").orElseThrow();

    assertThat(new Criteria(search, null, ProductSort.RELEVANCE, 0, 20).search()).isSameAs(search);
  }
}
