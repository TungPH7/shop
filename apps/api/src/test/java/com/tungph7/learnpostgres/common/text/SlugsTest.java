package com.tungph7.learnpostgres.common.text;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * The slug rules shared by products and categories (Tech Stack of the SPEC of SHOP-81): the Product
 * Rules of SHOP-7, and the Category Rules of SHOP-81, which take the same rules.
 */
class SlugsTest {

  private static final String CATEGORY_FALLBACK = "danh-muc";

  // ============================================================
  // fromName
  // ============================================================

  @ParameterizedTest(name = "{0} -> {1}")
  @CsvSource(
      delimiter = '|',
      value = {
        "Áo khoác nữ            | ao-khoac-nu",
        "Áo thun                | ao-thun",
        "Ao thun                | ao-thun",
        "Phụ kiện               | phu-kien",
        "Đầm                    | dam",
        "Quần jean (Nam) – Slim | quan-jean-nam-slim"
      })
  void fromName_withTheExamplesOfTheCategoryRules_givesTheirSlug(String name, String slug) {
    assertThat(Slugs.fromName(name, CATEGORY_FALLBACK)).isEqualTo(slug);
  }

  @Test
  void fromName_foldsUpperCaseAndBothFormsOfD() {
    assertThat(Slugs.fromName("ĐỒ ĐI BIỂN đẹp", CATEGORY_FALLBACK)).isEqualTo("do-di-bien-dep");
  }

  @ParameterizedTest
  @ValueSource(strings = {"!!!", "   ", "—", "Ω", "</>"})
  void fromName_withoutAnyLetterOrDigitLeft_givesTheFallback(String name) {
    assertThat(Slugs.fromName(name, CATEGORY_FALLBACK)).isEqualTo("danh-muc");
  }

  @Test
  void fromName_cutsAt100CharactersAndNeverEndsOnAHyphen() {
    String slug = Slugs.fromName("a".repeat(99) + " bc", CATEGORY_FALLBACK);

    assertThat(slug).isEqualTo("a".repeat(99));
    assertThat(Slugs.isValid(slug)).isTrue();
  }

  @Test
  void fromName_withNull_isAProgrammingError() {
    assertThatThrownBy(() -> Slugs.fromName(null, CATEGORY_FALLBACK))
        .isInstanceOf(NullPointerException.class);
  }

  // ============================================================
  // isValid
  // ============================================================

  @ParameterizedTest
  @ValueSource(strings = {"ao", "ao-thun", "ao-thun-2", "2026", "a-0-9"})
  void isValid_acceptsTheFormat(String slug) {
    assertThat(Slugs.isValid(slug)).isTrue();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "",
        "AO",
        "Ao-thun",
        "áo",
        "ao thun",
        "-ao",
        "ao-",
        "ao--thun",
        "-a--b-",
        "ao_thun",
        "ao%",
        "ao-thun\n"
      })
  void isValid_refusesAnythingElse(String slug) {
    assertThat(Slugs.isValid(slug)).isFalse();
  }

  @Test
  void isValid_takes100CharactersAndRefuses101() {
    assertThat(Slugs.isValid("a".repeat(100))).isTrue();
    assertThat(Slugs.isValid("a".repeat(101))).isFalse();
  }

  @Test
  void isValid_refusesNull() {
    assertThat(Slugs.isValid(null)).isFalse();
  }

  // ============================================================
  // withSuffix and candidates
  // ============================================================

  @Test
  void withSuffix_addsTheNumber() {
    assertThat(Slugs.withSuffix("ao-thun", 2)).isEqualTo("ao-thun-2");
  }

  @Test
  void withSuffix_cutsTheBaseSoTheSlugKeeps100Characters() {
    String slug = Slugs.withSuffix("a".repeat(100), 1000);

    assertThat(slug).hasSize(100).endsWith("-1000");
    assertThat(Slugs.isValid(slug)).isTrue();
  }

  @Test
  void withSuffix_cutInsideAHyphen_dropsTheHyphenBeforeTheSuffix() {
    // Cut to 97 characters for "-10", the base would end with the hyphen at index 96.
    String base = "a".repeat(96) + "-bcdef";

    String slug = Slugs.withSuffix(base, 10);

    assertThat(slug).isEqualTo("a".repeat(96) + "-10");
    assertThat(Slugs.isValid(slug)).isTrue();
  }

  @Test
  void withSuffix_below2_isAProgrammingError() {
    assertThatThrownBy(() -> Slugs.withSuffix("ao", 1))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void candidates_areTheBaseThenEachNumberFrom2() {
    List<String> candidates = Slugs.candidates("ao-thun", 1000);

    assertThat(candidates).hasSize(1000);
    assertThat(candidates.subList(0, 3)).containsExactly("ao-thun", "ao-thun-2", "ao-thun-3");
    assertThat(candidates.getLast()).isEqualTo("ao-thun-1000");
  }

  @Test
  void candidates_ofABaseCutForItsSuffix_areEachWithSuffixAndKeepTheFormat() {
    String base = "ao-thun-" + "a".repeat(87) + "-bcde";

    List<String> candidates = Slugs.candidates(base, 1000);

    assertThat(candidates.getFirst()).isEqualTo(base);
    for (int number = 2; number <= 1000; number++) {
      assertThat(candidates.get(number - 1))
          .isEqualTo(Slugs.withSuffix(base, number))
          .endsWith("-" + number);
    }
    assertThat(candidates)
        .doesNotHaveDuplicates()
        .allSatisfy(slug -> assertThat(Slugs.isValid(slug)).as(slug).isTrue());
  }
}
