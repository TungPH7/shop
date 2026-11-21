package com.tungph7.learnpostgres.feature.product.domain;

import com.tungph7.learnpostgres.common.text.Slugs;

/**
 * The slug of a product, as the Product Rules of the SPEC of SHOP-7 define it: generated from the
 * name when a product is added, then kept when the name changes. The rules are those of {@link
 * Slugs}, shared with categories (SHOP-81); this class keeps the fallback of products.
 *
 * <p>The format is {@code ^[a-z0-9]+(?:-[a-z0-9]+)*$}, at most {@value #MAX_LENGTH} characters. A
 * slug written before the Epic may break it (NFR16): {@code api} checks the format only of a slug
 * an admin types or changes.
 *
 * <p>The folding looks like {@code ProductSearchTerms.fold} but is not shared with it on purpose:
 * the slug follows the Product Rules, the search follows {@code app.search_fold} of the database
 * (ADR-0002), and a change of one must not change the other.
 */
public final class ProductSlugs {

  /** The longest slug, in UTF-16 units. */
  public static final int MAX_LENGTH = Slugs.MAX_LENGTH;

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

  /** Whether a slug an admin typed has the format of the Product Rules. */
  public static boolean isValid(String slug) {
    return Slugs.isValid(slug);
  }

  /**
   * The generated slug {@code base} with the suffix {@code -number}, for a slug already taken: the
   * base is cut so the whole slug keeps {@value #MAX_LENGTH} characters.
   *
   * @param number 2 for the first slug taken, then 3, 4…
   */
  public static String withSuffix(String base, int number) {
    return Slugs.withSuffix(base, number);
  }
}
