package com.tungph7.learnpostgres.common.text;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * {@link FormText} trims as {@code String.prototype.trim()} of the forms (SHOP-46): the white space
 * and line terminators of ECMAScript, and nothing else.
 */
class FormTextTest {

  @ParameterizedTest(name = "U+{0}")
  @ValueSource(
      strings = {
        "0009", "000A", "000B", "000C", "000D", "0020", "00A0", "1680", "2000", "2005", "200A",
        "2007", "2028", "2029", "202F", "205F", "3000", "FEFF"
      })
  void trim_removesTheWhiteSpaceOfJavaScriptAtBothEnds(String codePoint) {
    String space = Character.toString(Integer.parseInt(codePoint, 16));

    assertThat(FormText.trim(space + space + "Áo  thun" + space)).isEqualTo("Áo  thun");
    assertThat(FormText.isBlank(space + space)).isTrue();
  }

  @ParameterizedTest(name = "U+{0}")
  @ValueSource(strings = {"200B", "0085", "180E", "001C", "0000"})
  void trim_keepsCharactersJavaScriptDoesNotTrim(String codePoint) {
    String character = Character.toString(Integer.parseInt(codePoint, 16));

    assertThat(FormText.trim(character + "a" + character)).isEqualTo(character + "a" + character);
    assertThat(FormText.isBlank(character)).isFalse();
  }

  @Test
  void trim_keepsTheSpacesInside() {
    assertThat(FormText.trim("a\u00A0 b")).isEqualTo("a\u00A0 b");
  }

  @Test
  void trim_ofNull_isNull() {
    assertThat(FormText.trim(null)).isNull();
  }

  @Test
  void isBlank_ofNullOrEmpty_isTrue() {
    assertThat(FormText.isBlank(null)).isTrue();
    assertThat(FormText.isBlank("")).isTrue();
  }

  @Test
  void isBlank_ofText_isFalse() {
    assertThat(FormText.isBlank(" \u00A0x ")).isFalse();
  }
}
