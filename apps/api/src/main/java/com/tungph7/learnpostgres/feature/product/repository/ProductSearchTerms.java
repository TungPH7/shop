package com.tungph7.learnpostgres.feature.product.repository;

import java.text.Normalizer;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * The keyword {@code q} of a product list, as the API Contract of SHOP-7 reads it (section "Từ khóa
 * q") and ADR-0002 matches it:
 *
 * <ol>
 *   <li>no space at either end, each run of spaces one space, cut at {@value #MAX_KEYWORD_LENGTH}
 *       UTF-16 units;
 *   <li>folded as {@code app.search_fold} folds a name in the database ({@link #fold});
 *   <li>each run of a–z and 0–9 is a word; a repeated word is dropped.
 * </ol>
 *
 * <p>A keyword blank once trimmed is no search ({@link #of} is empty). A keyword with no word, such
 * as {@code %} or {@code !!!}, matches no product ({@link #matchesNothing}), so {@code %} or {@code
 * _} never lists every product (NFR10).
 *
 * <p>A product matches when each word matches the start of a word of its name: {@code name_search
 * LIKE '% ' || word || '%' ESCAPE '\'}. The patterns escape {@code %}, {@code _} and {@code \} of
 * the words. A folded word holds only a–z and 0–9, so the escape changes nothing today; it keeps
 * the patterns safe if the fold ever lets another character through. The patterns only go to bind
 * parameters, never into the SQL text.
 */
public final class ProductSearchTerms {

  /** The longest keyword, in UTF-16 units: the rest is cut. */
  public static final int MAX_KEYWORD_LENGTH = 100;

  private static final Pattern SPACES = Pattern.compile("\\s+", Pattern.UNICODE_CHARACTER_CLASS);
  private static final Pattern COMBINING_MARKS = Pattern.compile("[\\u0300-\\u036f]");
  private static final Pattern NOT_LETTER_OR_DIGIT = Pattern.compile("[^a-z0-9]+");
  private static final Pattern LIKE_SPECIAL = Pattern.compile("[\\\\%_]");

  private final List<String> words;

  private ProductSearchTerms(List<String> words) {
    this.words = words;
  }

  /** The terms of a keyword, or empty when the keyword is missing or blank: no search. */
  public static Optional<ProductSearchTerms> of(String q) {
    if (q == null) {
      return Optional.empty();
    }
    String keyword = SPACES.matcher(q).replaceAll(" ").strip();
    if (keyword.isEmpty()) {
      return Optional.empty();
    }
    if (keyword.length() > MAX_KEYWORD_LENGTH) {
      keyword = keyword.substring(0, MAX_KEYWORD_LENGTH);
    }
    String folded = fold(keyword);
    List<String> words =
        folded.isEmpty() ? List.of() : List.copyOf(new LinkedHashSet<>(List.of(folded.split(" "))));
    return Optional.of(new ProductSearchTerms(words));
  }

  /**
   * Folds a text exactly as {@code app.search_fold} of migration V4 does, step for step: NFD, no
   * combining mark U+0300–U+036F, {@code đ} and {@code Đ} to {@code d}, lower case, each run of
   * characters other than a–z and 0–9 one space, no space at either end.
   */
  public static String fold(String text) {
    String withoutMarks =
        COMBINING_MARKS.matcher(Normalizer.normalize(text, Normalizer.Form.NFD)).replaceAll("");
    String lower = withoutMarks.replace('đ', 'd').replace('Đ', 'd').toLowerCase(Locale.ROOT);
    return NOT_LETTER_OR_DIGIT.matcher(lower).replaceAll(" ").strip();
  }

  /** The folded words, each once, in the order of the keyword. */
  public List<String> words() {
    return words;
  }

  /** A keyword with no word, such as {@code %}: no product matches it. */
  public boolean matchesNothing() {
    return words.isEmpty();
  }

  /** The words joined by one space: the phrase of the "Liên quan nhất" groups. */
  public String phrase() {
    return String.join(" ", words);
  }

  /** One pattern per word, for {@code name_search LIKE ? ESCAPE '\'}: the start of a word. */
  public List<String> wordPatterns() {
    return words.stream().map(word -> "% " + escapeLike(word) + "%").toList();
  }

  /** Group 1 of "Liên quan nhất": the name starts with the phrase. */
  public String phraseAtStartPattern() {
    return " " + escapeLike(phrase()) + "%";
  }

  /** Group 2 of "Liên quan nhất": a word of the name starts with the phrase. */
  public String phraseAtWordStartPattern() {
    return "% " + escapeLike(phrase()) + "%";
  }

  /** Escapes {@code \}, {@code %} and {@code _} for {@code LIKE ... ESCAPE '\'}. */
  static String escapeLike(String text) {
    return LIKE_SPECIAL.matcher(text).replaceAll("\\\\$0");
  }
}
