package com.tungph7.learnpostgres.feature.product.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import org.junit.jupiter.api.Test;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;

/**
 * {@link StoreProductOpenApiCustomizer}: the category of a store product is a {@code StoreCategory}
 * or {@code null}; a document without that field is left as it is. The whole document is checked by
 * {@code CategoryApiDocsIntegrationTest}.
 */
class StoreProductOpenApiCustomizerTest {

  private static final String STORE_CATEGORY_REF = "#/components/schemas/StoreCategory";

  private final StoreProductOpenApiCustomizer customizer = new StoreProductOpenApiCustomizer();

  @Test
  void theCategoryOfAStoreProduct_becomesAStoreCategoryOrNull_withItsDescription() {
    OpenAPI openApi =
        documentWith(
            new ObjectSchema()
                .addProperty("name", new StringSchema())
                .addProperty(
                    "category",
                    new Schema<>().$ref(STORE_CATEGORY_REF).description("null when hidden")));

    customizer.customise(openApi);

    Schema<?> category = storeProduct(openApi).getProperties().get("category");
    assertThat(category.get$ref()).isNull();
    assertThat(category.getDescription()).isEqualTo("null when hidden");
    assertThat(category.getOneOf()).hasSize(2);
    assertThat(category.getOneOf().get(0).get$ref()).isEqualTo(STORE_CATEGORY_REF);
    assertThat(category.getOneOf().get(1).getTypes()).isEqualTo(Set.of("null"));
    assertThat(storeProduct(openApi).getProperties().get("name")).isInstanceOf(StringSchema.class);
  }

  @Test
  void aDocumentWithoutStoreProduct_isLeftAsItIs() {
    OpenAPI empty = new OpenAPI();
    OpenAPI noSchemas = new OpenAPI().components(new Components());
    OpenAPI otherSchemas =
        new OpenAPI().components(new Components().addSchemas("AdminProduct", new ObjectSchema()));

    customizer.customise(empty);
    customizer.customise(noSchemas);
    customizer.customise(otherSchemas);

    assertThat(empty.getComponents()).isNull();
    assertThat(noSchemas.getComponents().getSchemas()).isNull();
    assertThat(otherSchemas.getComponents().getSchemas()).containsOnlyKeys("AdminProduct");
  }

  @Test
  void aStoreProductWithoutACategoryRef_isLeftAsItIs() {
    Schema<?> inline = new ObjectSchema();
    OpenAPI withoutProperties = documentWith(new ObjectSchema());
    OpenAPI withoutCategory = documentWith(new ObjectSchema().addProperty("name", inline));
    OpenAPI inlineCategory = documentWith(new ObjectSchema().addProperty("category", inline));

    customizer.customise(withoutProperties);
    customizer.customise(withoutCategory);
    customizer.customise(inlineCategory);

    assertThat(storeProduct(withoutProperties).getProperties()).isNull();
    assertThat(storeProduct(withoutCategory).getProperties()).containsOnlyKeys("name");
    assertThat(storeProduct(inlineCategory).getProperties().get("category")).isSameAs(inline);
  }

  private static OpenAPI documentWith(Schema<?> storeProduct) {
    return new OpenAPI().components(new Components().addSchemas("StoreProduct", storeProduct));
  }

  private static Schema<?> storeProduct(OpenAPI openApi) {
    return openApi.getComponents().getSchemas().get("StoreProduct");
  }
}
