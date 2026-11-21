package com.tungph7.learnpostgres.feature.category.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.tungph7.learnpostgres.common.text.FormText;
import com.tungph7.learnpostgres.common.text.SlugFormat;
import com.tungph7.learnpostgres.feature.category.domain.Category.CategoryStatus;

/**
 * The body of {@code PUT /api/admin/categories/{id}}: {@code UpdateCategoryInput} of the API
 * Contract of the plan of SHOP-81, every field sent and checked against the Category Rules, every
 * invalid field in one 400 (AC3). Unlike a product, a category has no slug of before the Epic, so
 * the slug format is always checked.
 *
 * @param name trimmed, then 1–60 characters
 * @param slug required, the slug format, at most 100 characters ({@link SlugFormat})
 * @param status required
 * @param version the version of the category the form read: another one is a 409 (NFR12)
 */
public record UpdateCategoryRequest(
    @NotBlank(message = "must not be blank")
        @Size(
            max = CreateCategoryRequest.NAME_MAX_LENGTH,
            message = "must be at most 60 characters")
        String name,
    @NotBlank(message = "must not be blank") @SlugFormat String slug,
    @NotNull(message = "must not be null") CategoryStatus status,
    @NotNull(message = "must not be null") Long version) {

  /** Trims the name, as the form does. */
  public UpdateCategoryRequest {
    name = FormText.trim(name);
  }
}
