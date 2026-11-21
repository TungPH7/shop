package com.tungph7.learnpostgres.feature.product.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
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
 * The products of a category and the category of the store detail of a product, on the real
 * database (Testcontainers PostgreSQL 17, schema V7), SHOP-82 step 9: only the {@code ACTIVE}
 * products of a {@code VISIBLE} category (AC12), the order and its ties (AC13, NFR17), the total
 * (AC14), the 404 of a category a shopper cannot see (NFR8), {@code RELEVANCE} refused (NFR3), and
 * the category of the detail, {@code null} for a hidden one (AC20, AC21, NFR8).
 */
@SpringBootTest
@AutoConfigureMockMvc
class StoreCategoryProductsIntegrationTest extends AbstractContainerBaseTest {

  private static final Instant T0 = Instant.parse("2026-11-20T02:00:00Z");

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
  // GET /api/categories/{slug}/products
  // ============================================================

  @Test
  void listOfCategory_hasOnlyTheActiveProductsOfTheCategory_newestFirst() throws Exception {
    UUID ao = category("Áo", "ao", "VISIBLE");
    UUID quan = category("Quần", "quan", "VISIBLE");
    product("Áo thun cổ tròn", 200_000, "ACTIVE", ao, 1);
    product("Áo len", 300_000, "ACTIVE", ao, 2);
    product("Áo lụa", 400_000, "HIDDEN", ao, 3);
    product("Quần jean nam", 450_000, "ACTIVE", quan, 4);
    product("Khăn", 100_000, "ACTIVE", null, 5);

    mockMvc
        .perform(get("/api/categories/ao/products"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[*].name").value(contains("Áo len", "Áo thun cổ tròn")))
        .andExpect(jsonPath("$.totalItems").value(2))
        .andExpect(jsonPath("$.limit").value(24));
  }

  @Test
  void listOfCategory_withTheSlugInUpperCase_findsTheCategory() throws Exception {
    product("Áo len", 300_000, "ACTIVE", category("Áo", "ao", "VISIBLE"), 1);

    mockMvc
        .perform(get("/api/categories/AO/products"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalItems").value(1));
  }

  @Test
  void listOfCategory_sortsByPriceWithTheNewerFirstOnTies_andTheIdLast() throws Exception {
    UUID ao = category("Áo", "ao", "VISIBLE");
    UUID cheapOld = product("Rẻ cũ", 100_000, "ACTIVE", ao, 1);
    UUID cheapNew = product("Rẻ mới", 100_000, "ACTIVE", ao, 2);
    UUID dear = product("Đắt", 900_000, "ACTIVE", ao, 3);
    UUID sameA = product("Cùng lúc A", 500_000, "ACTIVE", ao, 4);
    UUID sameB = product("Cùng lúc B", 500_000, "ACTIVE", ao, 4);
    String[] sameDesc = idDesc(sameA, sameB);

    mockMvc
        .perform(get("/api/categories/ao/products").param("sort", "PRICE_ASC"))
        .andExpect(
            jsonPath("$.items[*].id")
                .value(
                    contains(
                        cheapNew.toString(),
                        cheapOld.toString(),
                        sameDesc[0],
                        sameDesc[1],
                        dear.toString())));
    mockMvc
        .perform(get("/api/categories/ao/products").param("sort", "PRICE_DESC"))
        .andExpect(
            jsonPath("$.items[*].id")
                .value(
                    contains(
                        dear.toString(),
                        sameDesc[0],
                        sameDesc[1],
                        cheapNew.toString(),
                        cheapOld.toString())));
    mockMvc
        .perform(get("/api/categories/ao/products").param("sort", "NEWEST"))
        .andExpect(
            jsonPath("$.items[*].id")
                .value(
                    contains(
                        sameDesc[0],
                        sameDesc[1],
                        dear.toString(),
                        cheapNew.toString(),
                        cheapOld.toString())));
  }

  @Test
  void listOfCategory_pagesWithTheTotalOfTheCategory() throws Exception {
    UUID ao = category("Áo", "ao", "VISIBLE");
    for (int i = 1; i <= 30; i++) {
      product("Áo " + i, 100_000 + i, "ACTIVE", ao, i);
    }

    mockMvc
        .perform(get("/api/categories/ao/products").param("offset", "24").param("limit", "24"))
        .andExpect(jsonPath("$.items.length()").value(6))
        .andExpect(jsonPath("$.totalItems").value(30))
        .andExpect(jsonPath("$.offset").value(24));
  }

  @Test
  void listOfCategory_withRelevance_returns400NamingSort() throws Exception {
    category("Áo", "ao", "VISIBLE");

    mockMvc
        .perform(get("/api/categories/ao/products").param("sort", "RELEVANCE"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.parameter").value("sort"));
  }

  @Test
  void listOfCategory_ofAHiddenADeletedOrAnUnknownCategory_answersThe404OfTheCategory()
      throws Exception {
    product("Khăn lụa", 150_000, "ACTIVE", category("Phụ kiện", "an-di", "HIDDEN"), 1);
    UUID deleted = category("Đã xóa", "da-xoa", "VISIBLE");
    transaction.executeWithoutResult(
        tx -> jdbc.sql("DELETE FROM app.categories WHERE id = ?").param(deleted).update());

    ObjectNode ofTheCategory = notFoundBody("/api/categories/chua-tung-co");
    for (String slug : List.of("an-di", "da-xoa", "chua-tung-co")) {
      assertThat(notFoundBody("/api/categories/" + slug + "/products?status=HIDDEN"))
          .as(slug)
          .isEqualTo(ofTheCategory);
    }
  }

  // ============================================================
  // GET /api/products/{slug}: the category (AC20, AC21, NFR8)
  // ============================================================

  @Test
  void get_ofAProductInAVisibleCategory_hasTheCategory() throws Exception {
    product("Áo thun cổ tròn", 200_000, "ACTIVE", category("Áo", "ao", "VISIBLE"), 1);

    mockMvc
        .perform(get("/api/products/san-pham-2"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Áo thun cổ tròn"))
        .andExpect(jsonPath("$.price").value(200_000))
        .andExpect(jsonPath("$.category.name").value("Áo"))
        .andExpect(jsonPath("$.category.slug").value("ao"));
  }

  @Test
  void get_ofAProductInAHiddenCategory_isTheSameAsWithoutCategory() throws Exception {
    UUID phuKien = category("Phụ kiện", "phu-kien", "HIDDEN");
    UUID product = product("Khăn lụa", 150_000, "ACTIVE", phuKien, 1);

    ObjectNode inAHiddenCategory = detailWithoutUpdatedAt("/api/products/san-pham-2");
    transaction.executeWithoutResult(
        tx ->
            jdbc.sql("UPDATE app.products SET category_id = NULL WHERE id = ?")
                .param(product)
                .update());
    ObjectNode withoutCategory = detailWithoutUpdatedAt("/api/products/san-pham-2");

    assertThat(inAHiddenCategory).isEqualTo(withoutCategory);
    assertThat(inAHiddenCategory.get("category").isNull()).isTrue();
    assertThat(inAHiddenCategory.toString()).doesNotContain("Phụ kiện").doesNotContain("phu-kien");
  }

  @Test
  void get_ofAHiddenProductInAVisibleCategory_isStillA404() throws Exception {
    product("Áo lụa", 400_000, "HIDDEN", category("Áo", "ao", "VISIBLE"), 1);

    mockMvc
        .perform(get("/api/products/san-pham-2"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("PRODUCT_NOT_FOUND"));
  }

  // ============================================================
  // Helpers
  // ============================================================

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

  private ObjectNode detailWithoutUpdatedAt(String url) throws Exception {
    String body =
        mockMvc
            .perform(get(url))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    ObjectNode node = (ObjectNode) json.readTree(body);
    node.remove("updatedAt");
    return node;
  }

  /** Two ids from the highest to the lowest, the order of the last key {@code id DESC}. */
  private static String[] idDesc(UUID a, UUID b) {
    return a.compareTo(b) > 0
        ? new String[] {a.toString(), b.toString()}
        : new String[] {b.toString(), a.toString()};
  }

  private UUID category(String name, String slug, String status) {
    sequence++;
    return transaction.execute(
        tx ->
            jdbc.sql(
                    "INSERT INTO app.categories (name, slug, status) VALUES (?, ?, ?) RETURNING id")
                .params(name, slug, status)
                .query(UUID.class)
                .single());
  }

  /** A product whose slug is {@code san-pham-<n>}, created {@code minutes} after {@link #T0}. */
  private UUID product(String name, long price, String status, UUID categoryId, int minutes) {
    sequence++;
    String slug = "san-pham-" + sequence;
    Timestamp createdAt = Timestamp.from(T0.plusSeconds(60L * minutes));
    return transaction.execute(
        tx ->
            jdbc.sql(
                    "INSERT INTO app.products"
                        + " (name, slug, price_vnd, status, category_id, created_at, updated_at)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id")
                .params(name, slug, price, status, categoryId, createdAt, createdAt)
                .query(UUID.class)
                .single());
  }

  private void deleteAll() {
    transaction.executeWithoutResult(
        tx -> {
          jdbc.sql("DELETE FROM app.products").update();
          jdbc.sql("DELETE FROM app.categories").update();
        });
  }
}
