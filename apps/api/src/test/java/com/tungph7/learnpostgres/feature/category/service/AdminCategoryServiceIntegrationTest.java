package com.tungph7.learnpostgres.feature.category.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
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
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;
import com.tungph7.learnpostgres.common.error.BusinessException;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.feature.category.domain.Category.CategoryStatus;
import com.tungph7.learnpostgres.feature.category.dto.AdminCategory;
import com.tungph7.learnpostgres.feature.category.dto.CreateCategoryRequest;
import com.tungph7.learnpostgres.feature.category.repository.CategoryRepository;

/**
 * {@code GET} and {@code POST /api/admin/categories} on the real database (Testcontainers
 * PostgreSQL 17, schema V7), SHOP-82 step 5: what is saved (AC2), the generated slug and its suffix
 * {@code -2}, the 409s of AC4, two adds of the same name at once (NFR11: the UNIQUE constraint is
 * the last guard) and the INFO log of an add.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class AdminCategoryServiceIntegrationTest extends AbstractContainerBaseTest {

  private static final String URL = "/api/admin/categories";

  @Autowired MockMvc mockMvc;
  @Autowired AdminCategoryService service;
  @Autowired DataSource dataSource;
  @Autowired PlatformTransactionManager transactionManager;

  /** A spy, so one test can make the check for a free slug miss a category added meanwhile. */
  @MockitoSpyBean CategoryRepository repository;

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
  // What is saved (AC2)
  // ============================================================

  @Test
  void create_withoutSlug_generatesItFromTheNameAndListsTheCategory() throws Exception {
    postJson("{\"name\":\"Áo khoác nữ\"}")
        .andExpect(status().isCreated())
        .andExpect(header().string("Location", org.hamcrest.Matchers.startsWith(URL + "/")))
        .andExpect(jsonPath("$.name").value("Áo khoác nữ"))
        .andExpect(jsonPath("$.slug").value("ao-khoac-nu"))
        .andExpect(jsonPath("$.status").value("VISIBLE"))
        .andExpect(jsonPath("$.version").value(0));

    mockMvc
        .perform(get(URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].name").value("Áo khoác nữ"))
        .andExpect(jsonPath("$.items[0].status").value("VISIBLE"))
        .andExpect(jsonPath("$.items[0].productCount").value(0));
  }

  @Test
  void create_savesTheTypedSlugAndTheStatusGiven() {
    AdminCategory category =
        service.create(new CreateCategoryRequest("Phụ kiện", "phu-kien-2026", null, null));
    AdminCategory hidden =
        service.create(new CreateCategoryRequest("Khăn", null, CategoryStatus.HIDDEN, null));

    assertThat(category.slug()).isEqualTo("phu-kien-2026");
    assertThat(category.status().name()).isEqualTo("VISIBLE");
    assertThat(hidden.status().name()).isEqualTo("HIDDEN");
    String stored =
        transaction.execute(
            tx ->
                jdbc.sql("SELECT status FROM app.categories WHERE id = ?")
                    .param(hidden.id())
                    .query(String.class)
                    .single());
    assertThat(stored).isEqualTo("HIDDEN");
  }

  @Test
  void create_withANameOfSymbolsOnly_usesDanhMuc() {
    assertThat(service.create(new CreateCategoryRequest("!!!", null, null, null)).slug())
        .isEqualTo("danh-muc");
  }

  @Test
  void create_withAnInvalidBody_savesNothing() throws Exception {
    postJson("{\"name\":\"\",\"slug\":\"AO\"}").andExpect(status().isBadRequest());

    assertThat(count()).isZero();
  }

  // ============================================================
  // AC4
  // ============================================================

  @Test
  void create_withANameTakenInOtherCase_returns409NameAndSavesNothing() throws Exception {
    service.create(new CreateCategoryRequest("Áo thun", null, null, null));

    postJson("{\"name\":\"Áo Thun\"}")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("CATEGORY_NAME_DUPLICATED"))
        .andExpect(jsonPath("$.detail").value("Category name already exists."));

    assertThat(count()).isEqualTo(1);
  }

  @Test
  void create_withTheNameWithoutAccents_isAnotherNameAndTakesTheSuffix2() {
    service.create(new CreateCategoryRequest("Áo thun", null, null, null));

    AdminCategory other = service.create(new CreateCategoryRequest("Ao thun", null, null, null));

    assertThat(other.slug()).isEqualTo("ao-thun-2");
  }

  @Test
  void create_withATypedSlugTaken_returns409SlugAndSavesNothing() throws Exception {
    service.create(new CreateCategoryRequest("Áo thun", null, null, null));

    postJson("{\"name\":\"Áo phông\",\"slug\":\"ao-thun\"}")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("CATEGORY_SLUG_DUPLICATED"))
        .andExpect(jsonPath("$.detail").value("Category slug already exists."));

    assertThat(count()).isEqualTo(1);
  }

  @Test
  void create_checksTheNameBeforeTheSlug() throws Exception {
    service.create(new CreateCategoryRequest("Áo thun", null, null, null));

    postJson("{\"name\":\"ÁO THUN\",\"slug\":\"ao-thun\"}")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("CATEGORY_NAME_DUPLICATED"));
  }

  @Test
  void create_takesTheFirstFreeSuffix() {
    insert("Áo thun cũ", "ao-thun");
    insert("Áo thun 2", "ao-thun-2");
    insert("Áo thun 4", "ao-thun-4");

    assertThat(service.create(new CreateCategoryRequest("Áo  thun", null, null, null)).slug())
        .isEqualTo("ao-thun-3");
  }

  @Test
  void create_whenATypedSlugIsTakenAfterTheCheck_returns409FromTheUniqueConstraint()
      throws Exception {
    service.create(new CreateCategoryRequest("Áo thun", null, null, null));
    doReturn(false).when(repository).existsBySlug("ao-thun");

    postJson("{\"name\":\"Áo phông\",\"slug\":\"ao-thun\"}")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("CATEGORY_SLUG_DUPLICATED"));

    assertThat(count()).isEqualTo(1);
  }

  @Test
  void create_whenTheGeneratedSlugIsTakenAfterTheCheck_retriesWithTheNextNumber() {
    service.create(new CreateCategoryRequest("Áo thun", null, null, null));
    missTheTakenSlugsOnce();

    AdminCategory other = service.create(new CreateCategoryRequest("Ao thun", null, null, null));

    assertThat(other.slug()).isEqualTo("ao-thun-2");
    assertThat(count()).isEqualTo(2);
  }

  // ============================================================
  // Two adds of the same name at once (NFR11, NFR12)
  // ============================================================

  @Test
  void create_twoAddsAtOnceWithTheSameName_saveOneAndAnswer409NameToTheOther() throws Exception {
    ExecutorService pool = Executors.newFixedThreadPool(2);
    try {
      for (int round = 0; round < 5; round++) {
        String name = "Đầm maxi " + round;
        CyclicBarrier start = new CyclicBarrier(2);
        List<Future<Object>> adds =
            List.of(
                pool.submit(() -> createAfter(start, name)),
                pool.submit(() -> createAfter(start, name)));

        List<Object> outcomes = new ArrayList<>();
        for (Future<Object> add : adds) {
          outcomes.add(add.get(30, TimeUnit.SECONDS));
        }

        assertThat(outcomes).filteredOn(AdminCategory.class::isInstance).hasSize(1);
        assertThat(outcomes)
            .filteredOn(ErrorCode.class::isInstance)
            .containsExactly(ErrorCode.CATEGORY_NAME_DUPLICATED);
      }
    } finally {
      pool.shutdownNow();
    }
    assertThat(count()).isEqualTo(5);
  }

  // ============================================================
  // Log (NFR11)
  // ============================================================

  @Test
  void create_logsTheOperationIdSlugAndCorrelationIdButNotTheRequest(CapturedOutput output)
      throws Exception {
    mockMvc
        .perform(
            post(URL)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Correlation-Id", "corr-shop82-create")
                .header("Authorization", "Basic c2VjcmV0LXVzZXI6c2VjcmV0LXBhc3M=")
                .content("{\"name\":\"Áo khoác SHOP82\"}"))
        .andExpect(status().isCreated());

    String line =
        output
            .getOut()
            .lines()
            .filter(l -> l.contains("Category created"))
            .collect(Collectors.joining("\n"));
    assertThat(line)
        .contains("operation=create")
        .contains("slug=ao-khoac-shop82")
        .contains("correlationId=corr-shop82-create")
        .containsPattern("id=[0-9a-f-]{36}")
        .doesNotContain("Áo khoác SHOP82")
        .doesNotContain("c2VjcmV0");
  }

  // ============================================================
  // The display order (SHOP-95: AC1, AC4, NFR7)
  // ============================================================

  @Test
  void create_withoutDisplayOrder_savesZero_andTheListReturnsIt() throws Exception {
    postJson("{\"name\":\"Áo khoác\"}")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.displayOrder").value(0));

    assertThat(displayOrderOf("Áo khoác")).isZero();
    mockMvc
        .perform(get(URL))
        .andExpect(jsonPath("$.items[0].name").value("Áo khoác"))
        .andExpect(jsonPath("$.items[0].displayOrder").value(0));
  }

  @Test
  void create_withANullDisplayOrder_savesZero() throws Exception {
    postJson("{\"name\":\"Áo khoác\",\"displayOrder\":null}")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.displayOrder").value(0));

    assertThat(displayOrderOf("Áo khoác")).isZero();
  }

  @Test
  void create_withDisplayOrder5_saves5() throws Exception {
    postJson("{\"name\":\"Áo khoác\",\"displayOrder\":5}")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.displayOrder").value(5));

    assertThat(displayOrderOf("Áo khoác")).isEqualTo(5);
  }

  @Test
  void create_withDisplayOrder9999AndATypedSlug_saves9999() {
    AdminCategory saved =
        service.create(
            new CreateCategoryRequest(
                "Áo khoác", "ao-khoac", null, new java.math.BigDecimal("9999")));

    assertThat(saved.displayOrder()).isEqualTo(9999);
    assertThat(displayOrderOf("Áo khoác")).isEqualTo(9999);
  }

  @Test
  void create_withAWrongDisplayOrder_savesNothing() throws Exception {
    for (String displayOrder : List.of("-1", "10000", "1.5", "99999999999", "\"abc\"")) {
      postJson("{\"name\":\"Áo khoác\",\"displayOrder\":" + displayOrder + "}")
          .andExpect(status().isBadRequest());
    }

    assertThat(count()).isZero();
  }

  @Test
  void list_sortsByDisplayOrderThenName() throws Exception {
    for (String body :
        List.of(
            "{\"name\":\"Áo\",\"displayOrder\":2}",
            "{\"name\":\"Đầm\",\"displayOrder\":1,\"status\":\"HIDDEN\"}",
            "{\"name\":\"Quần\"}",
            "{\"name\":\"Bao tay\",\"displayOrder\":1}")) {
      postJson(body).andExpect(status().isCreated());
    }

    mockMvc
        .perform(get(URL))
        .andExpect(
            jsonPath(
                "$.items[*].name", org.hamcrest.Matchers.contains("Quần", "Bao tay", "Đầm", "Áo")))
        .andExpect(jsonPath("$.items[*].displayOrder", org.hamcrest.Matchers.contains(0, 1, 1, 2)));
  }

  // ============================================================
  // Helpers
  // ============================================================

  private int displayOrderOf(String name) {
    return transaction.execute(
        tx ->
            jdbc.sql("SELECT display_order FROM app.categories WHERE name = ?")
                .param(name)
                .query(Integer.class)
                .single());
  }

  private ResultActions postJson(String body) throws Exception {
    return mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body));
  }

  /** The category, or the code of the business error the add answered with. */
  private Object createAfter(CyclicBarrier start, String name) throws Exception {
    start.await(30, TimeUnit.SECONDS);
    try {
      return service.create(new CreateCategoryRequest(name, null, null, null));
    } catch (BusinessException e) {
      return e.getCode();
    }
  }

  private void insert(String name, String slug) {
    transaction.executeWithoutResult(
        tx ->
            jdbc.sql("INSERT INTO app.categories (name, slug) VALUES (?, ?)")
                .params(name, slug)
                .update());
  }

  /**
   * Makes the first read of the taken slugs see every slug free, as when the other add has not
   * committed yet; the next reads see the database.
   */
  private void missTheTakenSlugsOnce() {
    doReturn(List.of())
        .doAnswer(invocation -> slugsAmong(invocation.getArgument(0)))
        .when(repository)
        .findSlugsAmong(any(String[].class));
  }

  private List<String> slugsAmong(String[] slugs) {
    return transaction.execute(
        tx ->
            jdbc.sql("SELECT slug::text FROM app.categories WHERE lower(slug::text) IN (:slugs)")
                .param("slugs", Arrays.asList(slugs))
                .query(String.class)
                .list());
  }

  private long count() {
    return transaction.execute(
        tx -> jdbc.sql("SELECT count(*) FROM app.categories").query(Long.class).single());
  }

  private void deleteAll() {
    transaction.executeWithoutResult(
        tx -> {
          jdbc.sql("DELETE FROM app.products").update();
          jdbc.sql("DELETE FROM app.categories").update();
        });
  }
}
