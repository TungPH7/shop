package com.tungph7.learnpostgres.feature.product.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import javax.sql.DataSource;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;

/**
 * {@code categoryId} in the admin API of products on the real database (Testcontainers PostgreSQL
 * 17, schema V7), SHOP-82 step 7: the add, the four cases of the edit (plan of SHOP-81,
 * Architecture Decisions 7), a category that is gone (AC10), and an edit that assigns a category
 * while another connection deletes it (NFR15): never a product that points to a deleted category.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AdminProductCategoryIntegrationTest extends AbstractContainerBaseTest {

  private static final String URL = "/api/admin/products";

  @Autowired MockMvc mockMvc;
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
  // The add
  // ============================================================

  @Test
  void create_withAHiddenCategory_savesIt() throws Exception {
    UUID phuKien = category("Phụ kiện", "HIDDEN");

    postJson("{\"name\":\"Khăn lụa\",\"price\":150000,\"categoryId\":\"" + phuKien + "\"}")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.categoryId").value(phuKien.toString()));

    assertThat(categoryOf("khan-lua")).isEqualTo(phuKien);
  }

  @Test
  void create_withoutCategory_savesNone() throws Exception {
    postJson("{\"name\":\"Khăn lụa\",\"price\":150000}")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.categoryId").isEmpty());

    assertThat(categoryOf("khan-lua")).isNull();
  }

  @Test
  void create_withAnUnknownCategory_returns400OnCategoryIdAndSavesNothing() throws Exception {
    String unknown = UUID.randomUUID().toString();

    postJson("{\"name\":\"Khăn lụa\",\"price\":150000,\"categoryId\":\"" + unknown + "\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.errors[0].field").value("categoryId"))
        .andExpect(jsonPath("$.errors[0].rejectedValue").value(unknown))
        .andExpect(jsonPath("$.errors[0].message").value("must be an existing category"));

    assertThat(productCount()).isZero();
  }

  // ============================================================
  // The four cases of the edit (Architecture Decisions 7)
  // ============================================================

  @Test
  void update_withoutCategoryId_keepsTheCategory() throws Exception {
    UUID ao = category("Áo", "VISIBLE");
    UUID product = product(ao);

    putJson(product, "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.categoryId").value(ao.toString()));

    assertThat(categoryOf(product)).isEqualTo(ao);
  }

  @Test
  void update_withCategoryIdNull_dropsTheCategory() throws Exception {
    UUID ao = category("Áo", "VISIBLE");
    UUID product = product(ao);

    putJson(product, ",\"categoryId\":null")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.categoryId").isEmpty());

    assertThat(categoryOf(product)).isNull();
  }

  @Test
  void update_withAnotherCategory_movesTheProduct() throws Exception {
    UUID ao = category("Áo", "VISIBLE");
    UUID phuKien = category("Phụ kiện", "HIDDEN");
    UUID product = product(ao);

    putJson(product, ",\"categoryId\":\"" + phuKien + "\"").andExpect(status().isOk());

    assertThat(categoryOf(product)).isEqualTo(phuKien);
    mockMvc
        .perform(get(URL + "/" + product))
        .andExpect(jsonPath("$.categoryId").value(phuKien.toString()));
  }

  @Test
  void update_withAnUnknownCategory_returns400AndWritesNothing() throws Exception {
    UUID ao = category("Áo", "VISIBLE");
    UUID product = product(ao);

    putJson(product, ",\"categoryId\":\"" + UUID.randomUUID() + "\"")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[0].field").value("categoryId"));

    assertThat(categoryOf(product)).isEqualTo(ao);
    assertThat(versionOf(product)).isZero();
  }

  @Test
  void get_ofAProductOfBeforeTheEpic_returnsCategoryIdNull() throws Exception {
    UUID product = product(null);

    mockMvc
        .perform(get(URL + "/" + product))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.categoryId").isEmpty());
  }

  // ============================================================
  // An assign and a delete at once, on two connections (AC10, NFR15)
  // ============================================================

  /**
   * The delete runs first and holds its transaction: the edit passes its check, then its foreign
   * key waits for the delete, which commits, and the edit is the 400 of AC10.
   */
  @Test
  void update_toACategoryDeletedMeanwhile_waitsForTheDeleteThenReturns400() throws Exception {
    UUID phuKien = category("Phụ kiện", "VISIBLE");
    UUID product = product(null);
    CountDownLatch deleted = new CountDownLatch(1);

    CompletableFuture<Void> delete =
        CompletableFuture.runAsync(
            () ->
                transaction.executeWithoutResult(
                    tx -> {
                      jdbc.sql("DELETE FROM app.categories WHERE id = ?").param(phuKien).update();
                      deleted.countDown();
                      sleep(Duration.ofMillis(800));
                    }));
    assertThat(deleted.await(10, TimeUnit.SECONDS)).isTrue();

    putJson(product, ",\"categoryId\":\"" + phuKien + "\"")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.errors[0].field").value("categoryId"))
        .andExpect(jsonPath("$.errors[0].rejectedValue").value(phuKien.toString()))
        .andExpect(jsonPath("$.errors[0].message").value("must be an existing category"));

    delete.get(10, TimeUnit.SECONDS);
    assertThat(categoryOf(product)).isNull();
    assertThat(versionOf(product)).isZero();
  }

  /**
   * The delete runs first and holds its transaction, and the edit sends no {@code categoryId}: the
   * edit waits for the delete, then keeps what the product has by then, no category, as
   * Architecture Decisions 7 says. It never writes back the category it read before the delete
   * committed, which would break {@code products_category_fk} on a field the request did not send.
   */
  @Test
  void update_withoutCategoryId_whileItsCategoryIsDeleted_waitsThenReturns200WithoutCategory()
      throws Exception {
    UUID ao = category("Áo", "VISIBLE");
    UUID product = product(ao);
    CountDownLatch deleted = new CountDownLatch(1);

    CompletableFuture<Void> delete =
        CompletableFuture.runAsync(
            () ->
                transaction.executeWithoutResult(
                    tx -> {
                      jdbc.sql("DELETE FROM app.categories WHERE id = ?").param(ao).update();
                      deleted.countDown();
                      sleep(Duration.ofMillis(800));
                    }));
    assertThat(deleted.await(10, TimeUnit.SECONDS)).isTrue();

    // A new description, so the edit writes the row; and no categoryId.
    putJson(product, ",\"description\":\"Áo cotton.\"")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.description").value("Áo cotton."))
        .andExpect(jsonPath("$.categoryId").isEmpty())
        .andExpect(jsonPath("$.version").value(1));

    delete.get(10, TimeUnit.SECONDS);
    assertThat(categoryOf(product)).isNull();
    assertThat(versionOf(product)).isEqualTo(1);
  }

  /**
   * The assign runs first and holds its transaction: the delete waits for it, then leaves the
   * product without category.
   */
  @Test
  void delete_ofACategoryAssignedMeanwhile_waitsForTheAssignThenEmptiesTheProduct()
      throws Exception {
    UUID phuKien = category("Phụ kiện", "VISIBLE");
    UUID product = product(null);
    CountDownLatch assigned = new CountDownLatch(1);

    CompletableFuture<Void> assign =
        CompletableFuture.runAsync(
            () ->
                transaction.executeWithoutResult(
                    tx -> {
                      jdbc.sql("UPDATE app.products SET category_id = ? WHERE id = ?")
                          .params(phuKien, product)
                          .update();
                      assigned.countDown();
                      sleep(Duration.ofMillis(800));
                    }));
    assertThat(assigned.await(10, TimeUnit.SECONDS)).isTrue();

    mockMvc.perform(delete("/api/admin/categories/" + phuKien)).andExpect(status().isNoContent());

    assign.get(10, TimeUnit.SECONDS);
    assertThat(categoryOf(product)).isNull();
    assertThat(categoryCount()).isZero();
  }

  /** Both at once, many times: whichever wins, no product points to a deleted category. */
  @Test
  void anAssignAndADeleteAtOnce_neverLeaveAProductPointingToADeletedCategory() throws Exception {
    ExecutorService pool = Executors.newFixedThreadPool(2);
    try {
      for (int round = 0; round < 10; round++) {
        UUID category = category("Danh mục " + round, "VISIBLE");
        UUID product = product(null);
        CyclicBarrier start = new CyclicBarrier(2);
        Future<MvcResult> assign =
            pool.submit(
                () -> {
                  start.await(10, TimeUnit.SECONDS);
                  return putJson(product, ",\"categoryId\":\"" + category + "\"").andReturn();
                });
        Future<MvcResult> delete =
            pool.submit(
                () -> {
                  start.await(10, TimeUnit.SECONDS);
                  return mockMvc.perform(delete("/api/admin/categories/" + category)).andReturn();
                });

        int assignStatus = assign.get(30, TimeUnit.SECONDS).getResponse().getStatus();
        assertThat(delete.get(30, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(204);
        assertThat(assignStatus).as("round " + round).isIn(200, 400);
        assertThat(categoryOf(product)).as("round " + round).isNull();
      }
    } finally {
      pool.shutdownNow();
    }
  }

  // ============================================================
  // Helpers
  // ============================================================

  private ResultActions postJson(String body) throws Exception {
    return mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body));
  }

  /** The edit form of SHOP-7 with version 0, and {@code categoryField} as it is. */
  private ResultActions putJson(UUID product, String categoryField) throws Exception {
    return mockMvc.perform(
        put(URL + "/" + product)
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                "{\"name\":\"Áo thun\",\"slug\":\"san-pham-"
                    + slugNumberOf(product)
                    + "\",\"price\":200000,\"status\":\"ACTIVE\",\"availability\":\"IN_STOCK\","
                    + "\"version\":0"
                    + categoryField
                    + "}"));
  }

  private UUID category(String name, String status) {
    sequence++;
    String slug = "danh-muc-" + sequence;
    return transaction.execute(
        tx ->
            jdbc.sql(
                    "INSERT INTO app.categories (name, slug, status) VALUES (?, ?, ?) RETURNING id")
                .params(name, slug, status)
                .query(UUID.class)
                .single());
  }

  private UUID product(UUID categoryId) {
    sequence++;
    String slug = "san-pham-" + sequence;
    return transaction.execute(
        tx ->
            jdbc.sql(
                    "INSERT INTO app.products (name, slug, price_vnd, category_id)"
                        + " VALUES ('Áo thun', ?, 200000, ?) RETURNING id")
                .params(slug, categoryId)
                .query(UUID.class)
                .single());
  }

  private String slugNumberOf(UUID product) {
    return transaction
        .execute(
            tx ->
                jdbc.sql("SELECT slug::text FROM app.products WHERE id = ?")
                    .param(product)
                    .query(String.class)
                    .single())
        .substring("san-pham-".length());
  }

  private UUID categoryOf(UUID product) {
    return transaction.execute(
        tx ->
            jdbc.sql("SELECT category_id FROM app.products WHERE id = ?")
                .param(product)
                .query(UUID.class)
                .optional()
                .orElse(null));
  }

  private UUID categoryOf(String slug) {
    return transaction.execute(
        tx ->
            jdbc.sql("SELECT category_id FROM app.products WHERE slug::text = ?")
                .param(slug)
                .query(UUID.class)
                .optional()
                .orElse(null));
  }

  private long versionOf(UUID product) {
    return transaction.execute(
        tx ->
            jdbc.sql("SELECT version FROM app.products WHERE id = ?")
                .param(product)
                .query(Long.class)
                .single());
  }

  private long productCount() {
    return transaction.execute(
        tx -> jdbc.sql("SELECT count(*) FROM app.products").query(Long.class).single());
  }

  private long categoryCount() {
    return transaction.execute(
        tx -> jdbc.sql("SELECT count(*) FROM app.categories").query(Long.class).single());
  }

  private static void sleep(Duration duration) {
    try {
      Thread.sleep(duration);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(e);
    }
  }

  private void deleteAll() {
    transaction.executeWithoutResult(
        tx -> {
          jdbc.sql("DELETE FROM app.products").update();
          jdbc.sql("DELETE FROM app.categories").update();
        });
  }
}
