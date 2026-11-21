package com.tungph7.learnpostgres.common.text;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * The slug rules shared by products and categories (Tech Stack of the SPEC of SHOP-81): the slug
 * rules of the Product Rules of SHOP-7, which the Category Rules of SHOP-81 take as they are.
 *
 * <p>The format is {@code ^[a-z0-9]+(?:-[a-z0-9]+)*$}, at most {@value #MAX_LENGTH} characters. A
 * slug is generated from a name, and {@code -2}, {@code -3}… are added when it is taken. Each kind
 * of slug keeps only its own fallback, for a name with no letter or digit left once folded: {@code
 * ProductSlugs} for products, the category service for categories.
 */
public final class Slugs {

  /** The longest slug, in UTF-16 units. */
  public static final int MAX_LENGTH = 100;

  private static final Pattern FORMAT = Pattern.compile("[a-z0-9]+(?:-[a-z0-9]+)*");
  private static final Pattern COMBINING_MARKS = Pattern.compile("[\\u0300-\\u036f]");
  private static final Pattern NOT_LETTER_OR_DIGIT = Pattern.compile("[^a-z0-9]+");
  private static final Pattern EDGE_HYPHENS = Pattern.compile("^-+|-+$");
  private static final Pattern TRAILING_HYPHENS = Pattern.compile("-+$");

  private Slugs() {}

  /**
   * The slug generated from a name: no Vietnamese accents ({@code đ} and {@code Đ} become {@code
   * d}), lower case, each run of characters other than a–z and 0–9 one hyphen, no hyphen at either
   * end, then cut at {@value #MAX_LENGTH} characters. A cut that ends on a hyphen drops it, so the
   * slug always has the format; an empty slug becomes {@code fallback}.
   *
   * @param fallback the slug of a name that has no letter or digit left once folded
   */
  public static String fromName(String name, String fallback) {
    Objects.requireNonNull(name, "name");
    String withoutMarks =
        COMBINING_MARKS.matcher(Normalizer.normalize(name, Normalizer.Form.NFD)).replaceAll("");
    String lower = withoutMarks.replace('đ', 'd').replace('Đ', 'd').toLowerCase(Locale.ROOT);
    String hyphenated = NOT_LETTER_OR_DIGIT.matcher(lower).replaceAll("-");
    String slug = cut(EDGE_HYPHENS.matcher(hyphenated).replaceAll(""), MAX_LENGTH);
    return slug.isEmpty() ? fallback : slug;
  }

  /** Whether a slug has the format: {@code null} has not. */
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

  /**
   * The slugs an add without slug may take, in the order it tries them: {@code base}, then {@code
   * base-2} to {@code base-highestNumber}, each built by {@link #withSuffix}.
   */
  public static List<String> candidates(String base, int highestNumber) {
    List<String> candidates = new ArrayList<>(highestNumber);
    candidates.add(base);
    for (int number = 2; number <= highestNumber; number++) {
      candidates.add(withSuffix(base, number));
    }
    return candidates;
  }

  private static String cut(String slug, int length) {
    if (slug.length() <= length) {
      return slug;
    }
    return TRAILING_HYPHENS.matcher(slug.substring(0, length)).replaceAll("");
  }
}
