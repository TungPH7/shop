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
 * A slug an admin typed in the add of a product has the slug format of the Product Rules, checked
 * by {@link ProductSlugs#isValid}, the one place that rule is written. {@code null} is valid: the
 * slug of the add is optional, and {@code api} then generates it.
 *
 * <p>Only the add uses this constraint. The edit must not (API Contract, section "Slug khi sửa",
 * and NFR16): a slug equal to the one stored, ignoring case, is kept without checking its format,
 * so a product of before the Epic with a slug out of the format can still be saved. Only a slug
 * that differs from the stored one is checked, which needs the stored slug, so the service of the
 * edit (US3, SHOP-34) checks it with {@link ProductSlugs#isValid}, not a constraint on the request
 * body.
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
