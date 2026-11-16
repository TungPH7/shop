package com.tungph7.learnpostgres.feature.product.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.EnumSet;
import java.util.HashSet;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.domain.ProductSort;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Criteria;

/**
 * The guards of {@link Criteria}: the API checks its parameters first (NFR3), so a value out of
 * range here is a programming error, never a list of every product. A missing status is one too: it
 * never means "every status", so a store list cannot show a hidden product by mistake (NFR9).
 */
class ProductQueryRepositoryCriteriaTest {

  private static final Set<ProductStatus> STORE = Set.of(ProductStatus.ACTIVE);

  @Test
  void criteria_withoutStatuses_isRefused() {
    assertThatThrownBy(() -> new Criteria(null, null, ProductSort.NEWEST, 0, 20))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("statuses");
  }

  @Test
  void criteria_withNoStatus_isRefused() {
    assertThatThrownBy(() -> new Criteria(null, Set.of(), ProductSort.NEWEST, 0, 20))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("status");
  }

  @Test
  void criteria_withANullStatus_isRefused() {
    Set<ProductStatus> withNull = new HashSet<>();
    withNull.add(ProductStatus.ACTIVE);
    withNull.add(null);

    assertThatThrownBy(() -> new Criteria(null, withNull, ProductSort.NEWEST, 0, 20))
        .isInstanceOf(NullPointerException.class);
  }

  @Test
  void criteria_keepsTheStatusesItWasGivenEvenWhenTheCallerChangesItsSet() {
    Set<ProductStatus> statuses = EnumSet.of(ProductStatus.ACTIVE);

    Criteria criteria = new Criteria(null, statuses, ProductSort.NEWEST, 0, 20);
    statuses.add(ProductStatus.HIDDEN);

    assertThat(criteria.statuses()).containsExactly(ProductStatus.ACTIVE);
  }

  @Test
  void criteria_ofTheStore_doesNotCoverEveryStatus() {
    assertThat(new Criteria(null, STORE, ProductSort.NEWEST, 0, 20).coversEveryStatus()).isFalse();
  }

  @Test
  void criteria_givenEveryStatus_coversEveryStatus() {
    Criteria criteria =
        new Criteria(null, EnumSet.allOf(ProductStatus.class), ProductSort.NEWEST, 0, 20);

    assertThat(criteria.coversEveryStatus()).isTrue();
  }

  @ParameterizedTest
  @ValueSource(ints = {1, 24, 100})
  void criteria_takesALimitFrom1To100(int limit) {
    assertThat(new Criteria(null, STORE, ProductSort.NEWEST, 0, limit).limit()).isEqualTo(limit);
  }

  @ParameterizedTest
  @ValueSource(ints = {-1, 0, 101, 1000})
  void criteria_withALimitOutOf1To100_isRefused(int limit) {
    assertThatThrownBy(() -> new Criteria(null, STORE, ProductSort.NEWEST, 0, limit))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("limit");
  }

  @Test
  void criteria_withANegativeOffset_isRefused() {
    assertThatThrownBy(() -> new Criteria(null, STORE, ProductSort.NEWEST, -1, 20))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("offset");
  }

  @Test
  void criteria_withoutSort_isRefused() {
    assertThatThrownBy(() -> new Criteria(null, STORE, null, 0, 20))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("sort");
  }

  @Test
  void criteria_byRelevanceWithoutAKeyword_isRefused() {
    assertThatThrownBy(() -> new Criteria(null, STORE, ProductSort.RELEVANCE, 0, 20))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("RELEVANCE");
  }

  @Test
  void criteria_byRelevanceWithAKeyword_isTaken() {
    ProductSearchTerms search = ProductSearchTerms.of("ao thun").orElseThrow();

    assertThat(new Criteria(search, STORE, ProductSort.RELEVANCE, 0, 20).search()).isSameAs(search);
  }
}
