package com.tungph7.learnpostgres.feature.product.domain;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * The slug of a product, as the Product Rules of the SPEC of SHOP-7 define it: generated from the
 * name when a product is added, then kept when the name changes.
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
  public static final int MAX_LENGTH = 100;

  /** The slug of a name that has no letter or digit left once folded. */
  public static final String FALLBACK = "san-pham";

  private static final Pattern FORMAT = Pattern.compile("[a-z0-9]+(?:-[a-z0-9]+)*");
  private static final Pattern COMBINING_MARKS = Pattern.compile("[\\u0300-\\u036f]");
  private static final Pattern NOT_LETTER_OR_DIGIT = Pattern.compile("[^a-z0-9]+");
  private static final Pattern EDGE_HYPHENS = Pattern.compile("^-+|-+$");
  private static final Pattern TRAILING_HYPHENS = Pattern.compile("-+$");

  private ProductSlugs() {}

  /**
   * The slug generated from a name: no Vietnamese accents ({@code đ} and {@code Đ} become {@code
   * d}), lower case, each run of characters other than a–z and 0–9 one hyphen, no hyphen at either
   * end, then cut at {@value #MAX_LENGTH} characters. A cut that ends on a hyphen drops it, so the
   * slug always has the format; an empty slug becomes {@value #FALLBACK}.
   */
  public static String fromName(String name) {
    Objects.requireNonNull(name, "name");
    String withoutMarks =
        COMBINING_MARKS.matcher(Normalizer.normalize(name, Normalizer.Form.NFD)).replaceAll("");
    String lower = withoutMarks.replace('đ', 'd').replace('Đ', 'd').toLowerCase(Locale.ROOT);
    String hyphenated = NOT_LETTER_OR_DIGIT.matcher(lower).replaceAll("-");
    String slug = cut(EDGE_HYPHENS.matcher(hyphenated).replaceAll(""), MAX_LENGTH);
    return slug.isEmpty() ? FALLBACK : slug;
  }

  /** Whether a slug an admin typed has the format of the Product Rules. */
  public static boolean isValid(String slug) {
    return slug != null && slug.length() <= MAX_LENGTH && FORMAT.matcher(slug).matches();
  }

  /**
   * The generated slug {@code base} with the suffix {@code -number}, for a slug already taken: the
   * base is cut so the whole slug keeps {@value #MAX_LENGTH} characters.
   *
   * @param number 2 for the first slug taken, then 3, 4…
   */
  public static String withSuffix(String base, int number) {
    if (number < 2) {
      throw new IllegalArgumentException("A slug suffix starts at 2, not " + number);
    }
    String suffix = "-" + number;
    return cut(base, MAX_LENGTH - suffix.length()) + suffix;
  }

  private static String cut(String slug, int length) {
    if (slug.length() <= length) {
      return slug;
    }
    return TRAILING_HYPHENS.matcher(slug.substring(0, length)).replaceAll("");
  }
}
