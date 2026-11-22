package com.tungph7.learnpostgres.common.text;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

/**
 * A slug has the format of {@link Slugs}: lower-case letters a–z and digits, in words joined by
 * single hyphens, at most {@value Slugs#MAX_LENGTH} characters. {@code null} is valid: add
 * {@code @NotBlank} where the slug is required.
 *
 * <p>The length is checked before the format, so a slug of thousands of characters is one 400 on
 * the field and never reaches the regular expression. The message says which of the two failed. The
 * categories use it (SHOP-81); the products keep their own {@code ValidSlug}, which only their add
 * uses.
 */
@Documented
@Constraint(validatedBy = SlugFormat.SlugFormatValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface SlugFormat {

  /** The message of a slug longer than {@value Slugs#MAX_LENGTH} characters. */
  String TOO_LONG = "must be at most " + Slugs.MAX_LENGTH + " characters";

  /** The message of a slug that is short enough but not of the format. */
  String WRONG_FORMAT =
      "must be lowercase letters a-z and digits, in words joined by single hyphens";

  String message() default WRONG_FORMAT;

  Class<?>[] groups() default {};

  Class<? extends Payload>[] payload() default {};

  /** Checks a slug with {@link Slugs#isValid}. */
  class SlugFormatValidator implements ConstraintValidator<SlugFormat, String> {

    @Override
    public boolean isValid(String slug, ConstraintValidatorContext context) {
      if (slug == null || Slugs.isValid(slug)) {
        return true;
      }
      if (slug.length() > Slugs.MAX_LENGTH) {
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(TOO_LONG).addConstraintViolation();
      }
      return false;
    }
  }
}
