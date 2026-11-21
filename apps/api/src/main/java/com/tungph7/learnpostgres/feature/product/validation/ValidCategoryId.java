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

import com.tungph7.learnpostgres.feature.product.dto.CategoryIdField;

/**
 * The {@code categoryId} of a product request is absent, {@code null} or the text of a UUID (plan
 * of SHOP-81, Architecture Decisions 7, NFR9). Whether a category has that id is checked by the
 * service, with the database as the last guard. Works on a {@link CategoryIdField}, for the edit,
 * and on a {@code String}, for the add.
 */
@Documented
@Constraint(
    validatedBy = {ValidCategoryId.FieldValidator.class, ValidCategoryId.TextValidator.class})
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidCategoryId {

  /** The message of a {@code categoryId} that is not a UUID. */
  String NOT_A_UUID = "must be a UUID";

  String message() default NOT_A_UUID;

  Class<?>[] groups() default {};

  Class<? extends Payload>[] payload() default {};

  /** Checks the field of the edit. */
  class FieldValidator implements ConstraintValidator<ValidCategoryId, CategoryIdField> {

    @Override
    public boolean isValid(CategoryIdField field, ConstraintValidatorContext context) {
      return field == null || CategoryIdField.isUuidOrNull(field.value());
    }
  }

  /** Checks the text of the add. */
  class TextValidator implements ConstraintValidator<ValidCategoryId, String> {

    @Override
    public boolean isValid(String text, ConstraintValidatorContext context) {
      return CategoryIdField.isUuidOrNull(text);
    }
  }
}
