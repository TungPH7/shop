package com.tungph7.learnpostgres.feature.product.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasKey;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.tungph7.learnpostgres.common.error.BadRequestException;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.error.GlobalExceptionHandler;
import com.tungph7.learnpostgres.common.error.NotFoundException;
import com.tungph7.learnpostgres.common.error.ProblemDetailFactory;
import com.tungph7.learnpostgres.common.logging.LoggingProperties;
import com.tungph7.learnpostgres.common.security.TestSecurityConfig;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.ProductSort;
import com.tungph7.learnpostgres.feature.product.dto.ProductPage;
import com.tungph7.learnpostgres.feature.product.dto.StoreProduct;
import com.tungph7.learnpostgres.feature.product.dto.StoreProductSummary;
import com.tungph7.learnpostgres.feature.product.service.StoreProductService;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * The products of a category, {@code GET /api/categories/{slug}/products}, and the category of the
 * store detail of a product, at the HTTP boundary (SHOP-82, step 9; plan of SHOP-81, API Contract,
 * NFR3). The service is a mock; {@code StoreCategoryProductsIntegrationTest} runs it on the
 * database.
 */
@WebMvcTest(StoreProductController.class)
@Import({TestSecurityConfig.class, GlobalExceptionHandler.class, ProblemDetailFactory.class})
@EnableConfigurationProperties(LoggingProperties.class)
class StoreCategoryProductsWebMvcTest {

  private static final String URL = "/api/categories/ao/products";
  private static final UUID ID = UUID.fromString("019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f");

  @Autowired MockMvc mockMvc;
  @Autowired ObjectMapper json;

  @MockitoBean StoreProductService service;

  // ============================================================
  // GET /api/categories/{slug}/products
  // ============================================================

  @Test
  void listOfCategory_withNoParameter_asksForTheFirst24ProductsNewestFirst() throws Exception {
    when(service.listOfCategory("ao", null, 0, 24)).thenReturn(page());

    mockMvc
        .perform(get(URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].name").value("Áo thun cổ tròn"))
        .andExpect(jsonPath("$.totalItems").value(1))
        .andExpect(jsonPath("$.offset").value(0))
        .andExpect(jsonPath("$.limit").value(24));
  }

  @Test
  void listOfCategory_passesTheSortOffsetAndLimitAsSentAndIgnoresAStatus() throws Exception {
    when(service.listOfCategory("AO", ProductSort.PRICE_DESC, 48, 100)).thenReturn(page());

    mockMvc
        .perform(
            get("/api/categories/AO/products")
                .param("sort", "PRICE_DESC")
                .param("offset", "48")
                .param("limit", "100")
                .param("status", "HIDDEN"))
        .andExpect(status().isOk());

    verify(service).listOfCategory("AO", ProductSort.PRICE_DESC, 48, 100);
  }

  static Stream<Arguments> invalidParameters() {
    return Stream.of(
        Arguments.of("offset", "-1"),
        Arguments.of("offset", "abc"),
        Arguments.of("limit", "0"),
        Arguments.of("limit", "101"),
        Arguments.of("limit", "2.5"),
        Arguments.of("sort", "OLDEST"),
        Arguments.of("sort", "price-asc"));
  }

  @ParameterizedTest(name = "{0}={1}")
  @MethodSource("invalidParameters")
  void listOfCategory_withAnInvalidParameter_returns400NamingIt(String name, String value)
      throws Exception {
    mockMvc
        .perform(get(URL).param(name, value))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.parameter").value(name));

    verify(service, never()).listOfCategory(anyString(), any(), anyInt(), anyInt());
  }

  @Test
  void listOfCategory_withRelevance_returns400NamingSort() throws Exception {
    when(service.listOfCategory("ao", ProductSort.RELEVANCE, 0, 24))
        .thenThrow(
            new BadRequestException(
                    ErrorCode.INVALID_PARAMETER,
                    "Parameter 'sort' cannot be RELEVANCE for the products of a category.")
                .putProperty("parameter", "sort"));

    mockMvc
        .perform(get(URL).param("sort", "RELEVANCE"))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.parameter").value("sort"))
        .andExpect(jsonPath("$.instance").value(URL));

    verify(service).listOfCategory("ao", ProductSort.RELEVANCE, 0, 24);
  }

  @Test
  void listOfCategory_ofACategoryAShopperCannotSee_returns404CategoryNotFound() throws Exception {
    when(service.listOfCategory("an", null, 0, 24))
        .thenThrow(new NotFoundException(ErrorCode.CATEGORY_NOT_FOUND, "Category not found."));

    mockMvc
        .perform(get("/api/categories/an/products"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("CATEGORY_NOT_FOUND"))
        .andExpect(jsonPath("$.detail").value("Category not found."));
  }

  // ============================================================
  // GET /api/products/{slug}: the category
  // ============================================================

  @Test
  void get_ofAProductInAVisibleCategory_returnsTheNameAndSlugOfTheCategory() throws Exception {
    when(service.get("ao-thun-co-tron"))
        .thenReturn(product(new StoreProduct.CategoryLink("Áo", "ao")));

    String body =
        mockMvc
            .perform(get("/api/products/ao-thun-co-tron"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.category.name").value("Áo"))
            .andExpect(jsonPath("$.category.slug").value("ao"))
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(fieldNames(json.readTree(body).get("category")))
        .containsExactlyInAnyOrder("name", "slug");
  }

  @Test
  void get_ofAProductWithoutVisibleCategory_writesCategoryNull() throws Exception {
    when(service.get("ao-thun-co-tron")).thenReturn(product(null));

    mockMvc
        .perform(get("/api/products/ao-thun-co-tron"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasKey("category")))
        .andExpect(jsonPath("$.category").isEmpty());
  }

  private static ProductPage<StoreProductSummary> page() {
    return new ProductPage<>(
        List.of(
            new StoreProductSummary(
                ID,
                "Áo thun cổ tròn",
                "ao-thun-co-tron",
                200_000L,
                null,
                ProductAvailability.IN_STOCK)),
        1,
        0,
        24);
  }

  private static StoreProduct product(StoreProduct.CategoryLink category) {
    return new StoreProduct(
        ID,
        "Áo thun cổ tròn",
        "ao-thun-co-tron",
        200_000L,
        250_000L,
        ProductAvailability.IN_STOCK,
        "Áo thun cotton 100%.",
        Instant.parse("2026-11-22T02:15:30Z"),
        category);
  }

  private static List<String> fieldNames(JsonNode node) {
    List<String> names = new ArrayList<>();
    node.propertyNames().forEach(names::add);
    return names;
  }
}
