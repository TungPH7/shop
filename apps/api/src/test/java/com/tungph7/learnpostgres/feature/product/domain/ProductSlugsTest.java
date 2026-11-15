package com.tungph7.learnpostgres.feature.product.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

/** The slug rules of the SPEC of SHOP-7 (Product Rules, "Sinh slug") and of its plan. */
class ProductSlugsTest {

  // ============================================================
  // fromName: the examples of Product Rules
  // ============================================================

  @ParameterizedTest(name = "{0} -> {1}")
  @CsvSource(
      delimiter = '|',
      value = {
        "Áo thun cổ tròn        | ao-thun-co-tron",
        "Đầm maxi đỏ 2026       | dam-maxi-do-2026",
        "Quần jean (Nam) – Slim | quan-jean-nam-slim"
      })
  void fromName_withTheExamplesOfProductRules_givesTheirSlug(String name, String slug) {
    assertThat(ProductSlugs.fromName(name)).isEqualTo(slug);
  }

  @Test
  void fromName_foldsUpperCaseAndBothFormsOfD() {
    assertThat(ProductSlugs.fromName("ĐÔI GIÀY đen")).isEqualTo("doi-giay-den");
  }

  @Test
  void fromName_turnsEachRunOfOtherCharactersIntoOneHyphenAndTrimsHyphens() {
    assertThat(ProductSlugs.fromName("  --Combo   3 áo!!! (Hè)--  ")).isEqualTo("combo-3-ao-he");
  }

  @ParameterizedTest
  @ValueSource(strings = {"!!!", "   ", "—", "Ω", "%_\\'"})
  void fromName_withoutAnyLetterOrDigitLeft_givesSanPham(String name) {
    assertThat(ProductSlugs.fromName(name)).isEqualTo("san-pham");
  }

  @Test
  void fromName_cutsAt100Characters() {
    String name = "a".repeat(150);

    assertThat(ProductSlugs.fromName(name)).isEqualTo("a".repeat(100));
  }

  @Test
  void fromName_cutInsideAHyphen_dropsTheHyphenAtTheEnd() {
    // 99 letters, then the hyphen at index 99 is the 100th character of the slug.
    String name = "a".repeat(99) + " bc";

    String slug = ProductSlugs.fromName(name);

    assertThat(slug).isEqualTo("a".repeat(99));
    assertThat(ProductSlugs.isValid(slug)).isTrue();
  }

  @Test
  void fromName_givesAValidSlugForAnyNameOfTheRules() {
    String name = "Áo thun cổ tròn – bản giới hạn 2026 (màu đỏ đô) ".repeat(4);

    assertThat(ProductSlugs.isValid(ProductSlugs.fromName(name))).isTrue();
  }

  @Test
  void fromName_withNull_isAProgrammingError() {
    assertThatThrownBy(() -> ProductSlugs.fromName(null)).isInstanceOf(NullPointerException.class);
  }

  // ============================================================
  // isValid: ^[a-z0-9]+(?:-[a-z0-9]+)*$, at most 100 characters
  // ============================================================

  @ParameterizedTest
  @ValueSource(strings = {"a", "ao-thun-co-tron", "dam-maxi-do-2026", "combo-3-ao", "2026"})
  void isValid_withTheFormatOfTheRules_isTrue(String slug) {
    assertThat(ProductSlugs.isValid(slug)).isTrue();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "-a--b-",
        "-ao",
        "ao-",
        "ao--thun",
        "Ao-thun",
        "áo-thun",
        "ao thun",
        "ao_thun",
        "ao%",
        "ao-thun\n"
      })
  void isValid_withAnyOtherFormat_isFalse(String slug) {
    assertThat(ProductSlugs.isValid(slug)).isFalse();
  }

  @ParameterizedTest
  @NullAndEmptySource
  void isValid_withNoSlug_isFalse(String slug) {
    assertThat(ProductSlugs.isValid(slug)).isFalse();
  }

  @Test
  void isValid_allowsAtMost100Characters() {
    assertThat(ProductSlugs.isValid("a".repeat(100))).isTrue();
    assertThat(ProductSlugs.isValid("a".repeat(101))).isFalse();
  }

  // ============================================================
  // withSuffix: -2, -3... when the generated slug is taken
  // ============================================================

  @Test
  void withSuffix_appendsTheNumberAfterAHyphen() {
    assertThat(ProductSlugs.withSuffix("ao-thun-co-tron", 2)).isEqualTo("ao-thun-co-tron-2");
    assertThat(ProductSlugs.withSuffix("ao-thun-co-tron", 13)).isEqualTo("ao-thun-co-tron-13");
  }

  @Test
  void withSuffix_cutsTheBaseSoTheWholeSlugKeeps100Characters() {
    String slug = ProductSlugs.withSuffix("a".repeat(100), 2);

    assertThat(slug).isEqualTo("a".repeat(98) + "-2").hasSize(100);
  }

  @Test
  void withSuffix_cutInsideAHyphen_dropsTheHyphenBeforeTheSuffix() {
    // Cut to 97 characters for "-10", the base would end with the hyphen at index 96.
    String base = "a".repeat(96) + "-bcdef";

    String slug = ProductSlugs.withSuffix(base, 10);

    assertThat(slug).isEqualTo("a".repeat(96) + "-10");
    assertThat(ProductSlugs.isValid(slug)).isTrue();
  }

  @ParameterizedTest
  @ValueSource(ints = {-1, 0, 1})
  void withSuffix_belowTwo_isAProgrammingError(int number) {
    assertThatThrownBy(() -> ProductSlugs.withSuffix("ao-thun", number))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
