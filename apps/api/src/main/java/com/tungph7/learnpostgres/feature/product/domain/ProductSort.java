package com.tungph7.learnpostgres.feature.product.domain;

/**
 * The orders of a product list (API Contract of SHOP-7, section "Thứ tự"). Each one ends with
 * {@code id DESC}, so a page never repeats or skips a product (NFR18).
 */
public enum ProductSort {
  /** The newest first: {@code created_at DESC}. */
  NEWEST,
  /** The lowest price first, then the newest. */
  PRICE_ASC,
  /** The highest price first, then the newest. */
  PRICE_DESC,
  /**
   * Only with a keyword: the name starts with the phrase, then a word of the name starts with it,
   * then the rest; the newest first in each group.
   */
  RELEVANCE
}
