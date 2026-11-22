package com.tungph7.learnpostgres.feature.product.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import com.tungph7.learnpostgres.common.error.BadRequestException;
import com.tungph7.learnpostgres.common.error.GlobalExceptionHandler;
import com.tungph7.learnpostgres.common.error.ProblemDetailFactory;
import com.tungph7.learnpostgres.common.logging.LoggingProperties;
import com.tungph7.learnpostgres.common.security.TestSecurityConfig;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.dto.AdminProduct;
import com.tungph7.learnpostgres.feature.product.dto.CategoryIdField;
import com.tungph7.learnpostgres.feature.product.dto.CreateProductRequest;
import com.tungph7.learnpostgres.feature.product.dto.UpdateProductRequest;
import com.tungph7.learnpostgres.feature.product.service.AdminProductService;

/**
 * {@code categoryId} in the admin API of products at the HTTP boundary (SHOP-82, step 7; plan of
 * SHOP-81, Architecture Decisions 7, NFR19): the four cases of the edit, absent, {@code null}, a
 * UUID and anything else, the add, and the read. The service is a mock; {@code
 * AdminProductCategoryIntegrationTest} runs it on the database.
 */
@WebMvcTest(AdminProductController.class)
@Import({TestSecurityConfig.class, GlobalExceptionHandler.class, ProblemDetailFactory.class})
@EnableConfigurationProperties(LoggingProperties.class)
class AdminProductCategoryWebMvcTest {

  private static final String URL = "/api/admin/products";
  private static final UUID ID = UUID.fromString("019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f");
  private static final String CATEGORY = "019a9c41-2b3d-7e10-8f2a-3c4d5e6f7a8b";

  /** The body of the edit form of SHOP-7, which knows no category. */
  private static final String FIELDS_OF_V030 =
      "\"name\":\"Áo thun\",\"slug\":\"ao-thun\",\"price\":200000,\"status\":\"ACTIVE\","
          + "\"availability\":\"IN_STOCK\",\"version\":1";

  @Autowired MockMvc mockMvc;

  @MockitoBean AdminProductService service;

  // ============================================================
  // PUT: the four cases of Architecture Decisions 7
  // ============================================================

  @Test
  void update_withoutCategoryId_asksToKeepTheCategory() throws Exception {
    when(service.update(eq(ID), any())).thenReturn(sample(UUID.fromString(CATEGORY)));

    put("{" + FIELDS_OF_V030 + "}").andExpect(status().isOk());

    assertCategoryIdSent(CategoryIdField.ABSENT);
  }

  @Test
  void update_withCategoryIdNull_asksToClearTheCategory() throws Exception {
    when(service.update(eq(ID), any())).thenReturn(sample(null));

    put("{" + FIELDS_OF_V030 + ",\"categoryId\":null}").andExpect(status().isOk());

    assertCategoryIdSent(CategoryIdField.NULL);
  }

  @Test
  void update_withAUuid_asksForThatCategory() throws Exception {
    when(service.update(eq(ID), any())).thenReturn(sample(UUID.fromString(CATEGORY)));

    put("{" + FIELDS_OF_V030 + ",\"categoryId\":\"" + CATEGORY + "\"}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.categoryId").value(CATEGORY));

    assertCategoryIdSent(CategoryIdField.of(CATEGORY));
  }

  @ParameterizedTest(name = "categoryId {0}")
  @ValueSource(strings = {"\"abc\"", "\"\"", "\"019a9c41-2b3d-7e10-8f2a\"", "123", "true", "{}"})
  void update_withAnythingElse_returns400OnTheFieldCategoryId(String value) throws Exception {
    put("{" + FIELDS_OF_V030 + ",\"categoryId\":" + value + "}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.errors", hasSize(1)))
        .andExpect(jsonPath("$.errors[0].field").value("categoryId"))
        .andExpect(jsonPath("$.errors[0].message").value("must be a UUID"));

    verify(service, never()).update(any(), any());
  }

  @Test
  void update_withAbc_rejectsTheValueSent() throws Exception {
    put("{" + FIELDS_OF_V030 + ",\"categoryId\":\"abc\"}")
        .andExpect(jsonPath("$.errors[0].rejectedValue").value("abc"));
  }

  @Test
  void update_withACategoryThatIsGone_returnsThe400OfTheApiContract() throws Exception {
    when(service.update(eq(ID), any()))
        .thenThrow(
            BadRequestException.ofField(
                "categoryId", CATEGORY, "must be an existing category", null));

    put("{" + FIELDS_OF_V030 + ",\"categoryId\":\"" + CATEGORY + "\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.detail").value("Validation failed for 1 field(s)."))
        .andExpect(jsonPath("$.errors[0].field").value("categoryId"))
        .andExpect(jsonPath("$.errors[0].rejectedValue").value(CATEGORY))
        .andExpect(jsonPath("$.errors[0].message").value("must be an existing category"));
  }

  // ============================================================
  // POST
  // ============================================================

  @Test
  void create_withoutCategoryIdOrWithNull_asksForNoCategory() throws Exception {
    when(service.create(any())).thenReturn(sample(null));

    post("{\"name\":\"Áo thun\",\"price\":200000}").andExpect(status().isCreated());
    post("{\"name\":\"Áo thun\",\"price\":200000,\"categoryId\":null}")
        .andExpect(status().isCreated());

    ArgumentCaptor<CreateProductRequest> sent = ArgumentCaptor.forClass(CreateProductRequest.class);
    verify(service, times(2)).create(sent.capture());
    assertThat(sent.getAllValues())
        .extracting(CreateProductRequest::categoryId)
        .containsOnlyNulls();
  }

  @Test
  void create_withAUuid_passesIt() throws Exception {
    when(service.create(any())).thenReturn(sample(UUID.fromString(CATEGORY)));

    post("{\"name\":\"Áo thun\",\"price\":200000,\"categoryId\":\"" + CATEGORY + "\"}")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.categoryId").value(CATEGORY));

    ArgumentCaptor<CreateProductRequest> sent = ArgumentCaptor.forClass(CreateProductRequest.class);
    verify(service).create(sent.capture());
    assertThat(sent.getValue().categoryId()).isEqualTo(CATEGORY);
  }

  @Test
  void create_withAbc_returns400OnTheFieldCategoryId() throws Exception {
    post("{\"name\":\"Áo thun\",\"price\":200000,\"categoryId\":\"abc\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors", hasSize(1)))
        .andExpect(jsonPath("$.errors[0].field").value("categoryId"))
        .andExpect(jsonPath("$.errors[0].rejectedValue").value("abc"))
        .andExpect(jsonPath("$.errors[0].message").value("must be a UUID"));

    verify(service, never()).create(any());
  }

  // ============================================================
  // GET
  // ============================================================

  @Test
  void get_returnsCategoryIdAlsoWhenNull() throws Exception {
    when(service.get(ID)).thenReturn(sample(null));

    mockMvc
        .perform(get(URL + "/" + ID))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.categoryId").isEmpty())
        .andExpect(jsonPath("$", hasKey("categoryId")));
  }

  // ============================================================
  // Helpers
  // ============================================================

  private void assertCategoryIdSent(CategoryIdField expected) {
    ArgumentCaptor<UpdateProductRequest> sent = ArgumentCaptor.forClass(UpdateProductRequest.class);
    verify(service).update(eq(ID), sent.capture());
    assertThat(sent.getValue().categoryId()).isEqualTo(expected);
  }

  private ResultActions put(String body) throws Exception {
    return mockMvc.perform(
        MockMvcRequestBuilders.put(URL + "/" + ID)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  private ResultActions post(String body) throws Exception {
    return mockMvc.perform(
        MockMvcRequestBuilders.post(URL).contentType(MediaType.APPLICATION_JSON).content(body));
  }

  private static AdminProduct sample(UUID categoryId) {
    return new AdminProduct(
        ID,
        "Áo thun",
        "ao-thun",
        null,
        200_000L,
        null,
        ProductStatus.ACTIVE,
        ProductAvailability.IN_STOCK,
        Instant.parse("2026-11-22T02:10:00Z"),
        Instant.parse("2026-11-22T02:15:30Z"),
        2L,
        categoryId);
  }
}
