package com.tungph7.learnpostgres.feature.category.controller;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.tungph7.learnpostgres.common.error.ConflictException;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.error.GlobalExceptionHandler;
import com.tungph7.learnpostgres.common.error.NotFoundException;
import com.tungph7.learnpostgres.common.error.ProblemDetailFactory;
import com.tungph7.learnpostgres.common.logging.LoggingProperties;
import com.tungph7.learnpostgres.common.security.TestSecurityConfig;
import com.tungph7.learnpostgres.feature.category.domain.Category;
import com.tungph7.learnpostgres.feature.category.domain.Category.CategoryStatus;
import com.tungph7.learnpostgres.feature.category.dto.AdminCategory;
import com.tungph7.learnpostgres.feature.category.dto.UpdateCategoryRequest;
import com.tungph7.learnpostgres.feature.category.service.AdminCategoryService;

/**
 * {@code GET}, {@code PUT} and {@code DELETE /api/admin/categories/{id}} at the HTTP boundary
 * (SHOP-82, step 6): the 404, the 409s of NFR12 and AC4, the Category Rules of AC3 on an edit, and
 * the idempotent delete. The service is a mock; {@code AdminCategoryEditIntegrationTest} runs it on
 * the database.
 */
@WebMvcTest(AdminCategoryController.class)
@Import({TestSecurityConfig.class, GlobalExceptionHandler.class, ProblemDetailFactory.class})
@EnableConfigurationProperties(LoggingProperties.class)
class AdminCategoryEditWebMvcTest {

  private static final String URL = "/api/admin/categories/";
  private static final UUID ID = UUID.fromString("019a9c41-2b3d-7e10-8f2a-3c4d5e6f7a8b");
  private static final String VALID_BODY =
      "{\"name\":\"Áo nam\",\"slug\":\"ao\",\"status\":\"VISIBLE\",\"version\":3}";

  @Autowired MockMvc mockMvc;

  @MockitoBean AdminCategoryService service;

  // ============================================================
  // GET
  // ============================================================

  @Test
  void get_returnsTheCategoryWithItsVersion() throws Exception {
    when(service.get(ID)).thenReturn(sample(3));

    mockMvc
        .perform(get(URL + ID))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(ID.toString()))
        .andExpect(jsonPath("$.name").value("Áo nam"))
        .andExpect(jsonPath("$.slug").value("ao"))
        .andExpect(jsonPath("$.status").value("HIDDEN"))
        .andExpect(jsonPath("$.displayOrder").value(7))
        .andExpect(jsonPath("$.version").value(3));
  }

  @Test
  void get_ofAnUnknownId_returns404CategoryNotFound() throws Exception {
    when(service.get(ID))
        .thenThrow(new NotFoundException(ErrorCode.CATEGORY_NOT_FOUND, "Category not found."));

    mockMvc
        .perform(get(URL + ID))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.code").value("CATEGORY_NOT_FOUND"))
        .andExpect(jsonPath("$.detail").value("Category not found."));
  }

  @Test
  void get_ofAnIdThatIsNotAUuid_returns400InvalidParameter() throws Exception {
    mockMvc
        .perform(get(URL + "abc"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.parameter").value("id"));
  }

  // ============================================================
  // PUT
  // ============================================================

  @Test
  void update_withValidBody_returns200WithTheNewVersion() throws Exception {
    when(service.update(eq(ID), any(UpdateCategoryRequest.class))).thenReturn(sample(4));

    put(VALID_BODY).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(4));

    verify(service)
        .update(ID, new UpdateCategoryRequest("Áo nam", "ao", CategoryStatus.VISIBLE, null, 3L));
  }

  // ------------------------------------------------------------
  // The display order (SHOP-95: AC2, AC4, NFR7, NFR12)
  // ------------------------------------------------------------

  @Test
  void update_withoutDisplayOrder_passesNull_soTheServiceKeepsTheStoredNumber() throws Exception {
    when(service.update(eq(ID), any(UpdateCategoryRequest.class))).thenReturn(sample(4));

    put(VALID_BODY).andExpect(status().isOk()).andExpect(jsonPath("$.displayOrder").value(7));

    verify(service)
        .update(ID, new UpdateCategoryRequest("Áo nam", "ao", CategoryStatus.VISIBLE, null, 3L));
  }

  @ParameterizedTest(name = "displayOrder {0}")
  @ValueSource(strings = {"0", "7", "9999", "null"})
  void update_passesAValidOrNullDisplayOrderAsSent(String displayOrder) throws Exception {
    when(service.update(eq(ID), any(UpdateCategoryRequest.class))).thenReturn(sample(4));

    put(withDisplayOrder(displayOrder)).andExpect(status().isOk());

    verify(service)
        .update(
            ID,
            new UpdateCategoryRequest(
                "Áo nam",
                "ao",
                CategoryStatus.VISIBLE,
                "null".equals(displayOrder) ? null : new BigDecimal(displayOrder),
                3L));
  }

  @ParameterizedTest(name = "AC4 displayOrder {0}")
  @CsvSource({
    "-1, must be at least 0",
    "10000, must be at most 9999",
    "1.5, must be a whole number",
    "99999999999, must be at most 9999"
  })
  void update_withAWrongDisplayOrder_returns400OnItNextToTheBlankName(
      String displayOrder, String message) throws Exception {
    put(withDisplayOrder(displayOrder).replace("\"Áo nam\"", "\" \""))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.errors", hasSize(2)))
        .andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("name", "displayOrder")))
        .andExpect(jsonPath("$.errors[?(@.field == 'displayOrder')].message").value(message));

    verify(service, never()).update(any(), any());
  }

  @ParameterizedTest(name = "AC4 displayOrder {0}")
  @ValueSource(strings = {"\"abc\"", "true", "[1]", "{}"})
  void update_withADisplayOrderThatIsNotANumber_returns400MalformedRequest(String displayOrder)
      throws Exception {
    put(withDisplayOrder(displayOrder))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));

    verify(service, never()).update(any(), any());
  }

  @Test
  void update_withEveryFieldMissing_listsEachFieldInOneResponse() throws Exception {
    put("{}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(
            jsonPath("$.errors[*].field", containsInAnyOrder("name", "slug", "status", "version")));

    verify(service, never()).update(any(), any());
  }

  @Test
  void update_withABlankName_returns400OnTheName() throws Exception {
    putWithName("\"\u00a0  \"")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors", hasSize(1)))
        .andExpect(jsonPath("$.errors[0].field").value("name"))
        .andExpect(jsonPath("$.errors[0].message").value("must not be blank"));
  }

  @Test
  void update_withANameOf61Characters_returns400OnTheName() throws Exception {
    putWithName("\"" + "a".repeat(61) + "\"")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors", hasSize(1)))
        .andExpect(jsonPath("$.errors[0].field").value("name"))
        .andExpect(jsonPath("$.errors[0].message").value("must be at most 60 characters"));
  }

  @ParameterizedTest(name = "slug {0}")
  @ValueSource(strings = {"AO", "áo", "ao nam", "-ao"})
  void update_withASlugOutOfTheFormat_returns400OnTheSlug(String slug) throws Exception {
    put("{\"name\":\"Áo\",\"slug\":\"" + slug + "\",\"status\":\"VISIBLE\",\"version\":3}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors", hasSize(1)))
        .andExpect(jsonPath("$.errors[0].field").value("slug"));

    verify(service, never()).update(any(), any());
  }

  @Test
  void update_withABlankSlug_saysItMustNotBeBlank() throws Exception {
    put("{\"name\":\"Áo\",\"slug\":\"\",\"status\":\"VISIBLE\",\"version\":3}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[0].field").value("slug"))
        .andExpect(jsonPath("$.errors[0].message").value("must not be blank"));
  }

  @Test
  void update_ofAnUnknownCategory_returns404() throws Exception {
    when(service.update(eq(ID), any(UpdateCategoryRequest.class)))
        .thenThrow(new NotFoundException(ErrorCode.CATEGORY_NOT_FOUND, "Category not found."));

    put(VALID_BODY)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("CATEGORY_NOT_FOUND"));
  }

  @Test
  void update_withAnOldVersion_returns409OptimisticLockConflict() throws Exception {
    when(service.update(eq(ID), any(UpdateCategoryRequest.class)))
        .thenThrow(
            new ConflictException(
                ErrorCode.OPTIMISTIC_LOCK_CONFLICT,
                "Category was modified by another request. Reload it and retry."));

    put(VALID_BODY)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));
  }

  @Test
  void update_whenHibernateFindsTheVersionChanged_returns409OptimisticLockConflict()
      throws Exception {
    when(service.update(eq(ID), any(UpdateCategoryRequest.class)))
        .thenThrow(new ObjectOptimisticLockingFailureException(Category.class, ID));

    put(VALID_BODY)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));
  }

  @ParameterizedTest(name = "{0}")
  @CsvSource({
    "CATEGORY_NAME_DUPLICATED, Category name already exists.",
    "CATEGORY_SLUG_DUPLICATED, Category slug already exists."
  })
  void update_whenTheServiceFindsADuplicate_returns409WithItsCode(ErrorCode code, String detail)
      throws Exception {
    when(service.update(eq(ID), any(UpdateCategoryRequest.class)))
        .thenThrow(new ConflictException(code, detail));

    put(VALID_BODY)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value(code.name()));
  }

  // ============================================================
  // DELETE (NFR12)
  // ============================================================

  @Test
  void delete_twiceInARow_returns204BothTimes() throws Exception {
    mockMvc.perform(delete(URL + ID)).andExpect(status().isNoContent());
    mockMvc.perform(delete(URL + ID)).andExpect(status().isNoContent());

    verify(service, times(2)).delete(ID);
  }

  @Test
  void delete_ofAnIdThatIsNotAUuid_returns400InvalidParameter() throws Exception {
    mockMvc
        .perform(delete(URL + "abc"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));

    verify(service, never()).delete(any());
  }

  @Test
  void delete_whenTheServiceFails_isNotA204() throws Exception {
    doThrow(new IllegalStateException("database down")).when(service).delete(ID);

    mockMvc.perform(delete(URL + ID)).andExpect(status().isInternalServerError());
  }

  // ============================================================
  // Helpers
  // ============================================================

  /** {@link #VALID_BODY} with this display order, as JSON. */
  private static String withDisplayOrder(String displayOrderJson) {
    return VALID_BODY.replace(
        ",\"version\":3}", ",\"displayOrder\":" + displayOrderJson + ",\"version\":3}");
  }

  private ResultActions putWithName(String nameJson) throws Exception {
    return put("{\"name\":" + nameJson + ",\"slug\":\"ao\",\"status\":\"VISIBLE\",\"version\":3}");
  }

  private ResultActions put(String body) throws Exception {
    return mockMvc.perform(
        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(URL + ID)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  private static AdminCategory sample(long version) {
    return new AdminCategory(
        ID,
        "Áo nam",
        "ao",
        CategoryStatus.HIDDEN,
        7,
        Instant.parse("2026-11-22T02:10:00Z"),
        Instant.parse("2026-11-22T02:15:30Z"),
        version);
  }
}
