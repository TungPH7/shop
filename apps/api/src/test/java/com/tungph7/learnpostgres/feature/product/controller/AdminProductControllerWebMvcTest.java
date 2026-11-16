package com.tungph7.learnpostgres.feature.product.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.in;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.tungph7.learnpostgres.common.error.ConflictException;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.error.GlobalExceptionHandler;
import com.tungph7.learnpostgres.common.error.ProblemDetailFactory;
import com.tungph7.learnpostgres.common.logging.LoggingProperties;
import com.tungph7.learnpostgres.common.security.TestSecurityConfig;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.dto.AdminProduct;
import com.tungph7.learnpostgres.feature.product.dto.CreateProductRequest;
import com.tungph7.learnpostgres.feature.product.service.AdminProductService;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * {@code POST /api/admin/products} at the HTTP boundary (SHOP-15): the validation of the Product
 * Rules (AC6, AC7), the 409 of a typed slug already taken (AC8) and the field names of the API
 * Contract of the plan of SHOP-7. The service is a mock: the slug rules run against the database in
 * {@code AdminProductServiceIntegrationTest}.
 */
@WebMvcTest(AdminProductController.class)
@Import({TestSecurityConfig.class, GlobalExceptionHandler.class, ProblemDetailFactory.class})
@EnableConfigurationProperties(LoggingProperties.class)
class AdminProductControllerWebMvcTest {

  private static final String URL = "/api/admin/products";
  private static final UUID ID = UUID.fromString("019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f");

  @Autowired MockMvc mockMvc;
  @Autowired ObjectMapper json;

  @MockitoBean AdminProductService service;

  // ============================================================
  // 201 Created
  // ============================================================

  @Test
  void create_withValidBody_returns201WithLocationAndTheProduct() throws Exception {
    when(service.create(any(CreateProductRequest.class))).thenReturn(sampleProduct());

    post("{\"name\":\"Áo thun cổ tròn\",\"price\":200000,\"compareAtPrice\":250000}")
        .andExpect(status().isCreated())
        .andExpect(header().string("Location", URL + "/" + ID))
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.id").value(ID.toString()))
        .andExpect(jsonPath("$.name").value("Áo thun cổ tròn"))
        .andExpect(jsonPath("$.slug").value("ao-thun-co-tron"))
        .andExpect(jsonPath("$.description").value("Áo thun cotton 100%.\nCổ tròn, tay ngắn."))
        .andExpect(jsonPath("$.price").value(200000))
        .andExpect(jsonPath("$.compareAtPrice").value(250000))
        .andExpect(jsonPath("$.status").value("ACTIVE"))
        .andExpect(jsonPath("$.availability").value("IN_STOCK"))
        .andExpect(jsonPath("$.createdAt").value("2026-11-16T02:10:00Z"))
        .andExpect(jsonPath("$.updatedAt").value("2026-11-16T02:15:30Z"))
        .andExpect(jsonPath("$.version").value(1));
  }

  @Test
  void create_returnsExactlyTheFieldsOfAdminProduct() throws Exception {
    when(service.create(any(CreateProductRequest.class))).thenReturn(sampleProduct());

    String body =
        post("{\"name\":\"Áo thun cổ tròn\",\"price\":200000}")
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(fieldNames(json.readTree(body)))
        .containsExactlyInAnyOrder(
            "id",
            "name",
            "slug",
            "description",
            "price",
            "compareAtPrice",
            "status",
            "availability",
            "createdAt",
            "updatedAt",
            "version");
  }

  @Test
  void create_withNullDescriptionAndCompareAtPrice_returnsThemAsNull() throws Exception {
    when(service.create(any(CreateProductRequest.class)))
        .thenReturn(
            new AdminProduct(
                ID,
                "Quần jean nam",
                "quan-jean-nam",
                null,
                450_000L,
                null,
                ProductStatus.ACTIVE,
                ProductAvailability.IN_STOCK,
                Instant.parse("2026-11-16T02:10:00Z"),
                Instant.parse("2026-11-16T02:10:00Z"),
                0L));

    post("{\"name\":\"Quần jean nam\",\"price\":450000}")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.description").isEmpty())
        .andExpect(jsonPath("$.compareAtPrice").isEmpty());
  }

  @Test
  void create_passesTheNameStrippedAndABlankDescriptionAsNull() throws Exception {
    when(service.create(any(CreateProductRequest.class))).thenReturn(sampleProduct());

    post("{\"name\":\"  Áo thun  \",\"description\":\" \\n \",\"price\":200000}")
        .andExpect(status().isCreated());

    ArgumentCaptor<CreateProductRequest> request =
        ArgumentCaptor.forClass(CreateProductRequest.class);
    verify(service).create(request.capture());
    assertThat(request.getValue().name()).isEqualTo("Áo thun");
    assertThat(request.getValue().description()).isNull();
    assertThat(request.getValue().slug()).isNull();
    assertThat(request.getValue().price()).isEqualByComparingTo(new BigDecimal("200000"));
  }

  @Test
  void create_keepsADescriptionVerbatim() throws Exception {
    when(service.create(any(CreateProductRequest.class))).thenReturn(sampleProduct());

    post("{\"name\":\"Đầm\",\"description\":\"  Kích thước < 5 cm\\n\",\"price\":1}")
        .andExpect(status().isCreated());

    ArgumentCaptor<CreateProductRequest> request =
        ArgumentCaptor.forClass(CreateProductRequest.class);
    verify(service).create(request.capture());
    assertThat(request.getValue().description()).isEqualTo("  Kích thước < 5 cm\n");
  }

  static Stream<Arguments> valuesAtTheLimits() {
    return Stream.of(
        Arguments.of("name of 150 characters", body("x".repeat(150), null, null, "1", null)),
        Arguments.of(
            "name of 150 characters once stripped",
            body("  " + "x".repeat(150) + "  ", null, null, "1", null)),
        Arguments.of("slug of 100 characters", body("A", "a".repeat(100), null, "1", null)),
        Arguments.of("slug with digits and hyphens", body("A", "combo-3-ao", null, "1", null)),
        Arguments.of(
            "description of 5000 characters", body("A", null, "d".repeat(5000), "1", null)),
        Arguments.of("price 999999999", body("A", null, null, "999999999", null)),
        Arguments.of("compareAtPrice 999999999", body("A", null, null, "1", "999999999")),
        Arguments.of("compareAtPrice one above price", body("A", null, null, "200000", "200001")),
        Arguments.of(
            "status and availability",
            "{\"name\":\"A\",\"price\":1,\"status\":\"HIDDEN\",\"availability\":\"OUT_OF_STOCK\"}"));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("valuesAtTheLimits")
  void create_withAValueAtTheLimit_returns201(String label, String body) throws Exception {
    when(service.create(any(CreateProductRequest.class))).thenReturn(sampleProduct());

    post(body).andExpect(status().isCreated());
  }

  // ============================================================
  // 400 VALIDATION_FAILED: each invalid value of AC6 (AC7)
  // ============================================================

  static Stream<Arguments> invalidValues() {
    return Stream.of(
        Arguments.of("name missing", "{\"price\":1}", "name"),
        Arguments.of("name empty", body("", null, null, "1", null), "name"),
        Arguments.of("name of spaces", body("   ", null, null, "1", null), "name"),
        Arguments.of(
            "name of 151 characters", body("x".repeat(151), null, null, "1", null), "name"),
        Arguments.of("slug with upper case", body("A", "Ao-thun", null, "1", null), "slug"),
        Arguments.of("slug with accents", body("A", "áo-thun", null, "1", null), "slug"),
        Arguments.of("slug with a space", body("A", "ao thun", null, "1", null), "slug"),
        Arguments.of("slug with double hyphen", body("A", "ao--thun", null, "1", null), "slug"),
        Arguments.of("slug ending with a hyphen", body("A", "ao-thun-", null, "1", null), "slug"),
        Arguments.of("slug empty", body("A", "", null, "1", null), "slug"),
        Arguments.of("slug of 101 characters", body("A", "a".repeat(101), null, "1", null), "slug"),
        Arguments.of(
            "description of 5001 characters",
            body("A", null, "d".repeat(5001), "1", null),
            "description"),
        Arguments.of("price missing", "{\"name\":\"A\"}", "price"),
        Arguments.of("price 0", body("A", null, null, "0", null), "price"),
        Arguments.of("price negative", body("A", null, null, "-1", null), "price"),
        Arguments.of("price with a fraction", body("A", null, null, "450000.5", null), "price"),
        Arguments.of("price 1000000000", body("A", null, null, "1000000000", null), "price"),
        Arguments.of(
            "compareAtPrice equal to price",
            body("A", null, null, "200000", "200000"),
            "compareAtPrice"),
        Arguments.of(
            "compareAtPrice below price",
            body("A", null, null, "200000", "199999"),
            "compareAtPrice"),
        Arguments.of(
            "compareAtPrice with a fraction",
            body("A", null, null, "200000", "250000.5"),
            "compareAtPrice"),
        Arguments.of(
            "compareAtPrice 1000000000",
            body("A", null, null, "200000", "1000000000"),
            "compareAtPrice"));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("invalidValues")
  void create_withAnInvalidValue_returns400OnThatFieldAndSavesNothing(
      String label, String body, String field) throws Exception {
    post(body)
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(400))
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.instance").value(URL))
        .andExpect(jsonPath("$.correlationId").exists())
        .andExpect(jsonPath("$.timestamp").exists())
        .andExpect(jsonPath("$.errors[*].field").value(hasItem(field)))
        .andExpect(jsonPath("$.errors[*].field").value(everyItem(is(field))))
        .andExpect(jsonPath("$.errors[0].message").isNotEmpty());

    verify(service, never()).create(any());
  }

  @Test
  void create_withEveryFieldInvalid_listsEachFieldInOneResponse() throws Exception {
    String body =
        "{\"name\":\"\",\"slug\":\"Ao Thun\",\"description\":\""
            + "d".repeat(5001)
            + "\",\"price\":450000.5,\"compareAtPrice\":1000000000}";

    post(body)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(
            jsonPath("$.errors[*].field")
                .value(hasItems("name", "slug", "description", "price", "compareAtPrice")))
        .andExpect(
            jsonPath("$.errors[*].field")
                .value(
                    everyItem(
                        is(
                            in(
                                List.of(
                                    "name", "slug", "description", "price", "compareAtPrice"))))));

    verify(service, never()).create(any());
  }

  @Test
  void create_withAFractionalPrice_echoesTheValueSent() throws Exception {
    post(body("A", null, null, "450000.5", null))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors", hasSize(1)))
        .andExpect(jsonPath("$.errors[0].field").value("price"))
        .andExpect(jsonPath("$.errors[0].rejectedValue").value(450000.5));
  }

  @Test
  void create_withCompareAtPriceNotAbovePrice_echoesTheCompareAtPrice() throws Exception {
    post(body("A", null, null, "200000", "150000"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors", hasSize(1)))
        .andExpect(jsonPath("$.errors[0].field").value("compareAtPrice"))
        .andExpect(jsonPath("$.errors[0].rejectedValue").value(150000))
        .andExpect(jsonPath("$.errors[0].message").value("must be greater than price"));
  }

  // ============================================================
  // 409 PRODUCT_SLUG_DUPLICATED (AC8)
  // ============================================================

  @Test
  void create_withATypedSlugAlreadyTaken_returns409() throws Exception {
    when(service.create(any(CreateProductRequest.class)))
        .thenThrow(
            new ConflictException(
                ErrorCode.PRODUCT_SLUG_DUPLICATED, "Product slug already exists."));

    post(body("Áo thun cổ tròn", "ao-thun-co-tron", null, "200000", null))
        .andExpect(status().isConflict())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(409))
        .andExpect(jsonPath("$.code").value("PRODUCT_SLUG_DUPLICATED"))
        .andExpect(jsonPath("$.detail").value("Product slug already exists."))
        .andExpect(jsonPath("$.instance").value(URL));
  }

  // ============================================================
  // Helpers
  // ============================================================

  private ResultActions post(String body) throws Exception {
    return mockMvc.perform(
        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  /** A JSON body; {@code null} leaves the field out, prices are written as JSON numbers. */
  private static String body(
      String name, String slug, String description, String price, String compareAtPrice) {
    StringBuilder sb = new StringBuilder("{");
    sb.append("\"name\":\"").append(name).append('"');
    if (slug != null) {
      sb.append(",\"slug\":\"").append(slug).append('"');
    }
    if (description != null) {
      sb.append(",\"description\":\"").append(description).append('"');
    }
    sb.append(",\"price\":").append(price);
    if (compareAtPrice != null) {
      sb.append(",\"compareAtPrice\":").append(compareAtPrice);
    }
    return sb.append('}').toString();
  }

  private static AdminProduct sampleProduct() {
    return new AdminProduct(
        ID,
        "Áo thun cổ tròn",
        "ao-thun-co-tron",
        "Áo thun cotton 100%.\nCổ tròn, tay ngắn.",
        200_000L,
        250_000L,
        ProductStatus.ACTIVE,
        ProductAvailability.IN_STOCK,
        Instant.parse("2026-11-16T02:10:00Z"),
        Instant.parse("2026-11-16T02:15:30Z"),
        1L);
  }

  private static Iterable<String> fieldNames(JsonNode node) {
    Iterator<String> names = node.propertyNames().iterator();
    return () -> names;
  }
}
