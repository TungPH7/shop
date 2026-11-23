package com.tungph7.learnpostgres.feature.category.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import com.tungph7.learnpostgres.common.text.FormText;
import com.tungph7.learnpostgres.common.text.SlugFormat;
import com.tungph7.learnpostgres.feature.category.domain.Category.CategoryStatus;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The body of {@code POST /api/admin/categories}: {@code CreateCategoryInput} of the API Contract
 * of the plan of SHOP-81, checked against the Category Rules by Bean Validation, every invalid
 * field in one 400 (AC3).
 *
 * <p>Lengths are UTF-16 units ({@code String.length()}), as {@code .length} of the form of {@code
 * admin} counts them, and white space is what {@code trim()} of that form removes ({@link
 * FormText}), as for products (NFR9).
 *
 * @param name trimmed, then 1–60 characters
 * @param slug absent or {@code null}: generated from the name; otherwise the slug format, at most
 *     100 characters ({@link SlugFormat})
 * @param status {@code VISIBLE} when absent
 * @param displayOrder absent or {@code null}: 0; otherwise a whole number from 0 to 9999 (plan of
 *     SHOP-95, Architecture Decisions 5). Read as {@link BigDecimal}, so {@code 1.5} is a field
 *     error next to the others instead of a number Jackson cuts to 1, and {@code 99999999999} is
 *     "at most 9999" instead of a body it cannot read. {@code @Digits} only checks that it is
 *     whole; the bounds are {@code @Min} and {@code @Max}
 */
public record CreateCategoryRequest(
    @NotBlank(message = "must not be blank")
        @Size(
            max = CreateCategoryRequest.NAME_MAX_LENGTH,
            message = "must be at most 60 characters")
        String name,
    @SlugFormat String slug,
    CategoryStatus status,
    @Schema(
            types = {"integer", "null"},
            format = "int32",
            minimum = "0",
            maximum = "9999",
            description = DISPLAY_ORDER_DOC)
        @Digits(integer = Integer.MAX_VALUE, fraction = 0, message = "must be a whole number")
        @Min(value = 0, message = "must be at least 0")
        @Max(value = CreateCategoryRequest.DISPLAY_ORDER_MAX, message = "must be at most 9999")
        BigDecimal displayOrder) {

  /** The longest name, in UTF-16 units. */
  public static final int NAME_MAX_LENGTH = 60;

  /** The highest display order (ADR-0006). */
  public static final int DISPLAY_ORDER_MAX = 9999;

  /** What {@code displayOrder} of the add and the edit means, for {@code /v3/api-docs}. */
  static final String DISPLAY_ORDER_DOC =
      "Display order, a whole number from 0 to 9999; a smaller number comes first. Absent or null:"
          + " 0 on an add, and the edit keeps the stored number";

  /** Trims the name, as the form does. */
  public CreateCategoryRequest {
    name = FormText.trim(name);
  }
}
