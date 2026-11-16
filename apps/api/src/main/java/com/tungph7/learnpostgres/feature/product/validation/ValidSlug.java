package com.tungph7.learnpostgres.feature.product.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

import com.tungph7.learnpostgres.feature.product.domain.ProductSlugs;

/**
 * A slug an admin typed has the slug format of the Product Rules, checked by {@link
 * ProductSlugs#isValid}, the one place that rule is written. {@code null} is valid: the field is
 * optional where it is optional, and {@code @NotNull} says when it is not.
 *
 * <p>The length is checked before the format, so a slug of thousands of characters is one 400 on
 * the field and never reaches the regular expression. The message says which of the two failed.
 */
@Documented
@Constraint(validatedBy = ValidSlug.SlugValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidSlug {

  /** The message of a slug longer than {@value ProductSlugs#MAX_LENGTH} characters. */
  String TOO_LONG = "must be at most " + ProductSlugs.MAX_LENGTH + " characters";

  /** The message of a slug that is short enough but not of the format. */
  String WRONG_FORMAT =
      "must be lowercase letters a-z and digits, in words joined by single hyphens";

  String message() default WRONG_FORMAT;

  Class<?>[] groups() default {};

  Class<? extends Payload>[] payload() default {};

  /** Checks a slug with {@link ProductSlugs#isValid}. */
  class SlugValidator implements ConstraintValidator<ValidSlug, String> {

    @Override
    public boolean isValid(String slug, ConstraintValidatorContext context) {
      if (slug == null || ProductSlugs.isValid(slug)) {
        return true;
      }
      if (slug.length() > ProductSlugs.MAX_LENGTH) {
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(TOO_LONG).addConstraintViolation();
      }
      return false;
    }
  }
}
