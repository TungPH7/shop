package com.tungph7.learnpostgres.feature.product.controller;

import java.util.List;
import java.util.Set;

import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.stereotype.Component;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.media.Schema;

/**
 * Describes {@code StoreProduct.category} in {@code /v3/api-docs} as a {@code StoreCategory} or
 * {@code null} (SHOP-85, finding 328bd7d8): the API sends {@code null} for a product without a
 * category or with a hidden one (AC21, NFR8).
 *
 * <p>The document is OpenAPI 3.1, where {@code nullable} is gone. The annotation can only put a
 * {@code type} next to the {@code $ref}, and both would then have to hold, so the field is written
 * here as {@code oneOf} of the {@code $ref} and {@code type: "null"}, with the description of the
 * annotation.
 */
@Component
public class StoreProductOpenApiCustomizer implements OpenApiCustomizer {

  private static final String STORE_PRODUCT = "StoreProduct";
  private static final String CATEGORY = "category";

  @Override
  public void customise(OpenAPI openApi) {
    if (openApi.getComponents() == null || openApi.getComponents().getSchemas() == null) {
      return;
    }
    Schema<?> storeProduct = openApi.getComponents().getSchemas().get(STORE_PRODUCT);
    if (storeProduct == null || storeProduct.getProperties() == null) {
      return;
    }
    var properties = storeProduct.getProperties();
    Schema<?> category = properties.get(CATEGORY);
    if (category == null || category.get$ref() == null) {
      return;
    }
    properties.put(
        CATEGORY,
        new Schema<>()
            .description(category.getDescription())
            .oneOf(
                List.of(
                    new Schema<>().$ref(category.get$ref()),
                    new Schema<>().types(Set.of("null")))));
  }
}
