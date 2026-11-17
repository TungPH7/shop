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

/**
 * The body of {@code PUT /api/admin/products/{id}}: {@code UpdateProductInput} of the API Contract
 * of the plan of SHOP-7, every field sent. Checked against the Product Rules by Bean Validation as
 * {@link CreateProductRequest} is, so an edit always asks for a price of 1–999,999,999, also for a
 * product of before the Epic whose price was 0.
 *
 * <p>The slug is only required here. Its format is not a constraint of this body (API Contract,
 * section "Slug khi sửa", and NFR16): a slug equal to the stored one, ignoring case, is kept
 * without checking its format, so a product of before the Epic with a slug out of the format can
 * still be saved. {@code AdminProductService#update} checks the format of a slug that differs from
 * the stored one, since only it knows the stored slug.
 *
 * @param name trimmed, then 1–150 characters
 * @param slug required; its format is checked by the service when it changes
 * @param description at most 5,000 characters, kept verbatim; empty or only white space is {@code
 *     null}
 * @param price whole dong, 1–999,999,999
 * @param compareAtPrice whole dong, above {@code price}, at most 999,999,999; or {@code null}
 * @param status required
 * @param availability required
 * @param version the version of the product the form read: another one is a 409 (AC13)
 */
@ValidCompareAtPrice
public record UpdateProductRequest(
    @NotBlank(message = "must not be blank")
        @Size(
            max = CreateProductRequest.NAME_MAX_LENGTH,
            message = "must be at most 150 characters")
        String name,
    @NotBlank(message = "must not be blank") String slug,
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
    @NotNull(message = "must not be null") ProductStatus status,
    @NotNull(message = "must not be null") ProductAvailability availability,
    @NotNull(message = "must not be null") Long version)
    implements ValidCompareAtPrice.Prices {

  /** Trims the name, and turns a blank description into {@code null}, as the form does. */
  public UpdateProductRequest {
    name = FormText.trim(name);
    description = FormText.isBlank(description) ? null : description;
  }
}
