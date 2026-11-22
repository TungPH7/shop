package com.tungph7.learnpostgres.feature.category.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import com.tungph7.learnpostgres.common.text.FormText;
import com.tungph7.learnpostgres.common.text.SlugFormat;
import com.tungph7.learnpostgres.feature.category.domain.Category.CategoryStatus;

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
 */
public record CreateCategoryRequest(
    @NotBlank(message = "must not be blank")
        @Size(
            max = CreateCategoryRequest.NAME_MAX_LENGTH,
            message = "must be at most 60 characters")
        String name,
    @SlugFormat String slug,
    CategoryStatus status) {

  /** The longest name, in UTF-16 units. */
  public static final int NAME_MAX_LENGTH = 60;

  /** Trims the name, as the form does. */
  public CreateCategoryRequest {
    name = FormText.trim(name);
  }
}
