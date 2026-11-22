package com.tungph7.learnpostgres.feature.category.controller;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItems;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;

/**
 * {@code /v3/api-docs} describes each endpoint of categories, the new fields of products and each
 * new error code (SHOP-82; plan of SHOP-81, API Contract): the Verification of the item reads these
 * on Development.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CategoryApiDocsIntegrationTest extends AbstractContainerBaseTest {

  private static final String ADMIN_LIST = "$.paths['/api/admin/categories']";
  private static final String ADMIN_ONE = "$.paths['/api/admin/categories/{id}']";
  private static final String STORE_ONE = "$.paths['/api/categories/{slug}']";
  private static final String STORE_PRODUCTS = "$.paths['/api/categories/{slug}/products'].get";
  private static final String SCHEMAS = "$.components.schemas";

  @Autowired MockMvc mockMvc;

  @Test
  void apiDocs_describeTheAdminListAndAdd() throws Exception {
    apiDocs()
        .andExpect(jsonPath(ADMIN_LIST + ".get.responses['200']").exists())
        .andExpect(jsonPath(ADMIN_LIST + ".post.responses['201']").exists())
        .andExpect(jsonPath(ADMIN_LIST + ".post.responses['400']").exists())
        .andExpect(
            jsonPath(ADMIN_LIST + ".post.responses['409'].description")
                .value(containsString("CATEGORY_NAME_DUPLICATED")))
        .andExpect(
            jsonPath(ADMIN_LIST + ".post.responses['409'].description")
                .value(containsString("CATEGORY_SLUG_DUPLICATED")));
  }

  @Test
  void apiDocs_describeTheAdminReadEditAndDelete() throws Exception {
    apiDocs()
        .andExpect(jsonPath(ADMIN_ONE + ".get.responses['200']").exists())
        .andExpect(
            jsonPath(ADMIN_ONE + ".get.responses['404'].description")
                .value(containsString("CATEGORY_NOT_FOUND")))
        .andExpect(
            jsonPath(ADMIN_ONE + ".put.responses['404'].description")
                .value(containsString("CATEGORY_NOT_FOUND")))
        .andExpect(
            jsonPath(ADMIN_ONE + ".put.responses['409'].description")
                .value(containsString("OPTIMISTIC_LOCK_CONFLICT")))
        .andExpect(
            jsonPath(ADMIN_ONE + ".put.responses['409'].description")
                .value(containsString("CATEGORY_NAME_DUPLICATED")))
        .andExpect(
            jsonPath(ADMIN_ONE + ".put.responses['409'].description")
                .value(containsString("CATEGORY_SLUG_DUPLICATED")))
        .andExpect(jsonPath(ADMIN_ONE + ".delete.responses['204']").exists())
        .andExpect(jsonPath(ADMIN_ONE + ".delete.responses['404']").doesNotExist());
  }

  @Test
  void apiDocs_describeTheStoreCategories() throws Exception {
    apiDocs()
        .andExpect(jsonPath("$.paths['/api/categories'].get.responses['200']").exists())
        .andExpect(jsonPath("$.paths['/api/sitemap/categories'].get.responses['200']").exists())
        .andExpect(jsonPath(STORE_ONE + ".get.responses['200']").exists())
        .andExpect(
            jsonPath(STORE_ONE + ".get.responses['404'].description")
                .value(containsString("CATEGORY_NOT_FOUND")))
        .andExpect(jsonPath(STORE_ONE + ".head.responses['200']").exists())
        .andExpect(
            jsonPath(STORE_ONE + ".head.responses['404'].description")
                .value(containsString("CATEGORY_NOT_FOUND")))
        .andExpect(jsonPath(SCHEMAS + ".StoreCategory.properties.name").exists())
        .andExpect(jsonPath(SCHEMAS + ".StoreCategory.properties.slug").exists())
        .andExpect(jsonPath(SCHEMAS + ".StoreCategory.properties.status").doesNotExist())
        .andExpect(
            jsonPath(SCHEMAS + ".CategorySitemapEntry.properties.updatedAt.format")
                .value("date-time"));
  }

  @Test
  void apiDocs_describeTheProductsOfACategory_withoutRelevance() throws Exception {
    apiDocs()
        .andExpect(
            jsonPath(STORE_PRODUCTS + ".parameters[*].name")
                .value(hasItems("slug", "sort", "offset", "limit")))
        .andExpect(
            jsonPath(STORE_PRODUCTS + ".parameters[?(@.name == 'sort')].schema.enum[*]")
                .value(contains("NEWEST", "PRICE_ASC", "PRICE_DESC")))
        .andExpect(
            jsonPath(STORE_PRODUCTS + ".parameters[?(@.name == 'limit')].schema.maximum")
                .value(contains(100)))
        .andExpect(jsonPath(STORE_PRODUCTS + ".responses['200']").exists())
        .andExpect(jsonPath(STORE_PRODUCTS + ".responses['400']").exists())
        .andExpect(
            jsonPath(STORE_PRODUCTS + ".responses['404'].description")
                .value(containsString("CATEGORY_NOT_FOUND")));
  }

  @Test
  void apiDocs_describeTheCategoryFieldsOfProducts() throws Exception {
    apiDocs()
        .andExpect(jsonPath(SCHEMAS + ".AdminProduct.properties.categoryId.format").value("uuid"))
        .andExpect(
            jsonPath(SCHEMAS + ".CreateProductRequest.properties.categoryId.format").value("uuid"))
        .andExpect(
            jsonPath(SCHEMAS + ".UpdateProductRequest.properties.categoryId.format").value("uuid"))
        .andExpect(
            jsonPath(SCHEMAS + ".UpdateProductRequest.properties.categoryId.description")
                .value(containsString("Absent")))
        .andExpect(
            jsonPath(SCHEMAS + ".StoreProduct.properties.category.$ref")
                .value("#/components/schemas/StoreCategory"))
        // Next to $ref, a type "null" would say the category is always null (OpenAPI 3.1).
        .andExpect(jsonPath(SCHEMAS + ".StoreProduct.properties.category.type").doesNotExist());
  }

  private ResultActions apiDocs() throws Exception {
    return mockMvc.perform(get("/v3/api-docs")).andExpect(status().isOk());
  }
}
