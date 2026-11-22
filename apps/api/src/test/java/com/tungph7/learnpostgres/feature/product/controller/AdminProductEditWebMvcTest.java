package com.tungph7.learnpostgres.feature.product.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Iterator;
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
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import com.tungph7.learnpostgres.common.error.ConflictException;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.error.GlobalExceptionHandler;
import com.tungph7.learnpostgres.common.error.NotFoundException;
import com.tungph7.learnpostgres.common.error.ProblemDetailFactory;
import com.tungph7.learnpostgres.common.logging.LoggingProperties;
import com.tungph7.learnpostgres.common.security.TestSecurityConfig;
import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.dto.AdminProduct;
import com.tungph7.learnpostgres.feature.product.dto.UpdateProductRequest;
import com.tungph7.learnpostgres.feature.product.service.AdminProductService;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * {@code GET} and {@code PUT /api/admin/products/{id}} at the HTTP boundary (SHOP-35, US3): the
 * fields of {@code AdminProduct}, the Bean Validation of {@code UpdateProductInput}, and the
 * Problem Details of the 400, 404 and 409 of the API Contract of the plan of SHOP-7. The service is
 * a mock: the slug and version rules run against the database in {@code
 * AdminProductEditIntegrationTest}.
 */
@WebMvcTest(AdminProductController.class)
@Import({TestSecurityConfig.class, GlobalExceptionHandler.class, ProblemDetailFactory.class})
@EnableConfigurationProperties(LoggingProperties.class)
class AdminProductEditWebMvcTest {

  private static final String URL = "/api/admin/products";
  private static final UUID ID = UUID.fromString("019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f");

  @Autowired MockMvc mockMvc;
  @Autowired ObjectMapper json;

  @MockitoBean AdminProductService service;

  // ============================================================
  // GET /{id}
  // ============================================================

  @Test
  void get_ofAProduct_returns200WithExactlyTheFieldsOfAdminProduct() throws Exception {
    when(service.get(ID)).thenReturn(sampleProduct(ProductStatus.HIDDEN, 3L));

    String body =
        mockMvc
            .perform(get(URL + "/" + ID))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.id").value(ID.toString()))
            .andExpect(jsonPath("$.name").value("Áo thun cổ tròn"))
            .andExpect(jsonPath("$.slug").value("ao-thun-co-tron"))
            .andExpect(jsonPath("$.description").value("Áo thun cotton 100%."))
            .andExpect(jsonPath("$.price").value(200000))
            .andExpect(jsonPath("$.compareAtPrice").value(250000))
            .andExpect(jsonPath("$.status").value("HIDDEN"))
            .andExpect(jsonPath("$.availability").value("IN_STOCK"))
            .andExpect(jsonPath("$.createdAt").value("2026-11-16T02:10:00.000Z"))
            .andExpect(jsonPath("$.updatedAt").value("2026-11-16T02:15:30.000Z"))
            .andExpect(jsonPath("$.version").value(3))
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
            "version",
            "categoryId");
  }

  @Test
  void get_ofAnUnknownId_returns404ProductNotFound() throws Exception {
    when(service.get(ID))
        .thenThrow(new NotFoundException(ErrorCode.PRODUCT_NOT_FOUND, "Product not found."));

    mockMvc
        .perform(get(URL + "/" + ID))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(404))
        .andExpect(jsonPath("$.code").value("PRODUCT_NOT_FOUND"))
        .andExpect(jsonPath("$.instance").value(URL + "/" + ID));
  }

  @Test
  void get_withAnIdThatIsNotAUuid_returns400InvalidParameterNamingIt() throws Exception {
    mockMvc
        .perform(get(URL + "/not-a-uuid"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.parameter").value("id"));

    verify(service, never()).get(any());
  }

  // ============================================================
  // PUT /{id}: 200
  // ============================================================

  @Test
  void update_withAValidBody_returns200WithTheNewVersion() throws Exception {
    when(service.update(eq(ID), any(UpdateProductRequest.class)))
        .thenReturn(sampleProduct(ProductStatus.ACTIVE, 2L));

    putBody(body("Áo thun cổ tròn", "ao-thun-co-tron", "200000", "250000", 1))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.id").value(ID.toString()))
        .andExpect(jsonPath("$.version").value(2));
  }

  @Test
  void update_passesEveryFieldToTheService() throws Exception {
    when(service.update(eq(ID), any(UpdateProductRequest.class)))
        .thenReturn(sampleProduct(ProductStatus.HIDDEN, 5L));

    putBody(
            """
            {"name":"  Áo thun basic  ","slug":"ao-thun-basic","description":" \\n ",\
            "price":200000,"compareAtPrice":null,"status":"HIDDEN",\
            "availability":"OUT_OF_STOCK","version":4}""")
        .andExpect(status().isOk());

    ArgumentCaptor<UpdateProductRequest> request =
        ArgumentCaptor.forClass(UpdateProductRequest.class);
    verify(service).update(eq(ID), request.capture());
    UpdateProductRequest sent = request.getValue();
    assertThat(sent.name()).isEqualTo("Áo thun basic");
    assertThat(sent.slug()).isEqualTo("ao-thun-basic");
    assertThat(sent.description()).isNull();
    assertThat(sent.price()).isEqualByComparingTo(new BigDecimal("200000"));
    assertThat(sent.compareAtPrice()).isNull();
    assertThat(sent.status()).isEqualTo(ProductStatus.HIDDEN);
    assertThat(sent.availability()).isEqualTo(ProductAvailability.OUT_OF_STOCK);
    assertThat(sent.version()).isEqualTo(4L);
  }

  /**
   * The format of the slug is not a constraint of the body (NFR16): a product of before the Epic
   * keeps a slug out of the format, and the service only checks the format of a slug that differs
   * from the stored one.
   */
  @Test
  void update_withASlugOutOfTheFormat_passesItToTheService() throws Exception {
    when(service.update(eq(ID), any(UpdateProductRequest.class)))
        .thenReturn(sampleProduct(ProductStatus.ACTIVE, 2L));

    putBody(body("Áo thun", "-ao--thun-", "200000", null, 1)).andExpect(status().isOk());

    ArgumentCaptor<UpdateProductRequest> request =
        ArgumentCaptor.forClass(UpdateProductRequest.class);
    verify(service).update(eq(ID), request.capture());
    assertThat(request.getValue().slug()).isEqualTo("-ao--thun-");
  }

  // ============================================================
  // PUT /{id}: 400 VALIDATION_FAILED
  // ============================================================

  static Stream<Arguments> invalidBodies() {
    return Stream.of(
        Arguments.of("name empty", body("", "a", "1", null, 1), "name"),
        Arguments.of("name of 151 characters", body("x".repeat(151), "a", "1", null, 1), "name"),
        Arguments.of(
            "slug missing",
            "{\"name\":\"A\",\"price\":1,\"status\":\"ACTIVE\",\"availability\":\"IN_STOCK\","
                + "\"version\":1}",
            "slug"),
        Arguments.of("slug empty", body("A", "", "1", null, 1), "slug"),
        Arguments.of(
            "price 0, as a product of before the Epic", body("A", "a", "0", null, 1), "price"),
        Arguments.of("price 1000000000", body("A", "a", "1000000000", null, 1), "price"),
        Arguments.of("price with a fraction", body("A", "a", "450000.5", null, 1), "price"),
        Arguments.of(
            "price missing",
            "{\"name\":\"A\",\"slug\":\"a\",\"status\":\"ACTIVE\",\"availability\":\"IN_STOCK\","
                + "\"version\":1}",
            "price"),
        Arguments.of(
            "compareAtPrice equal to price",
            body("A", "a", "200000", "200000", 1),
            "compareAtPrice"),
        Arguments.of(
            "compareAtPrice 1000000000",
            body("A", "a", "200000", "1000000000", 1),
            "compareAtPrice"),
        Arguments.of(
            "description of 5001 characters",
            "{\"name\":\"A\",\"slug\":\"a\",\"description\":\""
                + "d".repeat(5001)
                + "\",\"price\":1,\"status\":\"ACTIVE\",\"availability\":\"IN_STOCK\","
                + "\"version\":1}",
            "description"),
        Arguments.of(
            "status missing",
            "{\"name\":\"A\",\"slug\":\"a\",\"price\":1,\"availability\":\"IN_STOCK\","
                + "\"version\":1}",
            "status"),
        Arguments.of(
            "availability missing",
            "{\"name\":\"A\",\"slug\":\"a\",\"price\":1,\"status\":\"ACTIVE\",\"version\":1}",
            "availability"),
        Arguments.of(
            "version missing",
            "{\"name\":\"A\",\"slug\":\"a\",\"price\":1,\"status\":\"ACTIVE\","
                + "\"availability\":\"IN_STOCK\"}",
            "version"));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("invalidBodies")
  void update_withAnInvalidField_returns400OnThatFieldAndSavesNothing(
      String label, String body, String field) throws Exception {
    putBody(body)
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.instance").value(URL + "/" + ID))
        .andExpect(jsonPath("$.errors[*].field").value(hasItem(field)))
        .andExpect(jsonPath("$.errors[*].field").value(everyItem(is(field))))
        .andExpect(jsonPath("$.errors[0].message").isNotEmpty());

    verify(service, never()).update(any(), any());
  }

  @Test
  void update_withSeveralInvalidFields_listsEachInOneResponse() throws Exception {
    putBody(
            "{\"name\":\"\",\"slug\":\"a\",\"price\":0,\"status\":\"ACTIVE\","
                + "\"availability\":\"IN_STOCK\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors", hasSize(3)))
        .andExpect(jsonPath("$.errors[*].field").value(hasItems("name", "price", "version")));
  }

  @Test
  void update_whenTheServiceRejectsAChangedSlug_returns400OnTheSlug() throws Exception {
    when(service.update(eq(ID), any(UpdateProductRequest.class)))
        .thenThrow(AdminProductService.invalidSlug("Ao--thun", "must be in the slug format"));

    putBody(body("A", "Ao--thun", "1", null, 1))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.detail").value("Validation failed for 1 field(s)."))
        .andExpect(jsonPath("$.errors", hasSize(1)))
        .andExpect(jsonPath("$.errors[0].field").value("slug"))
        .andExpect(jsonPath("$.errors[0].rejectedValue").value("Ao--thun"))
        .andExpect(jsonPath("$.errors[0].message").value("must be in the slug format"));
  }

  // ============================================================
  // PUT /{id}: 404 and 409
  // ============================================================

  @Test
  void update_ofAnUnknownId_returns404ProductNotFound() throws Exception {
    when(service.update(eq(ID), any(UpdateProductRequest.class)))
        .thenThrow(new NotFoundException(ErrorCode.PRODUCT_NOT_FOUND, "Product not found."));

    putBody(body("A", "a", "1", null, 1))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("PRODUCT_NOT_FOUND"));
  }

  @Test
  void update_withAnIdThatIsNotAUuid_returns400InvalidParameter() throws Exception {
    mockMvc
        .perform(
            MockMvcRequestBuilders.put(URL + "/123")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("A", "a", "1", null, 1)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.parameter").value("id"));

    verify(service, never()).update(any(), any());
  }

  @Test
  void update_withAVersionOtherThanTheStoredOne_returns409OptimisticLockConflict()
      throws Exception {
    when(service.update(eq(ID), any(UpdateProductRequest.class)))
        .thenThrow(
            new ConflictException(
                ErrorCode.OPTIMISTIC_LOCK_CONFLICT, "Product was modified by another request."));

    putBody(body("A", "a", "1", null, 1))
        .andExpect(status().isConflict())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(409))
        .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));
  }

  @Test
  void update_whenHibernateFindsTheRowChangedAtTheWrite_returns409OptimisticLockConflict()
      throws Exception {
    when(service.update(eq(ID), any(UpdateProductRequest.class)))
        .thenThrow(new ObjectOptimisticLockingFailureException(Product.class, ID));

    putBody(body("A", "a", "1", null, 1))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));
  }

  @Test
  void update_withASlugTakenByAnotherProduct_returns409SlugDuplicated() throws Exception {
    when(service.update(eq(ID), any(UpdateProductRequest.class)))
        .thenThrow(
            new ConflictException(
                ErrorCode.PRODUCT_SLUG_DUPLICATED, "Product slug already exists."));

    putBody(body("A", "ao-thun-basic", "1", null, 1))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("PRODUCT_SLUG_DUPLICATED"));
  }

  // ============================================================
  // Helpers
  // ============================================================

  private ResultActions putBody(String body) throws Exception {
    return mockMvc.perform(
        MockMvcRequestBuilders.put(URL + "/" + ID)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  /** A full {@code UpdateProductInput}, ACTIVE and IN_STOCK; prices are JSON numbers. */
  private static String body(
      String name, String slug, String price, String compareAtPrice, long version) {
    return "{\"name\":\"%s\",\"slug\":\"%s\",\"description\":null,\"price\":%s,"
            .formatted(name, slug, price)
        + "\"compareAtPrice\":%s,\"status\":\"ACTIVE\",\"availability\":\"IN_STOCK\","
            .formatted(compareAtPrice)
        + "\"version\":%d}".formatted(version);
  }

  private static AdminProduct sampleProduct(ProductStatus status, long version) {
    return new AdminProduct(
        ID,
        "Áo thun cổ tròn",
        "ao-thun-co-tron",
        "Áo thun cotton 100%.",
        200_000L,
        250_000L,
        status,
        ProductAvailability.IN_STOCK,
        Instant.parse("2026-11-16T02:10:00Z"),
        Instant.parse("2026-11-16T02:15:30Z"),
        version,
        null);
  }

  private static Iterable<String> fieldNames(JsonNode node) {
    Iterator<String> names = node.propertyNames().iterator();
    return () -> names;
  }
}
