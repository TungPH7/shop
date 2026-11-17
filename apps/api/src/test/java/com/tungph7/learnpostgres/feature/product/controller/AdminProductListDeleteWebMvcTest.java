package com.tungph7.learnpostgres.feature.product.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.Iterator;
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

import com.tungph7.learnpostgres.common.error.GlobalExceptionHandler;
import com.tungph7.learnpostgres.common.error.ProblemDetailFactory;
import com.tungph7.learnpostgres.common.logging.LoggingProperties;
import com.tungph7.learnpostgres.common.security.TestSecurityConfig;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.dto.AdminProductSummary;
import com.tungph7.learnpostgres.feature.product.dto.ProductPage;
import com.tungph7.learnpostgres.feature.product.dto.ProductStatusFilter;
import com.tungph7.learnpostgres.feature.product.service.AdminProductService;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * {@code GET} and {@code DELETE /api/admin/products} at the HTTP boundary (SHOP-16): the defaults
 * and limits of the parameters, the 400 {@code INVALID_PARAMETER} of each invalid parameter (NFR3),
 * the 204 of a delete and the field names of the API Contract of the plan of SHOP-7. The service is
 * a mock: the search, the filter and the delete run against the database in {@code
 * AdminProductListDeleteIntegrationTest}.
 */
@WebMvcTest(AdminProductController.class)
@Import({TestSecurityConfig.class, GlobalExceptionHandler.class, ProblemDetailFactory.class})
@EnableConfigurationProperties(LoggingProperties.class)
class AdminProductListDeleteWebMvcTest {

  private static final String URL = "/api/admin/products";
  private static final UUID ID = UUID.fromString("019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f");

  @Autowired MockMvc mockMvc;
  @Autowired ObjectMapper json;

  @MockitoBean AdminProductService service;

  // ============================================================
  // GET: 200
  // ============================================================

  @Test
  void list_withNoParameter_listsEveryStatusFromTheFirstProductTwentyAtATime() throws Exception {
    when(service.list(isNull(), eq(ProductStatusFilter.ALL), eq(0), eq(20)))
        .thenReturn(new ProductPage<>(List.of(), 0, 0, 20));

    mockMvc
        .perform(get(URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items").isEmpty())
        .andExpect(jsonPath("$.totalItems").value(0))
        .andExpect(jsonPath("$.offset").value(0))
        .andExpect(jsonPath("$.limit").value(20));

    verify(service).list(null, ProductStatusFilter.ALL, 0, 20);
  }

  @Test
  void list_passesEachParameterToTheService() throws Exception {
    when(service.list(any(), any(), anyInt(), anyInt()))
        .thenReturn(new ProductPage<>(List.of(), 0, 40, 100));

    mockMvc
        .perform(
            get(URL)
                .param("q", "áo thun")
                .param("status", "HIDDEN")
                .param("offset", "40")
                .param("limit", "100"))
        .andExpect(status().isOk());

    verify(service).list("áo thun", ProductStatusFilter.HIDDEN, 40, 100);
  }

  @Test
  void list_withStatusActive_passesActive() throws Exception {
    when(service.list(any(), any(), anyInt(), anyInt()))
        .thenReturn(new ProductPage<>(List.of(), 0, 0, 20));

    mockMvc.perform(get(URL).param("status", "ACTIVE")).andExpect(status().isOk());

    verify(service).list(null, ProductStatusFilter.ACTIVE, 0, 20);
  }

  @Test
  void list_withTheSmallestLimit_returns200() throws Exception {
    when(service.list(any(), any(), anyInt(), anyInt()))
        .thenReturn(new ProductPage<>(List.of(), 0, 0, 1));

    mockMvc.perform(get(URL).param("limit", "1")).andExpect(status().isOk());

    verify(service).list(null, ProductStatusFilter.ALL, 0, 1);
  }

  @Test
  void list_ignoresAnUnknownParameter() throws Exception {
    when(service.list(any(), any(), anyInt(), anyInt()))
        .thenReturn(new ProductPage<>(List.of(), 0, 0, 20));

    mockMvc
        .perform(get(URL).param("sort", "PRICE_ASC").param("page", "abc"))
        .andExpect(status().isOk());

    verify(service).list(null, ProductStatusFilter.ALL, 0, 20);
  }

  @Test
  void list_returnsThePageWithTheProductsOfTheService() throws Exception {
    when(service.list(any(), any(), anyInt(), anyInt()))
        .thenReturn(new ProductPage<>(List.of(sampleSummary()), 41, 20, 20));

    mockMvc
        .perform(get(URL).param("offset", "20"))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.totalItems").value(41))
        .andExpect(jsonPath("$.offset").value(20))
        .andExpect(jsonPath("$.limit").value(20))
        .andExpect(jsonPath("$.items[0].id").value(ID.toString()))
        .andExpect(jsonPath("$.items[0].name").value("Bao tay len"))
        .andExpect(jsonPath("$.items[0].slug").value("bao-tay-len"))
        .andExpect(jsonPath("$.items[0].price").value(0))
        .andExpect(jsonPath("$.items[0].status").value("HIDDEN"))
        .andExpect(jsonPath("$.items[0].availability").value("OUT_OF_STOCK"))
        .andExpect(jsonPath("$.items[0].createdAt").value("2026-11-16T02:10:00.123Z"))
        .andExpect(jsonPath("$.items[0].updatedAt").value("2026-11-16T02:15:30.456Z"));
  }

  @Test
  void list_returnsExactlyTheFieldsOfPageAndAdminProductSummary() throws Exception {
    when(service.list(any(), any(), anyInt(), anyInt()))
        .thenReturn(new ProductPage<>(List.of(sampleSummary()), 1, 0, 20));

    String body =
        mockMvc
            .perform(get(URL))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    JsonNode page = json.readTree(body);

    assertThat(fieldNames(page))
        .containsExactlyInAnyOrder("items", "totalItems", "offset", "limit");
    assertThat(fieldNames(page.get("items").get(0)))
        .containsExactlyInAnyOrder(
            "id", "name", "slug", "price", "status", "availability", "createdAt", "updatedAt");
  }

  // ============================================================
  // GET: 400 INVALID_PARAMETER (NFR3)
  // ============================================================

  static Stream<Arguments> invalidParameters() {
    return Stream.of(
        Arguments.of("status", "DELETED", "outside the enum"),
        Arguments.of("status", "active", "lower case"),
        Arguments.of("status", "1", "a number"),
        Arguments.of("offset", "-1", "negative"),
        Arguments.of("offset", "abc", "not a number"),
        Arguments.of("offset", "1.5", "a fraction"),
        Arguments.of("offset", "99999999999", "beyond an int"),
        Arguments.of("limit", "0", "below 1"),
        Arguments.of("limit", "101", "above 100"),
        Arguments.of("limit", "-5", "negative"),
        Arguments.of("limit", "abc", "not a number"));
  }

  @ParameterizedTest(name = "{0}={1} ({2})")
  @MethodSource("invalidParameters")
  void list_withAnInvalidParameter_returns400NamingIt(String name, String value, String label)
      throws Exception {
    mockMvc
        .perform(get(URL).param(name, value))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(400))
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.parameter").value(name))
        .andExpect(jsonPath("$.instance").value(URL))
        .andExpect(jsonPath("$.correlationId").exists())
        .andExpect(jsonPath("$.timestamp").exists());

    verifyNoInteractions(service);
  }

  @Test
  void list_withTwoInvalidParameters_namesTheFirstOne() throws Exception {
    mockMvc
        .perform(get(URL).param("offset", "-1").param("limit", "500"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.parameter").value("offset"));

    verifyNoInteractions(service);
  }

  @Test
  void list_withAnInvalidParameter_showsNoInternalDetail() throws Exception {
    String body =
        mockMvc
            .perform(get(URL).param("limit", "101"))
            .andExpect(status().isBadRequest())
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(body)
        .doesNotContain("Exception")
        .doesNotContain("com.tungph7")
        .doesNotContain("AdminProductController");
  }

  // ============================================================
  // DELETE
  // ============================================================

  @Test
  void delete_returns204WithNoBody() throws Exception {
    mockMvc
        .perform(delete(URL + "/" + ID))
        .andExpect(status().isNoContent())
        .andExpect(content().string(""));

    verify(service).delete(ID);
  }

  @Test
  void delete_withAnIdThatIsNotAUuid_returns400NamingTheId() throws Exception {
    mockMvc
        .perform(delete(URL + "/not-a-uuid"))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.parameter").value("id"));

    verify(service, never()).delete(any());
  }

  // ============================================================
  // Helpers
  // ============================================================

  private static AdminProductSummary sampleSummary() {
    return new AdminProductSummary(
        ID,
        "Bao tay len",
        "bao-tay-len",
        0L,
        ProductStatus.HIDDEN,
        ProductAvailability.OUT_OF_STOCK,
        Instant.parse("2026-11-16T02:10:00.123Z"),
        Instant.parse("2026-11-16T02:15:30.456Z"));
  }

  private static Iterable<String> fieldNames(JsonNode node) {
    Iterator<String> names = node.propertyNames().iterator();
    return () -> names;
  }
}
