package com.tungph7.learnpostgres.feature.category.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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

import com.tungph7.learnpostgres.common.error.ConflictException;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.error.GlobalExceptionHandler;
import com.tungph7.learnpostgres.common.error.ProblemDetailFactory;
import com.tungph7.learnpostgres.common.logging.LoggingProperties;
import com.tungph7.learnpostgres.common.security.TestSecurityConfig;
import com.tungph7.learnpostgres.feature.category.domain.Category.CategoryStatus;
import com.tungph7.learnpostgres.feature.category.dto.AdminCategory;
import com.tungph7.learnpostgres.feature.category.dto.AdminCategoryListItem;
import com.tungph7.learnpostgres.feature.category.dto.CreateCategoryRequest;
import com.tungph7.learnpostgres.feature.category.dto.ItemList;
import com.tungph7.learnpostgres.feature.category.service.AdminCategoryService;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * {@code GET} and {@code POST /api/admin/categories} at the HTTP boundary (SHOP-82, step 5): the
 * Category Rules of AC3, the 409s of AC4 and the field names of the API Contract of the plan of
 * SHOP-81. The service is a mock: the slugs and names run against the database in {@code
 * AdminCategoryServiceIntegrationTest}.
 */
@WebMvcTest(AdminCategoryController.class)
@Import({TestSecurityConfig.class, GlobalExceptionHandler.class, ProblemDetailFactory.class})
@EnableConfigurationProperties(LoggingProperties.class)
class AdminCategoryControllerWebMvcTest {

  private static final String URL = "/api/admin/categories";
  private static final UUID ID = UUID.fromString("019a9c41-2b3d-7e10-8f2a-3c4d5e6f7a8b");

  @Autowired MockMvc mockMvc;
  @Autowired ObjectMapper json;

  @MockitoBean AdminCategoryService service;

  // ============================================================
  // POST: 201 Created
  // ============================================================

  @Test
  void create_withValidBody_returns201WithLocationAndTheCategory() throws Exception {
    when(service.create(any(CreateCategoryRequest.class))).thenReturn(sample());

    post("{\"name\":\"Áo khoác\"}")
        .andExpect(status().isCreated())
        .andExpect(header().string("Location", URL + "/" + ID))
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.id").value(ID.toString()))
        .andExpect(jsonPath("$.name").value("Áo khoác"))
        .andExpect(jsonPath("$.slug").value("ao-khoac"))
        .andExpect(jsonPath("$.status").value("VISIBLE"))
        .andExpect(jsonPath("$.displayOrder").value(5))
        .andExpect(jsonPath("$.createdAt").value("2026-11-22T02:10:00.000Z"))
        .andExpect(jsonPath("$.updatedAt").value("2026-11-22T02:15:30.000Z"))
        .andExpect(jsonPath("$.version").value(0));
  }

  @Test
  void create_returnsExactlyTheFieldsOfAdminCategory() throws Exception {
    when(service.create(any(CreateCategoryRequest.class))).thenReturn(sample());

    String body = post("{\"name\":\"Áo khoác\"}").andReturn().getResponse().getContentAsString();

    assertThat(fieldNames(json.readTree(body)))
        .containsExactlyInAnyOrder(
            "id", "name", "slug", "status", "displayOrder", "createdAt", "updatedAt", "version");
  }

  @Test
  void create_trimsTheNameAndPassesTheSlugAndStatusAsSent() throws Exception {
    when(service.create(any(CreateCategoryRequest.class))).thenReturn(sample());

    post("{\"name\":\"\\u00a0 Áo khoác \\t\",\"slug\":\"ao-khoac\",\"status\":\"HIDDEN\"}")
        .andExpect(status().isCreated());

    ArgumentCaptor<CreateCategoryRequest> sent =
        ArgumentCaptor.forClass(CreateCategoryRequest.class);
    verify(service).create(sent.capture());
    assertThat(sent.getValue())
        .isEqualTo(new CreateCategoryRequest("Áo khoác", "ao-khoac", CategoryStatus.HIDDEN));
  }

  @Test
  void create_withoutSlugOrStatus_passesNullForTheServiceToFillIn() throws Exception {
    when(service.create(any(CreateCategoryRequest.class))).thenReturn(sample());

    post("{\"name\":\"Áo khoác\",\"slug\":null}").andExpect(status().isCreated());

    verify(service).create(new CreateCategoryRequest("Áo khoác", null, null));
  }

  @Test
  void create_withANameOf60Characters_isValid() throws Exception {
    when(service.create(any(CreateCategoryRequest.class))).thenReturn(sample());

    post("{\"name\":\"" + "Á".repeat(60) + "\"}").andExpect(status().isCreated());
  }

  // ============================================================
  // POST: 400 of AC3
  // ============================================================

  @ParameterizedTest(name = "name {0}")
  @ValueSource(strings = {"\"\"", "\"   \"", "\"\\u00a0\\u2003\"", "null"})
  void create_withABlankName_returns400OnTheName(String name) throws Exception {
    post("{\"name\":" + name + "}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.errors", hasSize(1)))
        .andExpect(jsonPath("$.errors[0].field").value("name"))
        .andExpect(jsonPath("$.errors[0].message").value("must not be blank"));

    verify(service, never()).create(any());
  }

  @Test
  void create_withANameOf61Characters_returns400OnTheName() throws Exception {
    post("{\"name\":\"" + "a".repeat(61) + "\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[0].field").value("name"))
        .andExpect(jsonPath("$.errors[0].message").value("must be at most 60 characters"));
  }

  @ParameterizedTest(name = "slug {0}")
  @ValueSource(strings = {"Ao-thun", "áo-thun", "ao thun", "-ao-thun", "ao-thun-", "ao--thun", ""})
  void create_withASlugOutOfTheFormat_returns400OnTheSlug(String slug) throws Exception {
    post("{\"name\":\"Áo thun\",\"slug\":\"" + slug + "\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors", hasSize(1)))
        .andExpect(jsonPath("$.errors[0].field").value("slug"))
        .andExpect(jsonPath("$.errors[0].rejectedValue").value(slug))
        .andExpect(
            jsonPath("$.errors[0].message")
                .value(
                    "must be lowercase letters a-z and digits, in words joined by single hyphens"));

    verify(service, never()).create(any());
  }

  @Test
  void create_withASlugOf101Characters_returns400SayingItIsTooLong() throws Exception {
    post("{\"name\":\"Áo thun\",\"slug\":\"" + "a".repeat(101) + "\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[0].field").value("slug"))
        .andExpect(jsonPath("$.errors[0].message").value("must be at most 100 characters"));
  }

  @Test
  void create_withEveryFieldWrong_listsEachFieldInOneResponse() throws Exception {
    post("{\"name\":\"   \",\"slug\":\"-Áo thun\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.detail").value("Validation failed for 2 field(s)."))
        .andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("name", "slug")));

    verify(service, never()).create(any());
  }

  @Test
  void create_withAnUnknownStatus_returns400() throws Exception {
    post("{\"name\":\"Áo thun\",\"status\":\"DELETED\"}").andExpect(status().isBadRequest());

    verify(service, never()).create(any());
  }

  // ============================================================
  // POST: 409 of AC4
  // ============================================================

  @ParameterizedTest(name = "{0}")
  @CsvSource({
    "CATEGORY_NAME_DUPLICATED, Category name already exists.",
    "CATEGORY_SLUG_DUPLICATED, Category slug already exists."
  })
  void create_whenTheServiceFindsADuplicate_returns409WithItsCode(ErrorCode code, String detail)
      throws Exception {
    when(service.create(any(CreateCategoryRequest.class)))
        .thenThrow(new ConflictException(code, detail));

    post("{\"name\":\"Áo Thun\"}")
        .andExpect(status().isConflict())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.code").value(code.name()))
        .andExpect(jsonPath("$.detail").value(detail));
  }

  // ============================================================
  // GET
  // ============================================================

  @Test
  void list_returnsEveryCategoryWithTheFieldsOfTheApiContract() throws Exception {
    when(service.list())
        .thenReturn(
            new ItemList<>(
                List.of(
                    new AdminCategoryListItem(
                        ID,
                        "Áo khoác",
                        "ao-khoac",
                        CategoryStatus.VISIBLE,
                        4,
                        3,
                        Instant.parse("2026-11-22T02:10:00Z"),
                        Instant.parse("2026-11-22T02:15:30Z"),
                        0))));

    String body =
        mockMvc
            .perform(get(URL))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items", hasSize(1)))
            .andExpect(jsonPath("$.items[0].id").value(ID.toString()))
            .andExpect(jsonPath("$.items[0].name").value("Áo khoác"))
            .andExpect(jsonPath("$.items[0].slug").value("ao-khoac"))
            .andExpect(jsonPath("$.items[0].status").value("VISIBLE"))
            .andExpect(jsonPath("$.items[0].displayOrder").value(4))
            .andExpect(jsonPath("$.items[0].productCount").value(3))
            .andExpect(jsonPath("$.items[0].createdAt").value("2026-11-22T02:10:00.000Z"))
            .andExpect(jsonPath("$.items[0].updatedAt").value("2026-11-22T02:15:30.000Z"))
            .andExpect(jsonPath("$.items[0].version").value(0))
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(fieldNames(json.readTree(body))).containsExactly("items");
    assertThat(fieldNames(json.readTree(body).get("items").get(0)))
        .containsExactlyInAnyOrder(
            "id",
            "name",
            "slug",
            "status",
            "displayOrder",
            "productCount",
            "createdAt",
            "updatedAt",
            "version");
  }

  @Test
  void list_withNoCategory_returnsAnEmptyList() throws Exception {
    when(service.list()).thenReturn(new ItemList<>(List.of()));

    mockMvc.perform(get(URL)).andExpect(status().isOk()).andExpect(jsonPath("$.items", hasSize(0)));
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

  private static AdminCategory sample() {
    return new AdminCategory(
        ID,
        "Áo khoác",
        "ao-khoac",
        CategoryStatus.VISIBLE,
        5,
        Instant.parse("2026-11-22T02:10:00Z"),
        Instant.parse("2026-11-22T02:15:30Z"),
        0);
  }

  private static List<String> fieldNames(JsonNode node) {
    List<String> names = new ArrayList<>();
    node.propertyNames().forEach(names::add);
    return names;
  }
}
