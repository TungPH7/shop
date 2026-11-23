package com.tungph7.learnpostgres.feature.category.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Stream;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import com.tungph7.learnpostgres.feature.category.domain.Category.CategoryStatus;

/**
 * The rule of {@code displayOrder} in the add and the edit of a category (SHOP-95: Category Rules,
 * NFR7, API Contract): a whole number from 0 to 9999, or absent; each wrong value with the message
 * of the API Contract, on the field {@code displayOrder}.
 */
class CategoryRequestDisplayOrderValidationTest {

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

  /** The add and the edit, each a valid body but for its display order. */
  static Stream<Arguments> requests() {
    Function<BigDecimal, Object> create =
        order -> new CreateCategoryRequest("Áo", "ao", CategoryStatus.VISIBLE, order);
    Function<BigDecimal, Object> update =
        order -> new UpdateCategoryRequest("Áo", "ao", CategoryStatus.VISIBLE, order, 3L);
    return Stream.of(Arguments.of("create", create), Arguments.of("update", update));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("requests")
  void zeroAnd9999AndAWholeNumber_areValid(String request, Function<BigDecimal, Object> body) {
    for (String order : List.of("0", "9999", "7")) {
      assertThat(validator.validate(body.apply(new BigDecimal(order)))).as(order).isEmpty();
    }
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("requests")
  void anAbsentOrNullDisplayOrder_isValid(String request, Function<BigDecimal, Object> body) {
    assertThat(validator.validate(body.apply(null))).isEmpty();
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("requests")
  void minusOne_mustBeAtLeastZero(String request, Function<BigDecimal, Object> body) {
    assertThat(messagesOn(body.apply(new BigDecimal("-1")))).containsExactly("must be at least 0");
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("requests")
  void tenThousand_mustBeAtMost9999(String request, Function<BigDecimal, Object> body) {
    assertThat(messagesOn(body.apply(new BigDecimal("10000"))))
        .containsExactly("must be at most 9999");
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("requests")
  void aNumberBeyondTheRangeOfAnInteger_mustBeAtMost9999(
      String request, Function<BigDecimal, Object> body) {
    assertThat(messagesOn(body.apply(new BigDecimal("99999999999"))))
        .containsExactly("must be at most 9999");
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("requests")
  void onePointFive_mustBeAWholeNumber_andIsNotRounded(
      String request, Function<BigDecimal, Object> body) {
    assertThat(messagesOn(body.apply(new BigDecimal("1.5"))))
        .containsExactly("must be a whole number");
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("requests")
  void minusOnePointFive_givesTwoErrorsOnTheField(
      String request, Function<BigDecimal, Object> body) {
    assertThat(messagesOn(body.apply(new BigDecimal("-1.5"))))
        .containsExactlyInAnyOrder("must be at least 0", "must be a whole number");
  }

  private static List<String> messagesOn(Object body) {
    Set<ConstraintViolation<Object>> violations = validator.validate(body);
    assertThat(violations)
        .extracting(violation -> violation.getPropertyPath().toString())
        .containsOnly("displayOrder");
    return violations.stream().map(ConstraintViolation::getMessage).toList();
  }
}
