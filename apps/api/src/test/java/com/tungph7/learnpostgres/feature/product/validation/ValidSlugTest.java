package com.tungph7.learnpostgres.feature.product.validation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * {@link ValidSlug}: the slug rule of {@code ProductSlugs.isValid}, as a constraint on the slug of
 * the add only (SHOP-46). The edit keeps a stored slug out of the format (NFR16), so its request
 * body has no such constraint; the service of the edit (US3, SHOP-34) checks a changed slug.
 */
class ValidSlugTest {

  record Body(@ValidSlug String slug) {}

  private static ValidatorFactory factory;
  private static Validator validator;

  @BeforeAll
  static void createValidator() {
    factory = Validation.buildDefaultValidatorFactory();
    validator = factory.getValidator();
  }

  @AfterAll
  static void closeValidator() {
    factory.close();
  }

  @ParameterizedTest
  @ValueSource(strings = {"a", "ao-thun-co-tron", "combo-3-ao", "2026"})
  void aSlugOfTheFormat_isValid(String slug) {
    assertThat(validator.validate(new Body(slug))).isEmpty();
  }

  @Test
  void aSlugOf100Characters_isValid() {
    assertThat(validator.validate(new Body("a".repeat(100)))).isEmpty();
  }

  @Test
  void noSlug_isValid() {
    assertThat(validator.validate(new Body(null))).isEmpty();
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "Ao-thun", "áo-thun", "ao thun", "ao--thun", "-ao", "ao-"})
  void aSlugOfAnotherFormat_saysWhatTheFormatIs(String slug) {
    assertThat(messages(validator.validate(new Body(slug))))
        .containsExactly(
            "must be lowercase letters a-z and digits, in words joined by single hyphens");
  }

  @Test
  void aSlugOf101Characters_saysItIsTooLong() {
    assertThat(messages(validator.validate(new Body("a".repeat(101)))))
        .containsExactly("must be at most 100 characters");
  }

  @Test
  void aSlugOf20000CharactersOfWords_saysItIsTooLongWithoutRunningTheFormat() {
    String slug = "a-".repeat(9_999) + "aa";

    assertThat(messages(validator.validate(new Body(slug))))
        .containsExactly("must be at most 100 characters");
  }

  private static Iterable<String> messages(Set<ConstraintViolation<Body>> violations) {
    return violations.stream().map(ConstraintViolation::getMessage).toList();
  }
}
