package com.tungph7.learnpostgres.feature.product.domain;

import com.tungph7.learnpostgres.common.text.Slugs;

/**
 * The slug of a product, as the Product Rules of the SPEC of SHOP-7 define it: generated from the
 * name when a product is added, then kept when the name changes. The rules are those of {@link
 * Slugs}, shared with categories (SHOP-81): the format, the suffixes and the check of a slug typed
 * live there only, and this class keeps the fallback of products.
 *
 * <p>The format is {@code ^[a-z0-9]+(?:-[a-z0-9]+)*$}, at most {@value Slugs#MAX_LENGTH}
 * characters. A slug written before the Epic may break it (NFR16): {@code api} checks the format
 * only of a slug an admin types or changes.
 *
 * <p>The folding looks like {@code ProductSearchTerms.fold} but is not shared with it on purpose:
 * the slug follows the Product Rules, the search follows {@code app.search_fold} of the database
 * (ADR-0002), and a change of one must not change the other.
 */
public final class ProductSlugs {

  /** The slug of a name that has no letter or digit left once folded. */
  public static final String FALLBACK = "san-pham";

  private ProductSlugs() {}

  /**
   * The slug generated from a name by {@link Slugs#fromName}; an empty slug becomes {@value
   * #FALLBACK}.
   */
  public static String fromName(String name) {
    return Slugs.fromName(name, FALLBACK);
  }
}
