package com.tungph7.learnpostgres.feature.product.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * The keyword {@code q} of the API Contract of SHOP-7 (section "Từ khóa q"). The same folding as
 * {@code app.search_fold} is checked against the database by {@code
 * ProductSearchFoldIntegrationTest}.
 */
class ProductSearchTermsTest {

  // ============================================================
  // fold: as app.search_fold
  // ============================================================

  @ParameterizedTest(name = "[{0}] -> [{1}]")
  @CsvSource(
      delimiter = '|',
      quoteCharacter = '"',
      ignoreLeadingAndTrailingWhitespace = false,
      value = {
        "Áo thun cổ tròn|ao thun co tron",
        "ĐẦM Maxi đỏ 2026|dam maxi do 2026",
        "Quần jean (Nam) – Slim|quan jean nam slim",
        "  Bao   tay len  |bao tay len",
        "100% cotton_x\\y'z|100 cotton x y z",
        "!!!|\"\""
      })
  void fold_dropsAccentsAndCaseAndTurnsOtherCharactersIntoOneSpace(String text, String folded) {
    assertThat(ProductSearchTerms.fold(text)).isEqualTo(folded);
  }

  // ============================================================
  // of: no search
  // ============================================================

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {" ", "  \t ", "\u00a0\u3000"})
  void of_withAKeywordBlankAfterTrimming_isNoSearch(String q) {
    assertThat(ProductSearchTerms.of(q)).isEmpty();
  }

  // ============================================================
  // of: words
  // ============================================================

  @ParameterizedTest
  @ValueSource(strings = {"ao thun", "ÁO THUN", "Áo Thun", "  áo \t  thun  "})
  void of_foldsTheKeywordIntoItsWords(String q) {
    ProductSearchTerms terms = ProductSearchTerms.of(q).orElseThrow();

    assertThat(terms.words()).containsExactly("ao", "thun");
    assertThat(terms.matchesNothing()).isFalse();
  }

  @Test
  void of_dropsRepeatedWordsAndKeepsTheOrderOfTheFirstOnes() {
    ProductSearchTerms terms = ProductSearchTerms.of("thun Áo THUN ao co").orElseThrow();

    assertThat(terms.words()).containsExactly("thun", "ao", "co");
  }

  @Test
  void of_splitsOnEveryCharacterOtherThanALetterOrADigit() {
    ProductSearchTerms terms = ProductSearchTerms.of("jean-nam/2026").orElseThrow();

    assertThat(terms.words()).containsExactly("jean", "nam", "2026");
  }

  @ParameterizedTest
  @ValueSource(strings = {"%", "_", "\\", "'", "!!!", "%%__", "–", "\"';--"})
  void of_withAKeywordThatHasNoWord_matchesNothing(String q) {
    ProductSearchTerms terms = ProductSearchTerms.of(q).orElseThrow();

    assertThat(terms.words()).isEmpty();
    assertThat(terms.matchesNothing()).isTrue();
  }

  @Test
  void of_cutsTheKeywordAt100CharactersAfterCollapsingSpaces() {
    // 49 words "a " (98 characters once the spaces are collapsed), then "bc" (100), then "de".
    String q = "   " + "a     ".repeat(49) + "bc de";

    ProductSearchTerms terms = ProductSearchTerms.of(q).orElseThrow();

    assertThat(terms.words()).containsExactly("a", "bc");
  }

  @Test
  void of_cutsBeforeFolding_soADecomposedAccentDoesNotCountTwice() {
    // 100 characters "á": NFD makes them 200, but the cut is on the keyword as typed.
    ProductSearchTerms terms = ProductSearchTerms.of("á".repeat(100) + "b").orElseThrow();

    assertThat(terms.words()).containsExactly("a".repeat(100));
  }

  // ============================================================
  // LIKE patterns: ESCAPE '\'
  // ============================================================

  @Test
  void phrase_joinsTheWordsWithOneSpace() {
    assertThat(ProductSearchTerms.of("  Áo   thun ").orElseThrow().phrase()).isEqualTo("ao thun");
  }

  @Test
  void wordPatterns_matchTheStartOfAWordOfTheName() {
    ProductSearchTerms terms = ProductSearchTerms.of("ao thun").orElseThrow();

    assertThat(terms.wordPatterns()).containsExactly("% ao%", "% thun%");
  }

  @Test
  void phrasePatterns_matchThePhraseAtTheStartOfTheNameOrOfAWord() {
    ProductSearchTerms terms = ProductSearchTerms.of("ao thun").orElseThrow();

    assertThat(terms.phraseAtStartPattern()).isEqualTo(" ao thun%");
    assertThat(terms.phraseAtWordStartPattern()).isEqualTo("% ao thun%");
  }

  @ParameterizedTest(name = "[{0}] -> [{1}]")
  @CsvSource(
      delimiter = '|',
      quoteCharacter = '"',
      value = {"ao|ao", "50%|50\\%", "a_b|a\\_b", "a\\b|a\\\\b", "\\%_|\\\\\\%\\_", "it's|it's"})
  void escapeLike_escapesPercentUnderscoreAndBackslash(String text, String escaped) {
    assertThat(ProductSearchTerms.escapeLike(text)).isEqualTo(escaped);
  }
}
