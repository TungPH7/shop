package com.tungph7.learnpostgres.feature.product.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.junit.jupiter.params.provider.EnumSource;
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
import com.tungph7.learnpostgres.feature.product.dto.SitemapEntry;
import com.tungph7.learnpostgres.feature.product.dto.StoreProduct;
import com.tungph7.learnpostgres.feature.product.dto.StoreProductSummary;
import com.tungph7.learnpostgres.feature.product.service.StoreProductService;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * {@code GET} and {@code HEAD /api/products/{slug}} at the HTTP boundary (SHOP-22): the field names
 * of {@code StoreProduct} in the API Contract of the plan of SHOP-7, the 404 {@code
 * PRODUCT_NOT_FOUND}, and a {@code HEAD} with no body. {@code GET /api/products} (SHOP-26): the
 * defaults and limits of {@code offset} and {@code limit}, the 400 {@code INVALID_PARAMETER} of
 * each invalid one (NFR3), a status parameter ignored (NFR9) and the field names of {@code
 * Page<StoreProductSummary>}. {@code q} and {@code sort} (SHOP-29): both passed to the service as
 * sent, a 400 {@code INVALID_PARAMETER} naming {@code sort} for an unknown sort and for {@code
 * RELEVANCE} with no keyword. The service is a mock: which products a shopper sees, and the three
 * 404 compared on the database, are in {@code StoreProductIntegrationTest}.
 */
@WebMvcTest(StoreProductController.class)
@Import({TestSecurityConfig.class, GlobalExceptionHandler.class, ProblemDetailFactory.class})
@EnableConfigurationProperties(LoggingProperties.class)
class StoreProductControllerWebMvcTest {

  private static final String URL = "/api/products/ao-thun-co-tron";
  private static final String LIST_URL = "/api/products";
  private static final String SITEMAP_URL = "/api/sitemap/products";
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
  // GET list: 200 (SHOP-26)
  // ============================================================

  @Test
  void list_withNoParameter_startsAtTheFirstProductTwentyFourAtATime() throws Exception {
    when(service.list(null, null, 0, 24)).thenReturn(new ProductPage<>(List.of(), 0, 0, 24));

    mockMvc
        .perform(get(LIST_URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items").isEmpty())
        .andExpect(jsonPath("$.totalItems").value(0))
        .andExpect(jsonPath("$.offset").value(0))
        .andExpect(jsonPath("$.limit").value(24));

    verify(service).list(null, null, 0, 24);
  }

  @Test
  void list_passesTheOffsetAndTheLimitToTheService() throws Exception {
    when(service.list(any(), any(), anyInt(), anyInt()))
        .thenReturn(new ProductPage<>(List.of(), 0, 96, 100));

    mockMvc
        .perform(get(LIST_URL).param("offset", "96").param("limit", "100"))
        .andExpect(status().isOk());

    verify(service).list(null, null, 96, 100);
  }

  @Test
  void list_withTheSmallestLimit_returns200() throws Exception {
    when(service.list(any(), any(), anyInt(), anyInt()))
        .thenReturn(new ProductPage<>(List.of(), 0, 0, 1));

    mockMvc.perform(get(LIST_URL).param("limit", "1")).andExpect(status().isOk());

    verify(service).list(null, null, 0, 1);
  }

  @Test
  void list_ignoresAStatusParameter() throws Exception {
    when(service.list(any(), any(), anyInt(), anyInt()))
        .thenReturn(new ProductPage<>(List.of(), 0, 0, 24));

    mockMvc.perform(get(LIST_URL).param("status", "HIDDEN")).andExpect(status().isOk());

    verify(service).list(null, null, 0, 24);
  }

  @Test
  void list_ignoresAnUnknownParameter() throws Exception {
    when(service.list(any(), any(), anyInt(), anyInt()))
        .thenReturn(new ProductPage<>(List.of(), 0, 0, 24));

    mockMvc
        .perform(get(LIST_URL).param("page", "abc").param("order", "WHATEVER"))
        .andExpect(status().isOk());

    verify(service).list(null, null, 0, 24);
  }

  // ============================================================
  // GET list: q and sort (SHOP-29)
  // ============================================================

  @Test
  void list_passesTheKeywordAsTypedToTheService() throws Exception {
    when(service.list(any(), any(), anyInt(), anyInt()))
        .thenReturn(new ProductPage<>(List.of(), 0, 0, 24));

    mockMvc.perform(get(LIST_URL).param("q", "  Áo  THUN ")).andExpect(status().isOk());

    verify(service).list("  Áo  THUN ", null, 0, 24);
  }

  @ParameterizedTest(name = "sort={0}")
  @EnumSource(ProductSort.class)
  void list_passesEachSortToTheService(ProductSort sort) throws Exception {
    when(service.list(any(), any(), anyInt(), anyInt()))
        .thenReturn(new ProductPage<>(List.of(), 0, 0, 24));

    mockMvc
        .perform(get(LIST_URL).param("q", "ao thun").param("sort", sort.name()))
        .andExpect(status().isOk());

    verify(service).list("ao thun", sort, 0, 24);
  }

  @Test
  void list_withAnEmptySort_leavesTheDefaultToTheService() throws Exception {
    when(service.list(any(), any(), anyInt(), anyInt()))
        .thenReturn(new ProductPage<>(List.of(), 0, 0, 24));

    mockMvc.perform(get(LIST_URL).param("q", "ao").param("sort", "")).andExpect(status().isOk());

    verify(service).list("ao", null, 0, 24);
  }

  @Test
  void list_withRelevanceAndNoKeyword_returns400NamingSort() throws Exception {
    when(service.list(any(), any(), anyInt(), anyInt()))
        .thenThrow(
            new BadRequestException(
                    ErrorCode.INVALID_PARAMETER, "Sort RELEVANCE needs a keyword in 'q'.")
                .putProperty("parameter", "sort"));

    mockMvc
        .perform(get(LIST_URL).param("sort", "RELEVANCE"))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(400))
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.parameter").value("sort"))
        .andExpect(jsonPath("$.instance").value(LIST_URL))
        .andExpect(jsonPath("$.correlationId").exists())
        .andExpect(jsonPath("$.timestamp").exists());

    verify(service).list(null, ProductSort.RELEVANCE, 0, 24);
  }

  @Test
  void list_returnsThePageAsTheApiContractWritesIt() throws Exception {
    when(service.list(any(), any(), anyInt(), anyInt()))
        .thenReturn(new ProductPage<>(List.of(sampleSummary()), 30, 24, 24));

    mockMvc
        .perform(get(LIST_URL).param("offset", "24"))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.totalItems").value(30))
        .andExpect(jsonPath("$.offset").value(24))
        .andExpect(jsonPath("$.limit").value(24))
        .andExpect(jsonPath("$.items[0].id").value(ID.toString()))
        .andExpect(jsonPath("$.items[0].name").value("Áo khoác dạ"))
        .andExpect(jsonPath("$.items[0].slug").value("ao-khoac-da"))
        .andExpect(jsonPath("$.items[0].price").value(1_250_000))
        .andExpect(jsonPath("$.items[0].compareAtPrice").value(1_500_000))
        .andExpect(jsonPath("$.items[0].availability").value("OUT_OF_STOCK"));
  }

  @Test
  void list_returnsExactlyTheFieldsOfPageAndStoreProductSummary() throws Exception {
    when(service.list(any(), any(), anyInt(), anyInt()))
        .thenReturn(new ProductPage<>(List.of(sampleSummary()), 1, 0, 24));

    String body =
        mockMvc
            .perform(get(LIST_URL))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    JsonNode page = json.readTree(body);

    assertThat(fieldNames(page))
        .containsExactlyInAnyOrder("items", "totalItems", "offset", "limit");
    assertThat(fieldNames(page.get("items").get(0)))
        .containsExactlyInAnyOrder("id", "name", "slug", "price", "compareAtPrice", "availability");
  }

  @Test
  void list_withNoCompareAtPrice_writesItAsNull() throws Exception {
    when(service.list(any(), any(), anyInt(), anyInt()))
        .thenReturn(
            new ProductPage<>(
                List.of(
                    new StoreProductSummary(
                        ID, "Mũ len", "mu-len", 90_000L, null, ProductAvailability.IN_STOCK)),
                1,
                0,
                24));

    String body =
        mockMvc
            .perform(get(LIST_URL))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    JsonNode item = json.readTree(body).get("items").get(0);

    assertThat(item.has("compareAtPrice")).isTrue();
    assertThat(item.get("compareAtPrice").isNull()).isTrue();
  }

  // ============================================================
  // GET list: 400 INVALID_PARAMETER (NFR3)
  // ============================================================

  static Stream<Arguments> invalidListParameters() {
    return Stream.of(
        Arguments.of("offset", "-1", "negative"),
        Arguments.of("offset", "abc", "not a number"),
        Arguments.of("offset", "1.5", "a fraction"),
        Arguments.of("offset", "99999999999", "beyond an int"),
        Arguments.of("limit", "0", "below 1"),
        Arguments.of("limit", "101", "above 100"),
        Arguments.of("limit", "-5", "negative"),
        Arguments.of("limit", "abc", "not a number"),
        Arguments.of("sort", "WHATEVER", "not a sort"),
        Arguments.of("sort", "price-asc", "the form of the user URL"),
        Arguments.of("sort", "newest", "lower case"));
  }

  @ParameterizedTest(name = "{0}={1} ({2})")
  @MethodSource("invalidListParameters")
  void list_withAnInvalidParameter_returns400NamingIt(String name, String value, String label)
      throws Exception {
    mockMvc
        .perform(get(LIST_URL).param(name, value))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(400))
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.parameter").value(name))
        .andExpect(jsonPath("$.instance").value(LIST_URL))
        .andExpect(jsonPath("$.correlationId").exists())
        .andExpect(jsonPath("$.timestamp").exists());

    verifyNoInteractions(service);
  }

  @Test
  void list_withAnInvalidParameter_showsNoInternalDetail() throws Exception {
    String body =
        mockMvc
            .perform(get(LIST_URL).param("limit", "101"))
            .andExpect(status().isBadRequest())
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(body)
        .doesNotContain("Exception")
        .doesNotContain("com.tungph7")
        .doesNotContain("StoreProductController");
  }

  // ============================================================
  // GET sitemap: 200 (SHOP-32)
  // ============================================================

  @Test
  void sitemap_withNoParameter_startsAtTheFirstProductAThousandAtATime() throws Exception {
    when(service.sitemap(0, 1_000)).thenReturn(new ProductPage<>(List.of(), 0, 0, 1_000));

    mockMvc
        .perform(get(SITEMAP_URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items").isEmpty())
        .andExpect(jsonPath("$.totalItems").value(0))
        .andExpect(jsonPath("$.offset").value(0))
        .andExpect(jsonPath("$.limit").value(1_000));

    verify(service).sitemap(0, 1_000);
  }

  @Test
  void sitemap_passesTheOffsetAndTheLimitToTheService() throws Exception {
    when(service.sitemap(anyInt(), anyInt()))
        .thenReturn(new ProductPage<>(List.of(), 0, 2_000, 1_000));

    mockMvc
        .perform(get(SITEMAP_URL).param("offset", "2000").param("limit", "1000"))
        .andExpect(status().isOk());

    verify(service).sitemap(2_000, 1_000);
  }

  @Test
  void sitemap_withTheSmallestLimit_returns200() throws Exception {
    when(service.sitemap(anyInt(), anyInt())).thenReturn(new ProductPage<>(List.of(), 0, 0, 1));

    mockMvc.perform(get(SITEMAP_URL).param("limit", "1")).andExpect(status().isOk());

    verify(service).sitemap(0, 1);
  }

  @Test
  void sitemap_ignoresAStatusParameter() throws Exception {
    when(service.sitemap(anyInt(), anyInt())).thenReturn(new ProductPage<>(List.of(), 0, 0, 1_000));

    mockMvc.perform(get(SITEMAP_URL).param("status", "HIDDEN")).andExpect(status().isOk());

    verify(service).sitemap(0, 1_000);
  }

  @Test
  void sitemap_returnsThePageAsTheApiContractWritesIt() throws Exception {
    when(service.sitemap(anyInt(), anyInt()))
        .thenReturn(
            new ProductPage<>(
                List.of(new SitemapEntry("ao-thun-co-tron", Instant.parse("2026-11-16T02:15:30Z"))),
                1_001,
                1_000,
                1_000));

    mockMvc
        .perform(get(SITEMAP_URL).param("offset", "1000"))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.totalItems").value(1_001))
        .andExpect(jsonPath("$.offset").value(1_000))
        .andExpect(jsonPath("$.limit").value(1_000))
        .andExpect(jsonPath("$.items[0].slug").value("ao-thun-co-tron"))
        .andExpect(jsonPath("$.items[0].updatedAt").value("2026-11-16T02:15:30.000Z"));
  }

  @Test
  void sitemap_returnsExactlyTheFieldsOfPageAndSitemapEntry() throws Exception {
    when(service.sitemap(anyInt(), anyInt()))
        .thenReturn(
            new ProductPage<>(
                List.of(new SitemapEntry("ao-thun-co-tron", Instant.parse("2026-11-16T02:15:30Z"))),
                1,
                0,
                1_000));

    String body =
        mockMvc
            .perform(get(SITEMAP_URL))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    JsonNode page = json.readTree(body);

    assertThat(fieldNames(page))
        .containsExactlyInAnyOrder("items", "totalItems", "offset", "limit");
    assertThat(fieldNames(page.get("items").get(0))).containsExactlyInAnyOrder("slug", "updatedAt");
  }

  @Test
  void sitemap_postIsNotAllowed() throws Exception {
    mockMvc
        .perform(post(SITEMAP_URL).contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isMethodNotAllowed());
  }

  // ============================================================
  // GET sitemap: 400 INVALID_PARAMETER (NFR3)
  // ============================================================

  static Stream<Arguments> invalidSitemapParameters() {
    return Stream.of(
        Arguments.of("offset", "-1", "negative"),
        Arguments.of("offset", "abc", "not a number"),
        Arguments.of("offset", "1.5", "a fraction"),
        Arguments.of("offset", "99999999999", "beyond an int"),
        Arguments.of("limit", "0", "below 1"),
        Arguments.of("limit", "1001", "above 1000"),
        Arguments.of("limit", "-5", "negative"),
        Arguments.of("limit", "abc", "not a number"));
  }

  @ParameterizedTest(name = "{0}={1} ({2})")
  @MethodSource("invalidSitemapParameters")
  void sitemap_withAnInvalidParameter_returns400NamingIt(String name, String value, String label)
      throws Exception {
    mockMvc
        .perform(get(SITEMAP_URL).param(name, value))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(400))
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.parameter").value(name))
        .andExpect(jsonPath("$.instance").value(SITEMAP_URL))
        .andExpect(jsonPath("$.correlationId").exists())
        .andExpect(jsonPath("$.timestamp").exists());

    verifyNoInteractions(service);
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

  private static StoreProductSummary sampleSummary() {
    return new StoreProductSummary(
        ID, "Áo khoác dạ", "ao-khoac-da", 1_250_000L, 1_500_000L, ProductAvailability.OUT_OF_STOCK);
  }

  private static NotFoundException notFound() {
    return new NotFoundException(ErrorCode.PRODUCT_NOT_FOUND, "Product not found.");
  }

  private static Iterable<String> fieldNames(JsonNode node) {
    Iterator<String> names = node.propertyNames().iterator();
    return () -> names;
  }
}
