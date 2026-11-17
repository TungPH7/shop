package com.tungph7.learnpostgres.feature.product.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItems;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
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
 * one (NFR9), and both operations in {@code /v3/api-docs}. {@code GET /api/products} (SHOP-26):
 * only {@code ACTIVE} products, newest first with {@code id DESC} as the last key (NFR18), pages
 * that never repeat or skip a product, and a status parameter ignored (NFR9).
 *
 * <p>Each connection has {@code currentSchema=app}, which {@code application-test.yml} sets for
 * every test, as the URL of {@code application.yml} does for the deployed app. That {@code
 * search_path} leaves out {@code public}, where the {@code citext} operators are, so a slug
 * compared as {@code text}, with case, would fail here as on the servers.
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
  private long sequence;

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
  void connections_haveTheSearchPathOfTheDeployedApp() {
    String searchPath =
        transaction.execute(tx -> jdbc.sql("SHOW search_path").query(String.class).single());

    assertThat(searchPath).isEqualTo("app");
  }

  @Test
  void get_withAnotherCase_findsAnOldProductWhoseSavedSlugHasCapitals() throws Exception {
    insert(ACTIVE_ID, "Ao-Thun-Cu", "ACTIVE", null, null);

    mockMvc
        .perform(get("/api/products/ao-thun-cu"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.slug").value("Ao-Thun-Cu"));
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
  // GET list (SHOP-26)
  // ============================================================

  @Test
  void list_showsOnlyActiveProducts_newestFirst() throws Exception {
    listed("Áo thun cổ tròn", "ACTIVE", 1);
    listed("Bao tay len", "HIDDEN", 2);
    listed("Quần jean nam", "ACTIVE", 3);

    mockMvc
        .perform(get("/api/products"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[*].name").value(contains("Quần jean nam", "Áo thun cổ tròn")))
        .andExpect(jsonPath("$.totalItems").value(2))
        .andExpect(jsonPath("$.offset").value(0))
        .andExpect(jsonPath("$.limit").value(24));
  }

  @Test
  void list_withAStatusParameter_stillListsOnlyActiveProducts() throws Exception {
    listed("Áo thun cổ tròn", "ACTIVE", 1);
    listed("Bao tay len", "HIDDEN", 2);

    mockMvc
        .perform(get("/api/products").param("status", "HIDDEN"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[*].name").value(contains("Áo thun cổ tròn")))
        .andExpect(jsonPath("$.totalItems").value(1));
  }

  @Test
  void list_ofProductsCreatedAtTheSameTime_putsTheGreaterIdFirst() throws Exception {
    UUID first = listed("Áo thun cổ tròn", "ACTIVE", 1);
    UUID second = listed("Quần jean nam", "ACTIVE", 1);

    mockMvc
        .perform(get("/api/products"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[*].id").value(contains(second.toString(), first.toString())));
  }

  @Test
  void list_returnsTheStoreFieldsOfEachProductAsSaved() throws Exception {
    insert(ACTIVE_ID, "ao-thun-co-tron", "ACTIVE", 250_000L, "Mô tả không có trong danh sách.");

    mockMvc
        .perform(get("/api/products"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].id").value(ACTIVE_ID.toString()))
        .andExpect(jsonPath("$.items[0].name").value("Áo thun cổ tròn"))
        .andExpect(jsonPath("$.items[0].slug").value("ao-thun-co-tron"))
        .andExpect(jsonPath("$.items[0].price").value(200_000))
        .andExpect(jsonPath("$.items[0].compareAtPrice").value(250_000))
        .andExpect(jsonPath("$.items[0].availability").value("IN_STOCK"))
        .andExpect(jsonPath("$.items[0].description").doesNotExist())
        .andExpect(jsonPath("$.items[0].status").doesNotExist());
  }

  @Test
  void list_ofThirtyActiveProducts_returns24Then6_withNoProductTwice() throws Exception {
    List<String> created = new ArrayList<>();
    for (int i = 0; i < 30; i++) {
      created.add(listed("Sản phẩm " + i, "ACTIVE", i).toString());
      listed("Ẩn " + i, "HIDDEN", i);
    }

    List<String> firstPage = ids(page(0, 24, 30));
    List<String> secondPage = ids(page(24, 24, 30));

    assertThat(firstPage).hasSize(24);
    assertThat(secondPage).hasSize(6);
    Set<String> seen = new HashSet<>(firstPage);
    seen.addAll(secondPage);
    assertThat(seen).containsExactlyInAnyOrderElementsOf(created);
  }

  @Test
  void list_withAnOffsetPastTheEnd_returnsNoProductButTheTotal() throws Exception {
    listed("Áo thun cổ tròn", "ACTIVE", 1);

    mockMvc
        .perform(get("/api/products").param("offset", "96").param("limit", "96"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items").isEmpty())
        .andExpect(jsonPath("$.totalItems").value(1))
        .andExpect(jsonPath("$.offset").value(96))
        .andExpect(jsonPath("$.limit").value(96));
  }

  @Test
  void list_withAnInvalidParameter_returns400InvalidParameter() throws Exception {
    mockMvc
        .perform(get("/api/products").param("limit", "101"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.parameter").value("limit"));
  }

  // ============================================================
  // GET sitemap (SHOP-32)
  // ============================================================

  @Test
  void sitemap_listsTheActiveProductsByIdWithTheirLastUpdate_andNoHiddenOne() throws Exception {
    insert(ACTIVE_ID, "ao-thun-co-tron", "ACTIVE", null, null);
    insert(HIDDEN_ID, "bao-tay-len", "HIDDEN", null, null);
    insert(DELETED_ID, "mu-len", "ACTIVE", null, null);

    mockMvc
        .perform(get("/api/sitemap/products"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[*].slug").value(contains("ao-thun-co-tron", "mu-len")))
        .andExpect(jsonPath("$.items[0].updatedAt").value("2026-11-16T02:15:30.123Z"))
        .andExpect(jsonPath("$.totalItems").value(2))
        .andExpect(jsonPath("$.offset").value(0))
        .andExpect(jsonPath("$.limit").value(1_000));
  }

  @Test
  void sitemap_withAStatusParameter_stillListsOnlyActiveProducts() throws Exception {
    insert(ACTIVE_ID, "ao-thun-co-tron", "ACTIVE", null, null);
    insert(HIDDEN_ID, "bao-tay-len", "HIDDEN", null, null);

    mockMvc
        .perform(get("/api/sitemap/products").param("status", "HIDDEN"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[*].slug").value(contains("ao-thun-co-tron")))
        .andExpect(jsonPath("$.totalItems").value(1));
  }

  @Test
  void sitemap_leavesOutADeletedProduct() throws Exception {
    insert(ACTIVE_ID, "ao-thun-co-tron", "ACTIVE", null, null);
    insert(DELETED_ID, "mu-len", "ACTIVE", null, null);
    mockMvc.perform(delete("/api/admin/products/" + DELETED_ID)).andExpect(status().isNoContent());

    mockMvc
        .perform(get("/api/sitemap/products"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[*].slug").value(contains("ao-thun-co-tron")))
        .andExpect(jsonPath("$.totalItems").value(1));
  }

  @Test
  void sitemap_withAnInvalidParameter_returns400InvalidParameter() throws Exception {
    mockMvc
        .perform(get("/api/sitemap/products").param("limit", "1001"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.parameter").value("limit"));
  }

  @Test
  void get_ofAProductWhoseSlugIsSitemap_stillReturnsThatProduct() throws Exception {
    insert(ACTIVE_ID, "sitemap", "ACTIVE", null, null);

    mockMvc
        .perform(get("/api/products/sitemap"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(ACTIVE_ID.toString()))
        .andExpect(jsonPath("$.slug").value("sitemap"));
  }

  // ============================================================
  // OpenAPI
  // ============================================================

  @Test
  void apiDocs_describeTheSitemap() throws Exception {
    String path = "$.paths['/api/sitemap/products'].get";

    mockMvc
        .perform(get("/v3/api-docs"))
        .andExpect(status().isOk())
        .andExpect(jsonPath(path + ".parameters[*].name").value(hasItems("offset", "limit")))
        .andExpect(
            jsonPath(path + ".parameters[?(@.name == 'limit')].schema.minimum").value(contains(1)))
        .andExpect(
            jsonPath(path + ".parameters[?(@.name == 'limit')].schema.maximum")
                .value(contains(1_000)))
        .andExpect(jsonPath(path + ".responses['200']").exists())
        .andExpect(jsonPath(path + ".responses['400']").exists());
  }

  @Test
  void apiDocs_describeTheList() throws Exception {
    String path = "$.paths['/api/products'].get";

    mockMvc
        .perform(get("/v3/api-docs"))
        .andExpect(status().isOk())
        .andExpect(jsonPath(path + ".parameters[*].name").value(hasItems("offset", "limit")))
        .andExpect(
            jsonPath(path + ".parameters[?(@.name == 'limit')].schema.minimum").value(contains(1)))
        .andExpect(
            jsonPath(path + ".parameters[?(@.name == 'limit')].schema.maximum")
                .value(contains(100)))
        .andExpect(jsonPath(path + ".responses['200']").exists())
        .andExpect(jsonPath(path + ".responses['400']").exists());
  }

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

  private JsonNode page(int offset, int limit, int totalItems) throws Exception {
    String body =
        mockMvc
            .perform(
                get("/api/products")
                    .param("offset", String.valueOf(offset))
                    .param("limit", String.valueOf(limit)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalItems").value(totalItems))
            .andReturn()
            .getResponse()
            .getContentAsString();
    return json.readTree(body);
  }

  private static List<String> ids(JsonNode page) {
    List<String> ids = new ArrayList<>();
    page.get("items").forEach(item -> ids.add(item.get("id").asString()));
    return ids;
  }

  /**
   * Inserts a product of a list, created {@code minutes} after {@link #UPDATED_AT}. The ids grow
   * with each insert, as UUIDv7 do.
   */
  private UUID listed(String name, String status, int minutes) {
    sequence++;
    UUID id = new UUID(0x019a_0000_0000_7000L, 0x8000_0000_0000_0000L | sequence);
    Timestamp createdAt = Timestamp.from(UPDATED_AT.plus(Duration.ofMinutes(minutes)));
    transaction.executeWithoutResult(
        tx ->
            jdbc.sql(
                    """
                    INSERT INTO app.products
                        (id, name, slug, price_vnd, status, availability, created_at, updated_at)
                    VALUES (:id, :name, :slug, 200000, :status, 'IN_STOCK', :createdAt,
                            :createdAt)
                    """)
                .param("id", id)
                .param("name", name)
                .param("slug", "p-" + sequence)
                .param("status", status)
                .param("createdAt", createdAt)
                .update());
    return id;
  }

  private void deleteAll() {
    transaction.executeWithoutResult(tx -> jdbc.sql("DELETE FROM app.products").update());
  }
}
