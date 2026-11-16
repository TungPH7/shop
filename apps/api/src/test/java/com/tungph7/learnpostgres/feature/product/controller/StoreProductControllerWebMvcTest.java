package com.tungph7.learnpostgres.feature.product.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.Iterator;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.error.GlobalExceptionHandler;
import com.tungph7.learnpostgres.common.error.NotFoundException;
import com.tungph7.learnpostgres.common.error.ProblemDetailFactory;
import com.tungph7.learnpostgres.common.logging.LoggingProperties;
import com.tungph7.learnpostgres.common.security.TestSecurityConfig;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.dto.StoreProduct;
import com.tungph7.learnpostgres.feature.product.service.StoreProductService;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * {@code GET} and {@code HEAD /api/products/{slug}} at the HTTP boundary (SHOP-22): the field names
 * of {@code StoreProduct} in the API Contract of the plan of SHOP-7, the 404 {@code
 * PRODUCT_NOT_FOUND}, and a {@code HEAD} with no body. The service is a mock: which products a
 * shopper sees, and the three 404 compared on the database, are in {@code
 * StoreProductIntegrationTest}.
 */
@WebMvcTest(StoreProductController.class)
@Import({TestSecurityConfig.class, GlobalExceptionHandler.class, ProblemDetailFactory.class})
@EnableConfigurationProperties(LoggingProperties.class)
class StoreProductControllerWebMvcTest {

  private static final String URL = "/api/products/ao-thun-co-tron";
  private static final UUID ID = UUID.fromString("019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f");

  @Autowired MockMvc mockMvc;
  @Autowired ObjectMapper json;

  @MockitoBean StoreProductService service;

  // ============================================================
  // GET
  // ============================================================

  @Test
  void get_returnsTheProductAsTheApiContractWritesIt() throws Exception {
    when(service.get("ao-thun-co-tron")).thenReturn(sample());

    mockMvc
        .perform(get(URL))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.id").value(ID.toString()))
        .andExpect(jsonPath("$.name").value("Áo thun cổ tròn"))
        .andExpect(jsonPath("$.slug").value("ao-thun-co-tron"))
        .andExpect(jsonPath("$.price").value(200_000))
        .andExpect(jsonPath("$.compareAtPrice").value(250_000))
        .andExpect(jsonPath("$.availability").value("IN_STOCK"))
        .andExpect(jsonPath("$.description").value("Áo thun cotton 100%.\nCổ tròn, tay ngắn."))
        .andExpect(jsonPath("$.updatedAt").value("2026-11-16T02:15:30.000Z"));
  }

  @Test
  void get_returnsExactlyTheFieldsOfStoreProduct() throws Exception {
    when(service.get("ao-thun-co-tron")).thenReturn(sample());

    String body =
        mockMvc
            .perform(get(URL))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(fieldNames(json.readTree(body)))
        .containsExactlyInAnyOrder(
            "id",
            "name",
            "slug",
            "price",
            "compareAtPrice",
            "availability",
            "description",
            "updatedAt");
  }

  @Test
  void get_withNoCompareAtPriceOrDescription_writesThemAsNull() throws Exception {
    when(service.get("ao-thun-co-tron"))
        .thenReturn(
            new StoreProduct(
                ID,
                "Áo thun cổ tròn",
                "ao-thun-co-tron",
                200_000L,
                null,
                ProductAvailability.OUT_OF_STOCK,
                null,
                Instant.parse("2026-11-16T02:15:30Z")));

    String body =
        mockMvc
            .perform(get(URL))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    JsonNode product = json.readTree(body);

    assertThat(product.has("compareAtPrice")).isTrue();
    assertThat(product.get("compareAtPrice").isNull()).isTrue();
    assertThat(product.has("description")).isTrue();
    assertThat(product.get("description").isNull()).isTrue();
    assertThat(product.get("availability").asString()).isEqualTo("OUT_OF_STOCK");
  }

  @Test
  void get_ignoresAStatusParameter() throws Exception {
    when(service.get("ao-thun-co-tron")).thenReturn(sample());

    mockMvc.perform(get(URL).param("status", "HIDDEN")).andExpect(status().isOk());

    verify(service).get("ao-thun-co-tron");
  }

  @Test
  void get_passesTheSlugAsTyped_forTheDatabaseToCompareIgnoringCase() throws Exception {
    when(service.get("AO-THUN-CO-TRON")).thenReturn(sample());

    mockMvc.perform(get("/api/products/AO-THUN-CO-TRON")).andExpect(status().isOk());

    verify(service).get("AO-THUN-CO-TRON");
  }

  @Test
  void get_ofAProductAShopperCannotSee_returns404ProductNotFound() throws Exception {
    when(service.get("ao-thun-co-tron")).thenThrow(notFound());

    mockMvc
        .perform(get(URL))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(404))
        .andExpect(jsonPath("$.code").value("PRODUCT_NOT_FOUND"))
        .andExpect(jsonPath("$.title").value("Product not found"))
        .andExpect(jsonPath("$.detail").value("Product not found."))
        .andExpect(jsonPath("$.instance").value(URL))
        .andExpect(jsonPath("$.correlationId").exists())
        .andExpect(jsonPath("$.timestamp").exists());
  }

  @Test
  void post_isNotAllowed() throws Exception {
    mockMvc
        .perform(post(URL).contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isMethodNotAllowed());
  }

  // ============================================================
  // HEAD
  // ============================================================

  @Test
  void head_ofAProductAShopperSees_returns200WithNoBody() throws Exception {
    when(service.isVisible("ao-thun-co-tron")).thenReturn(true);

    mockMvc.perform(head(URL)).andExpect(status().isOk()).andExpect(content().string(""));

    verify(service).isVisible("ao-thun-co-tron");
  }

  @Test
  void head_ofAProductAShopperCannotSee_returns404WithNoBody() throws Exception {
    when(service.isVisible("ao-thun-co-tron")).thenReturn(false);

    mockMvc.perform(head(URL)).andExpect(status().isNotFound()).andExpect(content().string(""));
  }

  @Test
  void head_ignoresAStatusParameter() throws Exception {
    when(service.isVisible("ao-thun-co-tron")).thenReturn(false);

    mockMvc.perform(head(URL).param("status", "HIDDEN")).andExpect(status().isNotFound());

    verify(service).isVisible("ao-thun-co-tron");
  }

  // ============================================================
  // Helpers
  // ============================================================

  private static StoreProduct sample() {
    return new StoreProduct(
        ID,
        "Áo thun cổ tròn",
        "ao-thun-co-tron",
        200_000L,
        250_000L,
        ProductAvailability.IN_STOCK,
        "Áo thun cotton 100%.\nCổ tròn, tay ngắn.",
        Instant.parse("2026-11-16T02:15:30Z"));
  }

  private static NotFoundException notFound() {
    return new NotFoundException(ErrorCode.PRODUCT_NOT_FOUND, "Product not found.");
  }

  private static Iterable<String> fieldNames(JsonNode node) {
    Iterator<String> names = node.propertyNames().iterator();
    return () -> names;
  }
}
