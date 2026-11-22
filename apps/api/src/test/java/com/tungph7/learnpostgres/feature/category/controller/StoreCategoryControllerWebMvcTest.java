package com.tungph7.learnpostgres.feature.category.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

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
import com.tungph7.learnpostgres.feature.category.dto.CategorySitemapEntry;
import com.tungph7.learnpostgres.feature.category.dto.ItemList;
import com.tungph7.learnpostgres.feature.category.dto.StoreCategory;
import com.tungph7.learnpostgres.feature.category.service.StoreCategoryService;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * The store API of categories at the HTTP boundary (SHOP-82, step 8; plan of SHOP-81, API
 * Contract): the fields a shopper gets and nothing more (NFR8), the 404 of {@code GET} and {@code
 * HEAD}, and the methods the store has. The service is a mock; {@code StoreCategoryIntegrationTest}
 * runs it on the database, with the three kinds of 404.
 */
@WebMvcTest(StoreCategoryController.class)
@Import({TestSecurityConfig.class, GlobalExceptionHandler.class, ProblemDetailFactory.class})
@EnableConfigurationProperties(LoggingProperties.class)
class StoreCategoryControllerWebMvcTest {

  @Autowired MockMvc mockMvc;
  @Autowired ObjectMapper json;

  @MockitoBean StoreCategoryService service;

  // ============================================================
  // GET /api/categories
  // ============================================================

  @Test
  void list_returnsTheNameAndSlugOfEachCategoryAndNothingMore() throws Exception {
    when(service.list())
        .thenReturn(
            new ItemList<>(
                List.of(
                    new StoreCategory("Áo khoác", "ao-khoac"),
                    new StoreCategory("Bao tay", "bao-tay"))));

    String body =
        mockMvc
            .perform(get("/api/categories"))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.items", hasSize(2)))
            .andExpect(jsonPath("$.items[0].name").value("Áo khoác"))
            .andExpect(jsonPath("$.items[1].slug").value("bao-tay"))
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(fieldNames(json.readTree(body))).containsExactly("items");
    assertThat(fieldNames(json.readTree(body).get("items").get(0)))
        .containsExactlyInAnyOrder("name", "slug");
  }

  // ============================================================
  // GET and HEAD /api/categories/{slug}
  // ============================================================

  @Test
  void get_ofAVisibleCategory_returnsItsNameAndStoredSlugOnly() throws Exception {
    when(service.get("AO")).thenReturn(new StoreCategory("Áo", "ao"));

    String body =
        mockMvc
            .perform(get("/api/categories/AO"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Áo"))
            .andExpect(jsonPath("$.slug").value("ao"))
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(fieldNames(json.readTree(body))).containsExactlyInAnyOrder("name", "slug");
  }

  @Test
  void get_ofAnUnknownSlug_returns404CategoryNotFound() throws Exception {
    when(service.get("khong-co"))
        .thenThrow(new NotFoundException(ErrorCode.CATEGORY_NOT_FOUND, "Category not found."));

    mockMvc
        .perform(get("/api/categories/khong-co"))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.code").value("CATEGORY_NOT_FOUND"))
        .andExpect(jsonPath("$.title").value("Category not found"))
        .andExpect(jsonPath("$.detail").value("Category not found."));
  }

  @Test
  void head_ofAVisibleCategory_returns200WithoutBody() throws Exception {
    when(service.isVisible("ao")).thenReturn(true);

    mockMvc
        .perform(head("/api/categories/ao"))
        .andExpect(status().isOk())
        .andExpect(content().string(""));
  }

  @Test
  void head_ofACategoryAShopperCannotSee_returns404WithoutBody() throws Exception {
    when(service.isVisible("an")).thenReturn(false);

    mockMvc
        .perform(head("/api/categories/an"))
        .andExpect(status().isNotFound())
        .andExpect(content().string(""));
  }

  @Test
  void post_isNotAMethodOfTheStore() throws Exception {
    mockMvc
        .perform(post("/api/categories").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isMethodNotAllowed());
  }

  // ============================================================
  // GET /api/sitemap/categories
  // ============================================================

  @Test
  void sitemap_returnsTheSlugAndLastUpdateOfEachCategory() throws Exception {
    when(service.sitemap())
        .thenReturn(
            new ItemList<>(
                List.of(new CategorySitemapEntry("ao", Instant.parse("2026-11-21T08:00:00Z")))));

    String body =
        mockMvc
            .perform(get("/api/sitemap/categories"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].slug").value("ao"))
            .andExpect(jsonPath("$.items[0].updatedAt").value("2026-11-21T08:00:00.000Z"))
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(fieldNames(json.readTree(body).get("items").get(0)))
        .containsExactlyInAnyOrder("slug", "updatedAt");
  }

  private static List<String> fieldNames(JsonNode node) {
    List<String> names = new ArrayList<>();
    node.propertyNames().forEach(names::add);
    return names;
  }
}
