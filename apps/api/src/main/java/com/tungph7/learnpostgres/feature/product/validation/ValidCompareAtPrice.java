package com.tungph7.learnpostgres.feature.product.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.math.BigDecimal;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

/**
 * The compare-at price of a product, when there is one, is above its selling price (Product Rules
 * of SHOP-7). A class-level constraint, since it reads two fields, that reports its error on the
 * field {@value #FIELD}: the 400 {@code VALIDATION_FAILED} lists it with the errors of the other
 * fields, and the form of {@code admin} shows it under the compare-at price.
 *
 * <p>Either price missing is valid here: the field constraints of each price report that.
 */
@Documented
@Constraint(validatedBy = ValidCompareAtPrice.CompareAtPriceValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidCompareAtPrice {

  /** The field the error is reported on. */
  String FIELD = "compareAtPrice";

  String message() default "must be greater than price";

  Class<?>[] groups() default {};

  Class<? extends Payload>[] payload() default {};

  /** A request body with the two prices, as they were read from JSON. */
  interface Prices {

    BigDecimal price();

    BigDecimal compareAtPrice();
  }

  /** Checks {@code compareAtPrice > price} when both are present. */
  class CompareAtPriceValidator implements ConstraintValidator<ValidCompareAtPrice, Prices> {

    @Override
    public boolean isValid(Prices value, ConstraintValidatorContext context) {
      if (value == null || value.price() == null || value.compareAtPrice() == null) {
        return true;
      }
      if (value.compareAtPrice().compareTo(value.price()) > 0) {
        return true;
      }
      context.disableDefaultConstraintViolation();
      context
          .buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
          .addPropertyNode(FIELD)
          .addConstraintViolation();
      return false;
    }
  }
}
