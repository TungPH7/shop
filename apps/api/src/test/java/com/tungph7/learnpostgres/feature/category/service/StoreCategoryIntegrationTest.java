package com.tungph7.learnpostgres.feature.category.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import javax.sql.DataSource;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * The store API of categories on the real database (Testcontainers PostgreSQL 17, schema V7),
 * SHOP-82 step 8: the links of AC17, a category without products on sale (AC15), the 404 of a
 * hidden, deleted or never-existing category, the same in each case (AC16, NFR8), and the sitemap
 * (AC19).
 */
@SpringBootTest
@AutoConfigureMockMvc
class StoreCategoryIntegrationTest extends AbstractContainerBaseTest {

  @Autowired MockMvc mockMvc;
  @Autowired ObjectMapper json;
  @Autowired DataSource dataSource;
  @Autowired PlatformTransactionManager transactionManager;

  private JdbcClient jdbc;
  private TransactionTemplate transaction;
  private int sequence;

  @BeforeEach
  void setUp() {
    jdbc = JdbcClient.create(dataSource);
    // The pool does not auto-commit, so each write of the test runs in a transaction of its own.
    transaction = new TransactionTemplate(transactionManager);
    deleteAll();
  }

  @AfterEach
  void cleanUp() {
    deleteAll();
  }

  // ============================================================
  // GET /api/categories (AC17)
  // ============================================================

  @Test
  void list_hasTheVisibleCategoriesWithAProductOnSale_inTheOrderOfNames() throws Exception {
    product("ACTIVE", category("Bao tay", "bao-tay", "VISIBLE"));
    product("ACTIVE", category("Áo khoác", "ao-khoac", "VISIBLE"));
    product("ACTIVE", category("Phụ kiện", "phu-kien", "HIDDEN"));
    product("HIDDEN", category("Đầm", "dam", "VISIBLE"));
    category("Quần", "quan", "VISIBLE");

    mockMvc
        .perform(get("/api/categories").param("status", "HIDDEN"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[*].name").value(contains("Áo khoác", "Bao tay")))
        .andExpect(jsonPath("$.items[*].slug").value(contains("ao-khoac", "bao-tay")));
  }

  // ============================================================
  // GET and HEAD /api/categories/{slug} (AC15, AC16, NFR8)
  // ============================================================

  @Test
  void get_ofAVisibleCategoryWithoutProductOnSale_returnsIt() throws Exception {
    UUID phuKien = category("Phụ kiện", "phu-kien", "VISIBLE");
    product("HIDDEN", phuKien);

    mockMvc
        .perform(get("/api/categories/phu-kien"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Phụ kiện"))
        .andExpect(jsonPath("$.slug").value("phu-kien"));
    mockMvc.perform(head("/api/categories/phu-kien")).andExpect(status().isOk());
  }

  @Test
  void get_withTheSlugInUpperCase_returnsTheStoredSlug() throws Exception {
    category("Áo", "ao", "VISIBLE");

    mockMvc
        .perform(get("/api/categories/AO"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.slug").value("ao"));
    mockMvc.perform(head("/api/categories/AO")).andExpect(status().isOk());
  }

  @Test
  void get_ofAHiddenADeletedAndAnUnknownCategory_answersTheSame404() throws Exception {
    product("ACTIVE", category("Phụ kiện", "an-di", "HIDDEN"));
    UUID deleted = category("Đã xóa", "da-xoa", "VISIBLE");
    transaction.executeWithoutResult(
        tx -> jdbc.sql("DELETE FROM app.categories WHERE id = ?").param(deleted).update());

    ObjectNode hidden = notFoundBody("/api/categories/an-di?status=HIDDEN");
    ObjectNode gone = notFoundBody("/api/categories/da-xoa");
    ObjectNode unknown = notFoundBody("/api/categories/chua-tung-co");

    assertThat(hidden).isEqualTo(unknown).isEqualTo(gone);
    assertThat(hidden.get("code").asString()).isEqualTo("CATEGORY_NOT_FOUND");
    assertThat(hidden.get("detail").asString()).isEqualTo("Category not found.");
    for (String slug : List.of("an-di", "da-xoa", "chua-tung-co")) {
      mockMvc
          .perform(head("/api/categories/" + slug))
          .andExpect(status().isNotFound())
          .andExpect(content().string(""));
    }
  }

  // ============================================================
  // GET /api/sitemap/categories (AC19)
  // ============================================================

  @Test
  void sitemap_hasTheVisibleCategoriesWithAProductOnSale_withTheLaterUpdate() throws Exception {
    UUID ao = category("Áo", "ao", "VISIBLE");
    UUID quan = category("Quần", "quan", "VISIBLE");
    setUpdatedAt("app.categories", ao, "2026-11-20T08:00:00Z");
    setUpdatedAt("app.categories", quan, "2026-11-21T09:30:00Z");
    setUpdatedAt("app.products", product("ACTIVE", ao), "2026-11-21T08:00:00.123456Z");
    setUpdatedAt("app.products", product("HIDDEN", ao), "2026-11-22T08:00:00Z");
    setUpdatedAt("app.products", product("ACTIVE", quan), "2026-11-19T08:00:00Z");
    product("ACTIVE", category("Phụ kiện", "phu-kien", "HIDDEN"));
    product("HIDDEN", category("Đầm", "dam", "VISIBLE"));
    UUID deleted = category("Đã xóa", "da-xoa", "VISIBLE");
    product("ACTIVE", deleted);
    transaction.executeWithoutResult(
        tx -> jdbc.sql("DELETE FROM app.categories WHERE id = ?").param(deleted).update());

    mockMvc
        .perform(get("/api/sitemap/categories"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[*].slug").value(contains(ordered(ao, quan, "ao", "quan"))))
        .andExpect(
            jsonPath("$.items[?(@.slug == 'ao')].updatedAt")
                .value(contains("2026-11-21T08:00:00.123Z")))
        .andExpect(
            jsonPath("$.items[?(@.slug == 'quan')].updatedAt")
                .value(contains("2026-11-21T09:30:00.000Z")));
  }

  // ============================================================
  // Helpers
  // ============================================================

  /** The body of a 404, without the three members that differ between requests (NFR8). */
  private ObjectNode notFoundBody(String url) throws Exception {
    String body =
        mockMvc
            .perform(get(url))
            .andExpect(status().isNotFound())
            .andReturn()
            .getResponse()
            .getContentAsString();
    ObjectNode node = (ObjectNode) json.readTree(body);
    node.remove(List.of("instance", "timestamp", "correlationId"));
    return node;
  }

  /** The two slugs in the order of the ids of their categories, as the sitemap lists them. */
  private static String[] ordered(UUID first, UUID second, String firstSlug, String secondSlug) {
    return first.compareTo(second) < 0
        ? new String[] {firstSlug, secondSlug}
        : new String[] {secondSlug, firstSlug};
  }

  private UUID category(String name, String slug, String status) {
    return transaction.execute(
        tx ->
            jdbc.sql(
                    "INSERT INTO app.categories (name, slug, status) VALUES (?, ?, ?) RETURNING id")
                .params(name, slug, status)
                .query(UUID.class)
                .single());
  }

  private UUID product(String status, UUID categoryId) {
    sequence++;
    String slug = "san-pham-" + sequence;
    return transaction.execute(
        tx ->
            jdbc.sql(
                    "INSERT INTO app.products (name, slug, price_vnd, status, category_id)"
                        + " VALUES ('Sản phẩm', ?, 200000, ?, ?) RETURNING id")
                .params(slug, status, categoryId)
                .query(UUID.class)
                .single());
  }

  /**
   * Sets {@code updated_at} with the trigger of the table off, as the trigger would overwrite it.
   */
  private void setUpdatedAt(String table, UUID id, String instant) {
    String trigger =
        table.equals("app.products")
            ? "trg_products_set_updated_at"
            : "trg_categories_set_updated_at";
    transaction.executeWithoutResult(
        tx -> {
          jdbc.sql("ALTER TABLE " + table + " DISABLE TRIGGER " + trigger).update();
          jdbc.sql("UPDATE " + table + " SET updated_at = ? WHERE id = ?")
              .params(java.sql.Timestamp.from(Instant.parse(instant)), id)
              .update();
          jdbc.sql("ALTER TABLE " + table + " ENABLE TRIGGER " + trigger).update();
        });
  }

  private void deleteAll() {
    transaction.executeWithoutResult(
        tx -> {
          jdbc.sql("DELETE FROM app.products").update();
          jdbc.sql("DELETE FROM app.categories").update();
        });
  }
}
