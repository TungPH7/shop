package com.tungph7.learnpostgres.feature.product.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasKey;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
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
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;

/**
 * {@code GET} and {@code DELETE /api/admin/products} on the real database (Testcontainers
 * PostgreSQL 17, schema V4), SHOP-16: newest first, the status filter, the accent-insensitive
 * search of the API Contract, the page and its total, the idempotent delete and its INFO log
 * (NFR12), and the three operations in {@code /v3/api-docs}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class AdminProductListDeleteIntegrationTest extends AbstractContainerBaseTest {

  private static final String URL = "/api/admin/products";
  private static final Instant T0 = Instant.parse("2026-11-16T02:00:00Z");

  @Autowired MockMvc mockMvc;
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
  // GET
  // ============================================================

  @Test
  void list_withNoParameter_listsEveryStatusNewestFirst() throws Exception {
    insert("Áo thun cổ tròn", 250_000L, "ACTIVE", 1);
    insert("Bao tay len", 0L, "HIDDEN", 2);
    insert("Quần jean nam", 450_000L, "ACTIVE", 3);

    mockMvc
        .perform(get(URL))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.items[*].name")
                .value(contains("Quần jean nam", "Bao tay len", "Áo thun cổ tròn")))
        .andExpect(jsonPath("$.totalItems").value(3))
        .andExpect(jsonPath("$.offset").value(0))
        .andExpect(jsonPath("$.limit").value(20));
  }

  @Test
  void list_returnsTheFieldsOfEachProductAsSaved() throws Exception {
    UUID id = insert("Bao tay len", 0L, "HIDDEN", 1);

    mockMvc
        .perform(get(URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].id").value(id.toString()))
        .andExpect(jsonPath("$.items[0].name").value("Bao tay len"))
        .andExpect(jsonPath("$.items[0].slug").value("p-" + sequence))
        .andExpect(jsonPath("$.items[0].price").value(0))
        .andExpect(jsonPath("$.items[0].status").value("HIDDEN"))
        .andExpect(jsonPath("$.items[0].availability").value("IN_STOCK"))
        .andExpect(jsonPath("$.items[0].createdAt").value("2026-11-16T02:01:00Z"))
        .andExpect(jsonPath("$.items[0]", org.hamcrest.Matchers.not(hasKey("description"))));
  }

  @Test
  void list_withStatusHidden_listsOnlyHiddenProducts() throws Exception {
    insert("Áo thun cổ tròn", 250_000L, "ACTIVE", 1);
    insert("Bao tay len", 0L, "HIDDEN", 2);

    mockMvc
        .perform(get(URL).param("status", "HIDDEN"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[*].name").value(contains("Bao tay len")))
        .andExpect(jsonPath("$.totalItems").value(1));
  }

  @Test
  void list_withStatusActive_listsOnlyActiveProducts() throws Exception {
    insert("Áo thun cổ tròn", 250_000L, "ACTIVE", 1);
    insert("Bao tay len", 0L, "HIDDEN", 2);

    mockMvc
        .perform(get(URL).param("status", "ACTIVE"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[*].name").value(contains("Áo thun cổ tròn")))
        .andExpect(jsonPath("$.totalItems").value(1));
  }

  @Test
  void list_withAKeyword_findsProductsIgnoringAccentsAndCase() throws Exception {
    insert("Áo thun cổ tròn", 250_000L, "ACTIVE", 1);
    insert("Bao tay len", 90_000L, "ACTIVE", 2);
    insert("Đầm maxi đỏ 2026", 1_250_000L, "HIDDEN", 3);

    mockMvc
        .perform(get(URL).param("q", "AO"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[*].name").value(contains("Áo thun cổ tròn")));
    mockMvc
        .perform(get(URL).param("q", "dam do"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[*].name").value(contains("Đầm maxi đỏ 2026")));
  }

  @Test
  void list_withAKeywordAndAStatus_appliesBoth() throws Exception {
    insert("Áo thun cổ tròn", 250_000L, "ACTIVE", 1);
    insert("Áo khoác len", 550_000L, "HIDDEN", 2);

    mockMvc
        .perform(get(URL).param("q", "áo").param("status", "HIDDEN"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[*].name").value(contains("Áo khoác len")))
        .andExpect(jsonPath("$.totalItems").value(1));
  }

  @Test
  void list_withAKeywordOfNoWord_matchesNothing() throws Exception {
    insert("Áo thun cổ tròn", 250_000L, "ACTIVE", 1);

    mockMvc
        .perform(get(URL).param("q", "%"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items").isEmpty())
        .andExpect(jsonPath("$.totalItems").value(0));
  }

  @Test
  void list_withABlankKeyword_doesNotSearch() throws Exception {
    insert("Áo thun cổ tròn", 250_000L, "ACTIVE", 1);
    insert("Bao tay len", 90_000L, "ACTIVE", 2);

    mockMvc
        .perform(get(URL).param("q", "   "))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalItems").value(2));
  }

  @Test
  void list_withOffsetAndLimit_returnsThatPageAndTheTotalOfAllPages() throws Exception {
    for (int i = 1; i <= 5; i++) {
      insert("Sản phẩm " + i, 100_000L, "ACTIVE", i);
    }

    mockMvc
        .perform(get(URL).param("offset", "2").param("limit", "2"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[*].name").value(contains("Sản phẩm 3", "Sản phẩm 2")))
        .andExpect(jsonPath("$.totalItems").value(5))
        .andExpect(jsonPath("$.offset").value(2))
        .andExpect(jsonPath("$.limit").value(2));
  }

  @Test
  void list_withAnOffsetPastTheEnd_returnsNoProductButTheTotal() throws Exception {
    insert("Áo thun cổ tròn", 250_000L, "ACTIVE", 1);

    mockMvc
        .perform(get(URL).param("offset", "100"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items").isEmpty())
        .andExpect(jsonPath("$.totalItems").value(1));
  }

  @Test
  void list_withAnInvalidParameter_returns400InvalidParameter() throws Exception {
    mockMvc
        .perform(get(URL).param("limit", "101"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.parameter").value("limit"));
  }

  // ============================================================
  // DELETE
  // ============================================================

  @Test
  void delete_removesTheProductAndReturns204() throws Exception {
    UUID kept = insert("Áo thun cổ tròn", 250_000L, "ACTIVE", 1);
    UUID deleted = insert("Quần jean nam", 450_000L, "ACTIVE", 2);

    mockMvc
        .perform(delete(URL + "/" + deleted))
        .andExpect(status().isNoContent())
        .andExpect(content().string(""));

    assertThat(exists(deleted)).isFalse();
    assertThat(exists(kept)).isTrue();
  }

  @Test
  void delete_twice_returns204BothTimes() throws Exception {
    UUID id = insert("Quần jean nam", 450_000L, "ACTIVE", 1);

    mockMvc.perform(delete(URL + "/" + id)).andExpect(status().isNoContent());
    mockMvc.perform(delete(URL + "/" + id)).andExpect(status().isNoContent());

    assertThat(exists(id)).isFalse();
  }

  @Test
  void delete_ofAnIdNeverUsed_returns204() throws Exception {
    insert("Quần jean nam", 450_000L, "ACTIVE", 1);

    mockMvc.perform(delete(URL + "/" + UUID.randomUUID())).andExpect(status().isNoContent());

    assertThat(count()).isEqualTo(1);
  }

  @Test
  void delete_ofAHiddenProduct_removesIt() throws Exception {
    UUID id = insert("Bao tay len", 0L, "HIDDEN", 1);

    mockMvc.perform(delete(URL + "/" + id)).andExpect(status().isNoContent());

    assertThat(exists(id)).isFalse();
  }

  @Test
  void delete_logsTheOperationIdSlugAndCorrelationId(CapturedOutput output) throws Exception {
    UUID id = insert("Quần jean nam", 450_000L, "ACTIVE", 1);
    String slug = "p-" + sequence;

    mockMvc
        .perform(delete(URL + "/" + id).header("X-Correlation-Id", "corr-shop16-delete"))
        .andExpect(status().isNoContent());

    String line = appLogLineWith(output, "operation=delete id=" + id);
    assertThat(line)
        .contains("\"level\":\"INFO\"")
        .contains("slug=" + slug)
        .contains("correlationId=corr-shop16-delete");
  }

  @Test
  void delete_ofAProductAlreadyGone_logsItAtInfo(CapturedOutput output) throws Exception {
    UUID id = UUID.randomUUID();

    mockMvc
        .perform(delete(URL + "/" + id).header("X-Correlation-Id", "corr-shop16-gone"))
        .andExpect(status().isNoContent());

    String line = appLogLineWith(output, "operation=delete id=" + id);
    assertThat(line)
        .contains("\"level\":\"INFO\"")
        .contains("already gone")
        .contains("correlationId=corr-shop16-gone");
  }

  // ============================================================
  // OpenAPI (Checkpoint Nền of the plan)
  // ============================================================

  @Test
  void apiDocs_describeThePostGetAndDeleteOfTheAdminProducts() throws Exception {
    mockMvc
        .perform(get("/v3/api-docs"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.paths['/api/admin/products'].get").exists())
        .andExpect(jsonPath("$.paths['/api/admin/products'].post").exists())
        .andExpect(jsonPath("$.paths['/api/admin/products/{id}'].delete").exists());
  }

  // ============================================================
  // Helpers
  // ============================================================

  /**
   * Inserts as {@code v0.3.0} does, created {@code minutes} after {@link #T0}. The ids grow with
   * each insert, as UUIDv7 do.
   */
  private UUID insert(String name, long priceVnd, String status, int minutes) {
    sequence++;
    UUID id = new UUID(0x019a_0000_0000_7000L, 0x8000_0000_0000_0000L | sequence);
    Timestamp createdAt = Timestamp.from(T0.plus(Duration.ofMinutes(minutes)));
    transaction.executeWithoutResult(
        tx ->
            jdbc.sql(
                    """
                    INSERT INTO app.products
                        (id, name, slug, price_vnd, status, availability, created_at, updated_at)
                    VALUES (:id, :name, :slug, :priceVnd, :status, 'IN_STOCK', :createdAt,
                            :createdAt)
                    """)
                .param("id", id)
                .param("name", name)
                .param("slug", "p-" + sequence)
                .param("priceVnd", priceVnd)
                .param("status", status)
                .param("createdAt", createdAt)
                .update());
    return id;
  }

  private boolean exists(UUID id) {
    return transaction.execute(
            tx ->
                jdbc.sql("SELECT count(*) FROM app.products WHERE id = :id")
                    .param("id", id)
                    .query(Long.class)
                    .single())
        > 0;
  }

  private long count() {
    return transaction.execute(
        tx -> jdbc.sql("SELECT count(*) FROM app.products").query(Long.class).single());
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
