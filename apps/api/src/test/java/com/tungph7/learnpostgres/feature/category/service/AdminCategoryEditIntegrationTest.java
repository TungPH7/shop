package com.tungph7.learnpostgres.feature.category.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;
import com.tungph7.learnpostgres.common.error.BusinessException;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.feature.category.domain.Category.CategoryStatus;
import com.tungph7.learnpostgres.feature.category.dto.AdminCategory;
import com.tungph7.learnpostgres.feature.category.dto.UpdateCategoryRequest;

/**
 * {@code GET}, {@code PUT} and {@code DELETE /api/admin/categories/{id}} on the real database
 * (Testcontainers PostgreSQL 17, schema V7), SHOP-82 step 6: the order of the checks of an edit,
 * two edits at once (NFR12), the delete of a category with products (AC8, NFR15), the idempotent
 * delete and the INFO logs (NFR11).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class AdminCategoryEditIntegrationTest extends AbstractContainerBaseTest {

  private static final String URL = "/api/admin/categories/";

  @Autowired MockMvc mockMvc;
  @Autowired AdminCategoryService service;
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
  // GET
  // ============================================================

  @Test
  void get_returnsAHiddenCategoryToo() throws Exception {
    UUID id = insertCategory("Phụ kiện", "phu-kien", "HIDDEN");

    mockMvc
        .perform(get(URL + id))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Phụ kiện"))
        .andExpect(jsonPath("$.status").value("HIDDEN"))
        .andExpect(jsonPath("$.version").value(0));
  }

  @Test
  void get_ofAnUnknownId_returns404() throws Exception {
    mockMvc
        .perform(get(URL + UUID.randomUUID()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("CATEGORY_NOT_FOUND"))
        .andExpect(jsonPath("$.detail").value("Category not found."));
  }

  // ============================================================
  // PUT (AC5, NFR12)
  // ============================================================

  @Test
  void update_ofTheName_keepsTheSlugAndReturnsTheNewVersion() throws Exception {
    UUID id = insertCategory("Áo", "ao", "VISIBLE");

    putJson(id, "Áo nam", "ao", "VISIBLE", 0)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Áo nam"))
        .andExpect(jsonPath("$.slug").value("ao"))
        .andExpect(jsonPath("$.version").value(1));
  }

  @Test
  void update_returnsTheUpdatedAtALaterReadShows() throws Exception {
    UUID id = insertCategory("Áo", "ao", "VISIBLE");

    String updatedAt =
        com.jayway.jsonpath.JsonPath.read(
            putJson(id, "Áo", "ao", "HIDDEN", 0).andReturn().getResponse().getContentAsString(),
            "$.updatedAt");

    mockMvc.perform(get(URL + id)).andExpect(jsonPath("$.updatedAt").value(updatedAt));
  }

  @Test
  void update_ofTheSlugAndStatus_savesThem() {
    UUID id = insertCategory("Áo", "ao", "VISIBLE");

    AdminCategory updated =
        service.update(
            id, new UpdateCategoryRequest("Áo", "ao-nam", CategoryStatus.HIDDEN, null, 0L));

    assertThat(updated.slug()).isEqualTo("ao-nam");
    assertThat(updated.status()).isEqualTo(CategoryStatus.HIDDEN);
    assertThat(column(id, "slug::text")).isEqualTo("ao-nam");
    assertThat(column(id, "status")).isEqualTo("HIDDEN");
  }

  @Test
  void update_ofItsOwnNameInAnotherCase_isNotADuplicate() throws Exception {
    UUID id = insertCategory("áo", "ao", "VISIBLE");

    putJson(id, "Áo", "ao", "VISIBLE", 0)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Áo"));
  }

  @Test
  void update_ofAnUnknownCategory_returns404() throws Exception {
    putJson(UUID.randomUUID(), "Áo", "ao", "VISIBLE", 0)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("CATEGORY_NOT_FOUND"));
  }

  @Test
  void update_withAnOldVersion_returns409AndWritesNothing() throws Exception {
    UUID id = insertCategory("Áo", "ao", "VISIBLE");
    service.update(id, new UpdateCategoryRequest("Áo nam", "ao", CategoryStatus.VISIBLE, null, 0L));

    putJson(id, "Áo nữ", "ao-nu", "HIDDEN", 0)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));

    assertThat(column(id, "name")).isEqualTo("Áo nam");
    assertThat(column(id, "version")).isEqualTo("1");
  }

  @Test
  void update_toTheNameOfAnotherCategoryInOtherCase_returns409Name() throws Exception {
    insertCategory("Quần", "quan", "VISIBLE");
    UUID id = insertCategory("Áo", "ao", "VISIBLE");

    putJson(id, "QUẦN", "ao", "VISIBLE", 0)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("CATEGORY_NAME_DUPLICATED"));
  }

  @Test
  void update_toTheSlugOfAnotherCategory_returns409Slug() throws Exception {
    insertCategory("Quần", "quan", "VISIBLE");
    UUID id = insertCategory("Áo", "ao", "VISIBLE");

    putJson(id, "Áo", "quan", "VISIBLE", 0)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("CATEGORY_SLUG_DUPLICATED"));
  }

  @Test
  void update_checksTheVersionBeforeTheNameAndTheNameBeforeTheSlug() throws Exception {
    insertCategory("Quần", "quan", "VISIBLE");
    UUID id = insertCategory("Áo", "ao", "VISIBLE");

    putJson(id, "Quần", "quan", "VISIBLE", 7)
        .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));
    putJson(id, "Quần", "quan", "VISIBLE", 0)
        .andExpect(jsonPath("$.code").value("CATEGORY_NAME_DUPLICATED"));
  }

  @Test
  void update_twoEditsAtOnceWithTheSameVersion_saveOneAndAnswer409ToTheOther() throws Exception {
    ExecutorService pool = Executors.newFixedThreadPool(2);
    try {
      for (int round = 0; round < 5; round++) {
        String slug = "ao-" + round;
        String nameA = "Áo A " + round;
        String nameB = "Áo B " + round;
        UUID id = insertCategory("Áo " + round, slug, "VISIBLE");
        CyclicBarrier start = new CyclicBarrier(2);
        List<Future<Object>> edits =
            List.of(
                pool.submit(() -> updateAfter(start, id, nameA, slug)),
                pool.submit(() -> updateAfter(start, id, nameB, slug)));

        List<Object> outcomes = new ArrayList<>();
        for (Future<Object> edit : edits) {
          outcomes.add(edit.get(30, TimeUnit.SECONDS));
        }

        assertThat(outcomes).filteredOn(AdminCategory.class::isInstance).hasSize(1);
        assertThat(outcomes)
            .filteredOn(o -> !(o instanceof AdminCategory))
            .containsExactly("OPTIMISTIC_LOCK_CONFLICT");
        assertThat(column(id, "version")).isEqualTo("1");
      }
    } finally {
      pool.shutdownNow();
    }
  }

  @Test
  void update_logsTheOperationIdSlugAndCorrelationId(CapturedOutput output) throws Exception {
    UUID id = insertCategory("Áo", "ao", "VISIBLE");

    mockMvc
        .perform(
            put(URL + id)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Correlation-Id", "corr-shop82-update")
                .content(body("Áo nam SHOP82", "ao", "VISIBLE", 0)))
        .andExpect(status().isOk());

    assertThat(appLogLine(output, "Category updated"))
        .contains("operation=update")
        .contains("id=" + id)
        .contains("slug=ao")
        .contains("correlationId=corr-shop82-update")
        .doesNotContain("Áo nam SHOP82");
  }

  // ============================================================
  // DELETE (AC7, AC8, NFR12, NFR15)
  // ============================================================

  @Test
  void delete_ofACategoryWithProducts_leavesThemWithoutCategoryAndChangesNothingElse()
      throws Exception {
    UUID ao = insertCategory("Áo", "ao", "VISIBLE");
    UUID onSale = insertProduct("Áo thun cổ tròn", "ACTIVE", ao, 2);
    UUID hidden = insertProduct("Áo len", "HIDDEN", ao, 5);
    Map<String, Object> onSaleBefore = productWithoutUpdatedAt(onSale);
    Map<String, Object> hiddenBefore = productWithoutUpdatedAt(hidden);

    mockMvc.perform(delete(URL + ao)).andExpect(status().isNoContent());

    mockMvc.perform(get(URL + ao)).andExpect(status().isNotFound());
    onSaleBefore.put("category_id", null);
    hiddenBefore.put("category_id", null);
    assertThat(productWithoutUpdatedAt(onSale)).isEqualTo(onSaleBefore);
    assertThat(productWithoutUpdatedAt(hidden)).isEqualTo(hiddenBefore);
  }

  @Test
  void delete_twiceInARow_returns204BothTimesAndLogsAlreadyGone(CapturedOutput output)
      throws Exception {
    UUID ao = insertCategory("Áo", "ao", "VISIBLE");
    insertProduct("Áo thun cổ tròn", "ACTIVE", ao, 0);
    insertProduct("Áo len", "HIDDEN", ao, 0);

    mockMvc
        .perform(delete(URL + ao).header("X-Correlation-Id", "corr-shop82-delete"))
        .andExpect(status().isNoContent());
    mockMvc.perform(delete(URL + ao)).andExpect(status().isNoContent());

    assertThat(appLogLine(output, "Category deleted"))
        .contains("operation=delete")
        .contains("id=" + ao)
        .contains("slug=ao")
        .contains("productCount=2")
        .contains("correlationId=corr-shop82-delete");
    assertThat(appLogLine(output, "Category already gone"))
        .contains("operation=delete")
        .contains("id=" + ao);
  }

  @Test
  void delete_freesTheSlugForANewCategory() throws Exception {
    UUID ao = insertCategory("Phụ kiện", "phu-kien", "VISIBLE");

    mockMvc.perform(delete(URL + ao)).andExpect(status().isNoContent());

    mockMvc
        .perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(
                    "/api/admin/categories")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Phụ kiện\",\"slug\":\"phu-kien\"}"))
        .andExpect(status().isCreated());
  }

  // ============================================================
  // The display order (SHOP-95: AC2, AC4, NFR12, NFR13)
  // ============================================================

  @Test
  void update_ofTheNameWithoutDisplayOrder_keepsTheStoredNumber() throws Exception {
    UUID id = insertCategory("Áo", "ao", "VISIBLE", 7);

    putJson(id, "Áo nam", "ao", "VISIBLE", 0)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Áo nam"))
        .andExpect(jsonPath("$.displayOrder").value(7));

    assertThat(column(id, "name")).isEqualTo("Áo nam");
    assertThat(column(id, "display_order")).isEqualTo("7");
  }

  @Test
  void update_ofTheNameWithANullDisplayOrder_keepsTheStoredNumber() throws Exception {
    UUID id = insertCategory("Áo", "ao", "VISIBLE", 7);

    putJson(id, "Áo nam", "ao", "VISIBLE", "null", 0)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.displayOrder").value(7));

    assertThat(column(id, "display_order")).isEqualTo("7");
  }

  @Test
  void update_withDisplayOrderZero_setsZero() throws Exception {
    UUID id = insertCategory("Áo", "ao", "VISIBLE", 7);

    putJson(id, "Áo", "ao", "VISIBLE", "0", 0)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.displayOrder").value(0));

    assertThat(column(id, "display_order")).isEqualTo("0");
  }

  @Test
  void update_ofTheDisplayOrderOnly_movesTheVersionAndTheUpdatedAt() throws Exception {
    UUID id = insertCategory("Áo", "ao", "VISIBLE", 2);
    String updatedAtBefore = column(id, "updated_at");

    putJson(id, "Áo", "ao", "VISIBLE", "9999", 0)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.displayOrder").value(9999))
        .andExpect(jsonPath("$.version").value(1));

    assertThat(column(id, "display_order")).isEqualTo("9999");
    assertThat(column(id, "version")).isEqualTo("1");
    assertThat(column(id, "(updated_at > '" + updatedAtBefore + "'::timestamptz)"))
        .as("NFR13")
        .isEqualTo("true");
  }

  @Test
  void update_twoEditsOfTheDisplayOrderWithTheSameVersion_answer409ToTheLater() throws Exception {
    UUID id = insertCategory("Áo", "ao", "VISIBLE", 2);

    putJson(id, "Áo", "ao", "VISIBLE", "5", 0).andExpect(status().isOk());
    putJson(id, "Áo", "ao", "VISIBLE", "8", 0)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));

    assertThat(column(id, "display_order")).isEqualTo("5");
  }

  @Test
  void update_twoEditsOfTheDisplayOrderAtOnce_saveOneAndAnswer409ToTheOther() throws Exception {
    ExecutorService pool = Executors.newFixedThreadPool(2);
    try {
      for (int round = 0; round < 5; round++) {
        String slug = "ao-" + round;
        UUID id = insertCategory("Áo " + round, slug, "VISIBLE", 2);
        CyclicBarrier start = new CyclicBarrier(2);
        String name = "Áo " + round;
        List<Future<Object>> edits =
            List.of(
                pool.submit(() -> updateOrderAfter(start, id, name, slug, 5)),
                pool.submit(() -> updateOrderAfter(start, id, name, slug, 8)));

        List<Object> outcomes = new ArrayList<>();
        for (Future<Object> edit : edits) {
          outcomes.add(edit.get(30, TimeUnit.SECONDS));
        }

        assertThat(outcomes).filteredOn(AdminCategory.class::isInstance).hasSize(1);
        assertThat(outcomes)
            .filteredOn(o -> !(o instanceof AdminCategory))
            .containsExactly("OPTIMISTIC_LOCK_CONFLICT");
        assertThat(column(id, "version")).isEqualTo("1");
      }
    } finally {
      pool.shutdownNow();
    }
  }

  @Test
  void update_withAWrongDisplayOrder_writesNothing() throws Exception {
    UUID id = insertCategory("Áo", "ao", "VISIBLE", 7);

    for (String displayOrder : List.of("-1", "10000", "1.5", "99999999999", "\"abc\"")) {
      putJson(id, "Áo nam", "ao", "VISIBLE", displayOrder, 0).andExpect(status().isBadRequest());
    }

    assertThat(column(id, "name")).isEqualTo("Áo");
    assertThat(column(id, "display_order")).isEqualTo("7");
    assertThat(column(id, "version")).isEqualTo("0");
  }

  // ============================================================
  // Helpers
  // ============================================================

  /** The body of an edit with {@code "displayOrder": displayOrderJson}. */
  private ResultActions putJson(
      UUID id, String name, String slug, String status, String displayOrderJson, long version)
      throws Exception {
    String body =
        "{\"name\":\"%s\",\"slug\":\"%s\",\"status\":\"%s\",\"displayOrder\":%s,\"version\":%d}"
            .formatted(name, slug, status, displayOrderJson, version);
    return mockMvc.perform(put(URL + id).contentType(MediaType.APPLICATION_JSON).content(body));
  }

  /** The category, or the code of the error an edit of only the display order answered with. */
  private Object updateOrderAfter(
      CyclicBarrier start, UUID id, String name, String slug, int displayOrder) throws Exception {
    start.await(30, TimeUnit.SECONDS);
    try {
      return service.update(
          id,
          new UpdateCategoryRequest(
              name, slug, CategoryStatus.VISIBLE, BigDecimal.valueOf(displayOrder), 0L));
    } catch (BusinessException e) {
      return e.getCode().name();
    } catch (org.springframework.orm.ObjectOptimisticLockingFailureException e) {
      return ErrorCode.OPTIMISTIC_LOCK_CONFLICT.name();
    }
  }

  private UUID insertCategory(String name, String slug, String status, int displayOrder) {
    return transaction.execute(
        tx ->
            jdbc.sql(
                    "INSERT INTO app.categories (name, slug, status, display_order)"
                        + " VALUES (?, ?, ?, ?) RETURNING id")
                .params(name, slug, status, displayOrder)
                .query(UUID.class)
                .single());
  }

  private ResultActions putJson(UUID id, String name, String slug, String status, long version)
      throws Exception {
    return mockMvc.perform(
        put(URL + id)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body(name, slug, status, version)));
  }

  private static String body(String name, String slug, String status, long version) {
    return "{\"name\":\"%s\",\"slug\":\"%s\",\"status\":\"%s\",\"version\":%d}"
        .formatted(name, slug, status, version);
  }

  /** The category, or the code of the business error the edit answered with. */
  private Object updateAfter(CyclicBarrier start, UUID id, String name, String slug)
      throws Exception {
    start.await(30, TimeUnit.SECONDS);
    try {
      return service.update(
          id, new UpdateCategoryRequest(name, slug, CategoryStatus.VISIBLE, null, 0L));
    } catch (BusinessException e) {
      return e.getCode().name();
    } catch (org.springframework.orm.ObjectOptimisticLockingFailureException e) {
      return ErrorCode.OPTIMISTIC_LOCK_CONFLICT.name();
    }
  }

  private UUID insertCategory(String name, String slug, String status) {
    return transaction.execute(
        tx ->
            jdbc.sql(
                    "INSERT INTO app.categories (name, slug, status) VALUES (?, ?, ?) RETURNING id")
                .params(name, slug, status)
                .query(UUID.class)
                .single());
  }

  private UUID insertProduct(String name, String status, UUID categoryId, long version) {
    sequence++;
    UUID id = UUID.randomUUID();
    transaction.executeWithoutResult(
        tx ->
            jdbc.sql(
                    """
INSERT INTO app.products
    (id, name, slug, description, price_vnd, compare_at_price_vnd, status,
     availability, version, category_id, created_at, updated_at)
VALUES (?, ?, ?, 'Mô tả.', 250000, 300000, ?, 'OUT_OF_STOCK', ?, ?,
        TIMESTAMPTZ '2026-11-14 01:00:00+00', TIMESTAMPTZ '2026-11-14 02:00:00+00')
""")
                .params(id, name, "san-pham-" + sequence, status, version, categoryId)
                .update());
    return id;
  }

  /** Every column of a product but {@code updated_at}, which the delete moves (NFR15). */
  private Map<String, Object> productWithoutUpdatedAt(UUID id) {
    Map<String, Object> row =
        transaction.execute(
            tx ->
                jdbc.sql("SELECT * FROM app.products WHERE id = ?").param(id).query().singleRow());
    Map<String, Object> copy = new LinkedHashMap<>(row);
    copy.remove("updated_at");
    return copy;
  }

  private String column(UUID id, String expression) {
    return transaction.execute(
        tx ->
            jdbc.sql("SELECT " + expression + "::text FROM app.categories WHERE id = ?")
                .param(id)
                .query(String.class)
                .single());
  }

  /** The lines of the app log, not of Hibernate, that hold {@code text}. */
  private static String appLogLine(CapturedOutput output, String text) {
    return output
        .getOut()
        .lines()
        .filter(line -> !line.contains("\"logger\":\"org.hibernate."))
        .filter(line -> line.contains(text))
        .collect(Collectors.joining("\n"));
  }

  private void deleteAll() {
    transaction.executeWithoutResult(
        tx -> {
          jdbc.sql("DELETE FROM app.products").update();
          jdbc.sql("DELETE FROM app.categories").update();
        });
  }
}
