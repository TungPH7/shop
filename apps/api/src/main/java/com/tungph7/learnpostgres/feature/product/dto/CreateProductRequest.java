package com.tungph7.learnpostgres.feature.product.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.tungph7.learnpostgres.common.text.FormText;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.validation.ValidCompareAtPrice;
import com.tungph7.learnpostgres.feature.product.validation.ValidSlug;

/**
 * The body of {@code POST /api/admin/products}: {@code CreateProductInput} of the API Contract of
 * the plan of SHOP-7, checked against the Product Rules by Bean Validation, every invalid field in
 * one 400 (AC7).
 *
 * <p>The prices are read as {@link BigDecimal}, so {@code 450000.5} is a field error next to the
 * others instead of a number Jackson cuts to {@code 450000} or a body it cannot read (plan,
 * decision 7). The service turns them into {@code long} with {@code longValueExact()} once they are
 * valid. {@code @Digits} only checks that a price is whole: the upper bound is {@code @Max}, so a
 * price of 1,000,000,000 is reported as too big, not as a fraction.
 *
 * <p>Lengths are UTF-16 units ({@code String.length()}), as {@code .length} of the form of {@code
 * admin} counts them, and white space is what {@code trim()} of that form removes ({@link
 * FormText}).
 *
 * @param name trimmed, then 1–150 characters
 * @param slug absent or {@code null}: generated from the name; otherwise the slug format, at most
 *     100 characters ({@link ValidSlug})
 * @param description at most 5,000 characters, kept verbatim; empty or only white space is {@code
 *     null}
 * @param price whole dong, 1–999,999,999
 * @param compareAtPrice whole dong, above {@code price}, at most 999,999,999; or {@code null}
 * @param status {@code ACTIVE} when absent
 * @param availability {@code IN_STOCK} when absent
 */
@ValidCompareAtPrice
public record CreateProductRequest(
    @NotBlank(message = "must not be blank")
        @Size(
            max = CreateProductRequest.NAME_MAX_LENGTH,
            message = "must be at most 150 characters")
        String name,
    @ValidSlug String slug,
    @Size(
            max = CreateProductRequest.DESCRIPTION_MAX_LENGTH,
            message = "must be at most 5000 characters")
        String description,
    @NotNull(message = "must not be null")
        @Digits(integer = Integer.MAX_VALUE, fraction = 0, message = "must be a whole number")
        @Min(value = 1, message = "must be at least 1")
        @Max(value = CreateProductRequest.PRICE_MAX, message = "must be at most 999999999")
        BigDecimal price,
    @Digits(integer = Integer.MAX_VALUE, fraction = 0, message = "must be a whole number")
        @Min(value = 1, message = "must be at least 1")
        @Max(value = CreateProductRequest.PRICE_MAX, message = "must be at most 999999999")
        BigDecimal compareAtPrice,
    ProductStatus status,
    ProductAvailability availability)
    implements ValidCompareAtPrice.Prices {

  public static final int NAME_MAX_LENGTH = 150;
  public static final int DESCRIPTION_MAX_LENGTH = 5000;
  public static final long PRICE_MAX = 999_999_999L;

  /** Trims the name, and turns a blank description into {@code null}, as the form does. */
  public CreateProductRequest {
    name = FormText.trim(name);
    description = FormText.isBlank(description) ? null : description;
  }
}
