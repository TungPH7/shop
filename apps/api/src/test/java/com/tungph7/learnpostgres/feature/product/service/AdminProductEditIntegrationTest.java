package com.tungph7.learnpostgres.feature.product.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import javax.sql.DataSource;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * {@code GET} and {@code PUT /api/admin/products/{id}} on the real database (Testcontainers
 * PostgreSQL 17, schema V4), SHOP-35 (US3): a hidden product is read, the edit writes every field
 * and returns the new version, a slug out of the format of before the Epic is kept when it is not
 * changed (NFR16), a changed slug is checked for its format and for a duplicate, a stale version is
 * a 409 that writes nothing (AC13), two edits at once with the same version are one 200 and one
 * 409, the INFO log of the edit (NFR12), and the two operations in {@code /v3/api-docs}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class AdminProductEditIntegrationTest extends AbstractContainerBaseTest {

  private static final String URL = "/api/admin/products";
  private static final Instant T0 = Instant.parse("2026-11-16T02:00:00Z");

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
  // GET /{id}
  // ============================================================

  @Test
  void get_ofAHiddenProduct_returnsItWithItsVersion() throws Exception {
    UUID id = insert("Bao tay len", "bao-tay-len", 0L, "HIDDEN");

    mockMvc
        .perform(get(URL + "/" + id))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(id.toString()))
        .andExpect(jsonPath("$.name").value("Bao tay len"))
        .andExpect(jsonPath("$.slug").value("bao-tay-len"))
        .andExpect(jsonPath("$.description").value("Len mềm.\nGiữ ấm."))
        .andExpect(jsonPath("$.price").value(0))
        .andExpect(jsonPath("$.compareAtPrice").isEmpty())
        .andExpect(jsonPath("$.status").value("HIDDEN"))
        .andExpect(jsonPath("$.availability").value("IN_STOCK"))
        .andExpect(jsonPath("$.createdAt").value("2026-11-16T02:00:00.000Z"))
        .andExpect(jsonPath("$.updatedAt").value("2026-11-16T02:00:00.000Z"))
        .andExpect(jsonPath("$.version").value(0));
  }

  @Test
  void get_ofAnUnknownId_returns404() throws Exception {
    mockMvc
        .perform(get(URL + "/" + UUID.randomUUID()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("PRODUCT_NOT_FOUND"));
  }

  // ============================================================
  // PUT /{id}: 200
  // ============================================================

  /** The edit of AC9: new name and prices, the slug kept. */
  @Test
  void update_writesEveryFieldAndReturnsTheNewVersion() throws Exception {
    UUID id = insert("Áo thun cổ tròn", "ao-thun-co-tron", 250_000L, "ACTIVE");

    MvcResult result =
        update(
                id,
                body(
                    "Áo thun cổ tròn basic",
                    "ao-thun-co-tron",
                    "Cotton.",
                    200_000L,
                    250_000L,
                    "ACTIVE",
                    "OUT_OF_STOCK",
                    0))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(id.toString()))
            .andExpect(jsonPath("$.name").value("Áo thun cổ tròn basic"))
            .andExpect(jsonPath("$.slug").value("ao-thun-co-tron"))
            .andExpect(jsonPath("$.description").value("Cotton."))
            .andExpect(jsonPath("$.price").value(200000))
            .andExpect(jsonPath("$.compareAtPrice").value(250000))
            .andExpect(jsonPath("$.availability").value("OUT_OF_STOCK"))
            .andExpect(jsonPath("$.createdAt").value("2026-11-16T02:00:00.000Z"))
            .andExpect(jsonPath("$.version").value(1))
            .andReturn();

    Map<String, Object> row = row(id);
    assertThat(row.get("name")).isEqualTo("Áo thun cổ tròn basic");
    assertThat(row.get("price_vnd")).isEqualTo(200_000L);
    assertThat(row.get("compare_at_price_vnd")).isEqualTo(250_000L);
    assertThat(row.get("availability")).isEqualTo("OUT_OF_STOCK");
    assertThat(row.get("version")).isEqualTo(1L);
    // The trigger of V4 keeps the legacy column of v0.2.0 equal to the new price (NFR17).
    assertThat((BigDecimal) row.get("price")).isEqualByComparingTo("200000");
    assertThat(field(result, "updatedAt")).isNotEqualTo("2026-11-16T02:00:00.000Z");
  }

  /** The {@code updatedAt} the edit returns is the one the database keeps, set by its trigger. */
  @Test
  void update_returnsTheUpdatedAtThatALaterReadReturns() throws Exception {
    UUID id = insert("Áo thun cổ tròn", "ao-thun-co-tron", 250_000L, "ACTIVE");

    MvcResult edit =
        update(
                id,
                body("Áo thun", "ao-thun-co-tron", null, 250_000L, null, "ACTIVE", "IN_STOCK", 0))
            .andExpect(status().isOk())
            .andReturn();
    MvcResult read = mockMvc.perform(get(URL + "/" + id)).andExpect(status().isOk()).andReturn();

    assertThat(field(edit, "updatedAt")).isEqualTo(field(read, "updatedAt"));
    assertThat(field(edit, "version")).isEqualTo(field(read, "version"));
  }

  /** AC10: a hidden product stays in the admin, with its status. */
  @Test
  void update_toHidden_keepsTheProductReadable() throws Exception {
    UUID id = insert("Áo thun cổ tròn", "ao-thun-co-tron", 250_000L, "ACTIVE");

    update(
            id,
            body(
                "Áo thun cổ tròn",
                "ao-thun-co-tron",
                null,
                250_000L,
                null,
                "HIDDEN",
                "IN_STOCK",
                0))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("HIDDEN"));

    mockMvc
        .perform(get(URL + "/" + id))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("HIDDEN"));
  }

  /**
   * NFR16: a slug of before the Epic, out of the format, is kept when the admin does not change it.
   */
  @Test
  void update_withTheStoredSlugOutOfTheFormat_savesAndKeepsIt() throws Exception {
    UUID id = insert("Áo thun", "-ao--thun-", 250_000L, "ACTIVE");

    update(id, body("Áo thun mới", "-ao--thun-", null, 250_000L, null, "ACTIVE", "IN_STOCK", 0))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Áo thun mới"))
        .andExpect(jsonPath("$.slug").value("-ao--thun-"));

    assertThat(row(id).get("slug")).isEqualTo("-ao--thun-");
  }

  /**
   * The stored slug sent in other case is the same slug (citext), so its format is not checked, and
   * the slug stored stays as it was: an upper-case slug would be out of the format.
   */
  @Test
  void update_withTheStoredSlugInOtherCase_keepsTheStoredSlug() throws Exception {
    UUID id = insert("Áo thun", "-ao--thun-", 250_000L, "ACTIVE");

    update(id, body("Áo thun", "-AO--THUN-", null, 250_000L, null, "ACTIVE", "IN_STOCK", 0))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.slug").value("-ao--thun-"));

    assertThat(row(id).get("slug")).isEqualTo("-ao--thun-");
  }

  /** AC12: a new slug of the format is saved, and the old one is free again. */
  @Test
  void update_withANewSlug_savesItAndFreesTheOldOne() throws Exception {
    UUID id = insert("Áo thun cổ tròn", "ao-thun-co-tron", 250_000L, "ACTIVE");

    update(
            id,
            body("Áo thun cổ tròn", "ao-thun-basic", null, 250_000L, null, "ACTIVE", "IN_STOCK", 0))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.slug").value("ao-thun-basic"));

    assertThat(row(id).get("slug")).isEqualTo("ao-thun-basic");
    insert("Áo thun khác", "ao-thun-co-tron", 1L, "ACTIVE");
  }

  /**
   * Product Rules: a product of before the Epic with price 0 is saved once it has a valid price.
   */
  @Test
  void update_ofAProductWithPriceZero_savesTheNewPrice() throws Exception {
    UUID id = insert("Bao tay len", "bao-tay-len", 0L, "HIDDEN");

    update(id, body("Bao tay len", "bao-tay-len", null, 0L, null, "HIDDEN", "IN_STOCK", 0))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[0].field").value("price"));

    update(id, body("Bao tay len", "bao-tay-len", null, 90_000L, null, "ACTIVE", "IN_STOCK", 0))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.price").value(90000))
        .andExpect(jsonPath("$.status").value("ACTIVE"));
  }

  // ============================================================
  // PUT /{id}: 400, 404 and 409, each writing nothing
  // ============================================================

  @Test
  void update_withAChangedSlugOutOfTheFormat_returns400OnTheSlugAndWritesNothing()
      throws Exception {
    UUID id = insert("Áo thun", "ao-thun", 250_000L, "ACTIVE");

    update(id, body("Áo thun mới", "Ao--Thun-Moi", null, 250_000L, null, "ACTIVE", "IN_STOCK", 0))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.detail").value("Validation failed for 1 field(s)."))
        .andExpect(jsonPath("$.errors", hasSize(1)))
        .andExpect(jsonPath("$.errors[0].field").value("slug"))
        .andExpect(jsonPath("$.errors[0].rejectedValue").value("Ao--Thun-Moi"))
        .andExpect(
            jsonPath("$.errors[0].message")
                .value(
                    "must be lowercase letters a-z and digits, in words joined by single"
                        + " hyphens"));

    assertUnchanged(id, "Áo thun", "ao-thun");
  }

  /** A stored slug out of the format, changed to another one out of the format, is checked too. */
  @Test
  void update_fromAnOldSlugToAnotherOneOutOfTheFormat_returns400() throws Exception {
    UUID id = insert("Áo thun", "-ao--thun-", 250_000L, "ACTIVE");

    update(id, body("Áo thun", "-ao--thun--2", null, 250_000L, null, "ACTIVE", "IN_STOCK", 0))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[0].field").value("slug"));

    assertUnchanged(id, "Áo thun", "-ao--thun-");
  }

  @Test
  void update_withAChangedSlugOf101Characters_returns400SayingItIsTooLong() throws Exception {
    UUID id = insert("Áo thun", "ao-thun", 250_000L, "ACTIVE");

    update(id, body("Áo thun", "a".repeat(101), null, 250_000L, null, "ACTIVE", "IN_STOCK", 0))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[0].field").value("slug"))
        .andExpect(jsonPath("$.errors[0].message").value("must be at most 100 characters"));
  }

  @Test
  void update_withASlugTakenByAnotherProductInOtherCase_returns409AndWritesNothing()
      throws Exception {
    insert("Áo thun basic", "ao-thun-basic", 199_000L, "ACTIVE");
    UUID id = insert("Áo thun cổ tròn", "ao-thun-co-tron", 250_000L, "ACTIVE");

    update(id, body("Áo thun mới", "ao-thun-basic", null, 250_000L, null, "ACTIVE", "IN_STOCK", 0))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("PRODUCT_SLUG_DUPLICATED"));

    assertUnchanged(id, "Áo thun cổ tròn", "ao-thun-co-tron");
  }

  /** AC13: the second tab sends the version it read, the first tab's edit is kept. */
  @Test
  void update_withAStaleVersion_returns409AndKeepsTheOtherEdit() throws Exception {
    UUID id = insert("Áo thun cổ tròn", "ao-thun-co-tron", 250_000L, "ACTIVE");
    update(id, body("Tab một", "ao-thun-co-tron", null, 250_000L, null, "ACTIVE", "IN_STOCK", 0))
        .andExpect(status().isOk());

    update(id, body("Tab hai", "ao-thun-co-tron", null, 1L, null, "HIDDEN", "IN_STOCK", 0))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));

    Map<String, Object> row = row(id);
    assertThat(row.get("name")).isEqualTo("Tab một");
    assertThat(row.get("status")).isEqualTo("ACTIVE");
    assertThat(row.get("version")).isEqualTo(1L);
  }

  @Test
  void update_withAVersionAheadOfTheStoredOne_returns409() throws Exception {
    UUID id = insert("Áo thun cổ tròn", "ao-thun-co-tron", 250_000L, "ACTIVE");

    update(id, body("Áo thun", "ao-thun-co-tron", null, 250_000L, null, "ACTIVE", "IN_STOCK", 7))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));

    assertUnchanged(id, "Áo thun cổ tròn", "ao-thun-co-tron");
  }

  @Test
  void update_ofAnUnknownId_returns404() throws Exception {
    update(
            UUID.randomUUID(),
            body("Áo thun", "ao-thun", null, 250_000L, null, "ACTIVE", "IN_STOCK", 0))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("PRODUCT_NOT_FOUND"));
  }

  /**
   * Two edits at once with the same version both pass the check of the version, so {@code @Version}
   * of Hibernate is what stops the second: the test holds a lock on the row until both edits wait
   * to write it, then lets them go.
   */
  @Test
  void update_twiceAtOnceWithTheSameVersion_savesOneAndReturns409ToTheOther() throws Exception {
    UUID id = insert("Áo thun cổ tròn", "ao-thun-co-tron", 250_000L, "ACTIVE");
    ExecutorService pool = Executors.newFixedThreadPool(2);
    try {
      List<Future<Integer>> edits =
          transaction.execute(
              tx -> {
                jdbc.sql("SELECT id FROM app.products WHERE id = :id FOR UPDATE")
                    .param("id", id)
                    .query()
                    .singleValue();
                List<Future<Integer>> sent =
                    List.of(
                        pool.submit(() -> updateStatus(id, "Tab một")),
                        pool.submit(() -> updateStatus(id, "Tab hai")));
                awaitUpdatesWaitingForTheLock(2);
                return sent;
              });

      assertThat(
              List.of(
                  edits.get(0).get(30, TimeUnit.SECONDS), edits.get(1).get(30, TimeUnit.SECONDS)))
          .containsExactlyInAnyOrder(200, 409);
      assertThat(row(id).get("version")).isEqualTo(1L);
    } finally {
      pool.shutdownNow();
    }
  }

  // ============================================================
  // Log (NFR12) and OpenAPI
  // ============================================================

  @Test
  void update_logsTheOperationIdSlugAndCorrelationIdButNotTheDescription(CapturedOutput output)
      throws Exception {
    UUID id = insert("Áo thun cổ tròn", "ao-thun-co-tron", 250_000L, "ACTIVE");

    mockMvc
        .perform(
            put(URL + "/" + id)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Correlation-Id", "corr-shop35-update")
                .content(
                    body(
                        "Áo thun",
                        "ao-thun-basic",
                        "Mô tả bí mật shop35",
                        250_000L,
                        null,
                        "ACTIVE",
                        "IN_STOCK",
                        0)))
        .andExpect(status().isOk());

    String line = appLogLineWith(output, "operation=update id=" + id);
    assertThat(line)
        .contains("\"level\":\"INFO\"")
        .contains("slug=ao-thun-basic")
        .contains("correlationId=corr-shop35-update");
    assertThat(output.getOut()).doesNotContain("Mô tả bí mật shop35");
  }

  @Test
  void apiDocs_describeTheGetAndThePutOfOneProduct() throws Exception {
    String one = "$.paths['/api/admin/products/{id}']";

    mockMvc
        .perform(get("/v3/api-docs"))
        .andExpect(status().isOk())
        .andExpect(jsonPath(one + ".get.responses").value(hasKey("200")))
        .andExpect(jsonPath(one + ".get.responses").value(hasKey("400")))
        .andExpect(jsonPath(one + ".get.responses").value(hasKey("404")))
        .andExpect(jsonPath(one + ".put.responses").value(hasKey("200")))
        .andExpect(jsonPath(one + ".put.responses").value(hasKey("400")))
        .andExpect(jsonPath(one + ".put.responses").value(hasKey("404")))
        .andExpect(jsonPath(one + ".put.responses").value(hasKey("409")))
        .andExpect(jsonPath(one + ".put.requestBody").exists());
  }

  // ============================================================
  // Helpers
  // ============================================================

  private ResultActions update(UUID id, String body) throws Exception {
    return mockMvc.perform(
        put(URL + "/" + id).contentType(MediaType.APPLICATION_JSON).content(body));
  }

  /** Sends an edit at version 0 that only changes the name, and returns its status. */
  private int updateStatus(UUID id, String name) throws Exception {
    return update(id, body(name, "ao-thun-co-tron", null, 250_000L, null, "ACTIVE", "IN_STOCK", 0))
        .andReturn()
        .getResponse()
        .getStatus();
  }

  /**
   * Waits until {@code count} sessions wait on a lock to update the products, read from another
   * connection than the one that holds the lock.
   */
  private void awaitUpdatesWaitingForTheLock(int count) {
    JdbcClient other = JdbcClient.create(dataSource);
    TransactionTemplate newTransaction = new TransactionTemplate(transactionManager);
    newTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    Instant deadline = Instant.now().plus(Duration.ofSeconds(30));
    while (Instant.now().isBefore(deadline)) {
      Long waiting =
          newTransaction.execute(
              tx ->
                  other
                      .sql(
                          """
                          SELECT count(*) FROM pg_stat_activity
                          WHERE datname = current_database()
                            AND wait_event_type = 'Lock'
                            AND query ILIKE 'update%app.products%'
                          """)
                      .query(Long.class)
                      .single());
      if (waiting != null && waiting >= count) {
        return;
      }
      try {
        Thread.sleep(20);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException(e);
      }
    }
    throw new IllegalStateException("The two edits did not reach the update of the row");
  }

  /** A full {@code UpdateProductInput}; {@code null} writes JSON null. */
  private String body(
      String name,
      String slug,
      String description,
      Long price,
      Long compareAtPrice,
      String status,
      String availability,
      long version) {
    Map<String, Object> body = new java.util.LinkedHashMap<>();
    body.put("name", name);
    body.put("slug", slug);
    body.put("description", description);
    body.put("price", price);
    body.put("compareAtPrice", compareAtPrice);
    body.put("status", status);
    body.put("availability", availability);
    body.put("version", version);
    return json.writeValueAsString(body);
  }

  private String field(MvcResult result, String name) throws Exception {
    JsonNode node = json.readTree(result.getResponse().getContentAsString());
    return node.get(name).asString();
  }

  /** Inserts as {@code v0.3.0} does, created and updated at {@link #T0}, at version 0. */
  private UUID insert(String name, String slug, long priceVnd, String status) {
    sequence++;
    UUID id = new UUID(0x019a_0000_0000_7000L, 0x8000_0000_0000_0000L | sequence);
    transaction.executeWithoutResult(
        tx ->
            jdbc.sql(
                    """
                    INSERT INTO app.products
                        (id, name, slug, description, price_vnd, status, availability,
                         created_at, updated_at)
                    VALUES (:id, :name, :slug, 'Len mềm.' || chr(10) || 'Giữ ấm.', :priceVnd,
                            :status, 'IN_STOCK', :t0, :t0)
                    """)
                .param("id", id)
                .param("name", name)
                .param("slug", slug)
                .param("priceVnd", priceVnd)
                .param("status", status)
                .param("t0", java.sql.Timestamp.from(T0))
                .update());
    return id;
  }

  private Map<String, Object> row(UUID id) {
    return transaction.execute(
        tx ->
            jdbc.sql(
                    "SELECT name, slug::text AS slug, price, price_vnd, compare_at_price_vnd,"
                        + " status, availability, version FROM app.products WHERE id = :id")
                .param("id", id)
                .query()
                .singleRow());
  }

  private void assertUnchanged(UUID id, String name, String slug) {
    Map<String, Object> row = row(id);
    assertThat(row.get("name")).isEqualTo(name);
    assertThat(row.get("slug")).isEqualTo(slug);
    assertThat(row.get("version")).isEqualTo(0L);
  }

  private void deleteAll() {
    transaction.executeWithoutResult(tx -> jdbc.sql("DELETE FROM app.products").update());
  }

  /** The one line of the app log, not of Hibernate, that holds {@code text}. */
  private static String appLogLineWith(CapturedOutput output, String text) {
    var lines =
        output
            .getOut()
            .lines()
            .filter(line -> !line.contains("\"logger\":\"org.hibernate."))
            .filter(line -> line.contains(text))
            .collect(Collectors.toList());
    assertThat(lines).hasSize(1);
    return lines.get(0);
  }
}
