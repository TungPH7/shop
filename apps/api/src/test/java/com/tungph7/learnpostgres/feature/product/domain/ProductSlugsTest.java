package com.tungph7.learnpostgres.feature.product.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import com.tungph7.learnpostgres.common.text.Slugs;

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
    assertThat(Slugs.isValid(slug)).isTrue();
  }

  @Test
  void fromName_givesAValidSlugForAnyNameOfTheRules() {
    String name = "Áo thun cổ tròn – bản giới hạn 2026 (màu đỏ đô) ".repeat(4);

    assertThat(Slugs.isValid(ProductSlugs.fromName(name))).isTrue();
  }

  @Test
  void fromName_withNull_isAProgrammingError() {
    assertThatThrownBy(() -> ProductSlugs.fromName(null)).isInstanceOf(NullPointerException.class);
  }
}
