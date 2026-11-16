package com.tungph7.learnpostgres.feature.product.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Instant;
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

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * {@code GET} and {@code HEAD /api/products/{slug}} on the real database (Testcontainers PostgreSQL
 * 17, schema V4), SHOP-22: an {@code ACTIVE} product as saved, the slug compared ignoring case
 * ({@code citext}), and one same 404 for a slug that never existed, a hidden product and a deleted
 * one (NFR9), and both operations in {@code /v3/api-docs}.
 */
@SpringBootTest
@AutoConfigureMockMvc
class StoreProductIntegrationTest extends AbstractContainerBaseTest {

  private static final UUID ACTIVE_ID = UUID.fromString("019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f");
  private static final UUID HIDDEN_ID = UUID.fromString("019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e70");
  private static final UUID DELETED_ID = UUID.fromString("019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e71");
  private static final Instant UPDATED_AT = Instant.parse("2026-11-16T02:15:30.123456Z");

  @Autowired MockMvc mockMvc;
  @Autowired ObjectMapper json;
  @Autowired DataSource dataSource;
  @Autowired PlatformTransactionManager transactionManager;

  private JdbcClient jdbc;
  private TransactionTemplate transaction;

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
  // GET: 200
  // ============================================================

  @Test
  void get_anActiveProduct_returnsItAsSaved() throws Exception {
    insert(ACTIVE_ID, "ao-thun-co-tron", "ACTIVE", 250_000L, "Áo thun cotton 100%.\nCổ tròn.");

    mockMvc
        .perform(get("/api/products/ao-thun-co-tron"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(ACTIVE_ID.toString()))
        .andExpect(jsonPath("$.name").value("Áo thun cổ tròn"))
        .andExpect(jsonPath("$.slug").value("ao-thun-co-tron"))
        .andExpect(jsonPath("$.price").value(200_000))
        .andExpect(jsonPath("$.compareAtPrice").value(250_000))
        .andExpect(jsonPath("$.availability").value("IN_STOCK"))
        .andExpect(jsonPath("$.description").value("Áo thun cotton 100%.\nCổ tròn."))
        .andExpect(jsonPath("$.updatedAt").value("2026-11-16T02:15:30.123Z"));
  }

  @Test
  void get_withAnotherCase_findsTheProductAndReturnsTheSavedSlug() throws Exception {
    insert(ACTIVE_ID, "ao-thun-co-tron", "ACTIVE", null, null);

    mockMvc
        .perform(get("/api/products/Ao-Thun-CO-TRON"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.slug").value("ao-thun-co-tron"))
        .andExpect(jsonPath("$.compareAtPrice").isEmpty())
        .andExpect(jsonPath("$.description").isEmpty());
  }

  @Test
  void get_withAStatusParameter_stillShowsOnlyActiveProducts() throws Exception {
    insert(HIDDEN_ID, "bao-tay-len", "HIDDEN", null, null);

    mockMvc
        .perform(get("/api/products/bao-tay-len").param("status", "HIDDEN"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("PRODUCT_NOT_FOUND"));
  }

  // ============================================================
  // GET: 404 (NFR9)
  // ============================================================

  @Test
  void get_returnsOneSame404ForANeverSeenSlugAHiddenProductAndADeletedOne() throws Exception {
    insert(HIDDEN_ID, "bao-tay-len", "HIDDEN", null, null);
    insert(DELETED_ID, "mu-len", "ACTIVE", null, null);
    mockMvc.perform(delete("/api/admin/products/" + DELETED_ID)).andExpect(status().isNoContent());

    ObjectNode neverSeen = notFoundBody("/api/products/khong-co");
    ObjectNode hidden = notFoundBody("/api/products/bao-tay-len");
    ObjectNode deleted = notFoundBody("/api/products/mu-len");

    assertThat(neverSeen.get("code").asString()).isEqualTo("PRODUCT_NOT_FOUND");
    assertThat(neverSeen.get("detail").asString()).isEqualTo("Product not found.");
    assertThat(withoutRequestFields(hidden)).isEqualTo(withoutRequestFields(neverSeen));
    assertThat(withoutRequestFields(deleted)).isEqualTo(withoutRequestFields(neverSeen));
  }

  @Test
  void get_404_namesNoSlugIdOrStatus() throws Exception {
    insert(HIDDEN_ID, "bao-tay-len", "HIDDEN", null, null);

    ObjectNode body = withoutRequestFields(notFoundBody("/api/products/bao-tay-len"));

    assertThat(body.toString())
        .doesNotContain("bao-tay-len")
        .doesNotContain(HIDDEN_ID.toString())
        .doesNotContain("HIDDEN");
  }

  // ============================================================
  // HEAD
  // ============================================================

  @Test
  void head_ofAnActiveProduct_returns200WithNoBody() throws Exception {
    insert(ACTIVE_ID, "ao-thun-co-tron", "ACTIVE", null, null);

    mockMvc
        .perform(head("/api/products/AO-THUN-CO-TRON"))
        .andExpect(status().isOk())
        .andExpect(content().string(""));
  }

  @Test
  void head_ofAHiddenProduct_returns404WithNoBody() throws Exception {
    insert(HIDDEN_ID, "bao-tay-len", "HIDDEN", null, null);

    mockMvc
        .perform(head("/api/products/bao-tay-len"))
        .andExpect(status().isNotFound())
        .andExpect(content().string(""));
  }

  @Test
  void head_ofASlugThatNeverExisted_returns404WithNoBody() throws Exception {
    mockMvc
        .perform(head("/api/products/khong-co"))
        .andExpect(status().isNotFound())
        .andExpect(content().string(""));
  }

  // ============================================================
  // OpenAPI
  // ============================================================

  @Test
  void apiDocs_describeTheGetAndTheHead() throws Exception {
    String path = "$.paths['/api/products/{slug}']";

    mockMvc
        .perform(get("/v3/api-docs"))
        .andExpect(status().isOk())
        .andExpect(jsonPath(path + ".get.responses['200']").exists())
        .andExpect(jsonPath(path + ".get.responses['404']").exists())
        .andExpect(jsonPath(path + ".head.responses['200']").exists())
        .andExpect(jsonPath(path + ".head.responses['404']").exists());
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
    JsonNode node = json.readTree(body);
    return (ObjectNode) node;
  }

  /** The body without the members that change with each request, as NFR9 compares them. */
  private static ObjectNode withoutRequestFields(ObjectNode body) {
    ObjectNode copy = body.deepCopy();
    copy.remove("instance");
    copy.remove("timestamp");
    copy.remove("correlationId");
    return copy;
  }

  private void insert(UUID id, String slug, String status, Long compareAt, String description) {
    transaction.executeWithoutResult(
        tx ->
            jdbc.sql(
                    """
                    INSERT INTO app.products
                        (id, name, slug, description, price_vnd, compare_at_price_vnd, status,
                         availability, created_at, updated_at)
                    VALUES (:id, 'Áo thun cổ tròn', :slug, :description, 200000, :compareAt,
                            :status, 'IN_STOCK', :updatedAt, :updatedAt)
                    """)
                .param("id", id)
                .param("slug", slug)
                .param("description", description)
                .param("compareAt", compareAt)
                .param("status", status)
                .param("updatedAt", Timestamp.from(UPDATED_AT))
                .update());
  }

  private void deleteAll() {
    transaction.executeWithoutResult(tx -> jdbc.sql("DELETE FROM app.products").update());
  }
}
