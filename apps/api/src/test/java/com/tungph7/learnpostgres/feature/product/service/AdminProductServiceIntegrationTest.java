package com.tungph7.learnpostgres.feature.product.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesPattern;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Arrays;
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
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.jayway.jsonpath.JsonPath;
import com.tungph7.learnpostgres.AbstractContainerBaseTest;
import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.dto.AdminProduct;
import com.tungph7.learnpostgres.feature.product.dto.CreateProductRequest;
import com.tungph7.learnpostgres.feature.product.repository.ProductRepository;

/**
 * {@code POST /api/admin/products} on the real database (Testcontainers PostgreSQL 17, schema V4):
 * what is saved, the generated slug with its suffixes {@code -2}, {@code -3} (AC8), the 409 of a
 * typed slug already taken, two adds at once that generate the same slug (NFR12: the UNIQUE
 * constraint is the last guard) and the INFO log of each add.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class AdminProductServiceIntegrationTest extends AbstractContainerBaseTest {

  private static final String URL = "/api/admin/products";

  /** An ISO-8601 instant in UTC with exactly three digits of milliseconds, as the API Contract. */
  private static final String CONTRACT_INSTANT =
      "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z";

  @Autowired MockMvc mockMvc;
  @Autowired AdminProductService service;
  @Autowired DataSource dataSource;
  @Autowired PlatformTransactionManager transactionManager;

  /** A spy, so one test can make the check for a free slug miss a product added meanwhile. */
  @MockitoSpyBean ProductRepository repository;

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
  // What is saved
  // ============================================================

  @Test
  void create_savesTheProductWithItsDefaultsAndReturnsIt() throws Exception {
    String body =
        "{\"name\":\"  Áo thun cổ tròn \",\"description\":\"Áo thun cotton 100%.\\nCổ tròn,"
            + " tay ngắn.\",\"price\":200000,\"compareAtPrice\":250000}";

    String location =
        postJson(body)
            .andExpect(status().isCreated())
            .andExpect(header().exists("X-Correlation-Id"))
            .andExpect(jsonPath("$.name").value("Áo thun cổ tròn"))
            .andExpect(jsonPath("$.slug").value("ao-thun-co-tron"))
            .andExpect(jsonPath("$.price").value(200000))
            .andExpect(jsonPath("$.compareAtPrice").value(250000))
            .andExpect(jsonPath("$.status").value("ACTIVE"))
            .andExpect(jsonPath("$.availability").value("IN_STOCK"))
            .andExpect(jsonPath("$.createdAt").value(matchesPattern(CONTRACT_INSTANT)))
            .andExpect(jsonPath("$.updatedAt").value(matchesPattern(CONTRACT_INSTANT)))
            .andExpect(jsonPath("$.version").value(0))
            .andReturn()
            .getResponse()
            .getHeader("Location");

    UUID id = UUID.fromString(location.substring((URL + "/").length()));
    Map<String, Object> row =
        jdbc.sql(
                "SELECT name, slug::text AS slug, description, price_vnd, compare_at_price_vnd,"
                    + " price, status, availability FROM app.products WHERE id = :id")
            .param("id", id)
            .query()
            .singleRow();
    assertThat(row)
        .containsEntry("name", "Áo thun cổ tròn")
        .containsEntry("slug", "ao-thun-co-tron")
        .containsEntry("description", "Áo thun cotton 100%.\nCổ tròn, tay ngắn.")
        .containsEntry("price_vnd", 200_000L)
        .containsEntry("compare_at_price_vnd", 250_000L)
        .containsEntry("status", "ACTIVE")
        .containsEntry("availability", "IN_STOCK");
    // The legacy column follows price_vnd (trigger of V4), so v0.2.0 reads it after a rollback.
    assertThat((BigDecimal) row.get("price")).isEqualByComparingTo("200000");
  }

  @Test
  void save_holdsTheInstantsTheDatabaseKeeps() {
    for (int round = 0; round < 20; round++) {
      Product product =
          repository.saveAndFlush(
              new Product(
                  "Instant " + round,
                  "instant-" + round,
                  null,
                  1L,
                  null,
                  ProductStatus.ACTIVE,
                  ProductAvailability.IN_STOCK));

      Map<String, Object> row =
          transaction.execute(
              status ->
                  jdbc.sql("SELECT created_at, updated_at FROM app.products WHERE id = :id")
                      .param("id", product.getId())
                      .query()
                      .singleRow());
      assertThat(product.getCreatedAt()).isEqualTo(instantOf(row.get("created_at")));
      assertThat(product.getUpdatedAt()).isEqualTo(instantOf(row.get("updated_at")));
    }
  }

  @Test
  void create_returnsTheMillisecondsALaterReadShows() throws Exception {
    String body =
        postJson("{\"name\":\"Áo thun\",\"price\":1}")
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.createdAt").value(matchesPattern(CONTRACT_INSTANT)))
            .andReturn()
            .getResponse()
            .getContentAsString();

    String listed =
        mockMvc
            .perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(URL))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].createdAt").value(matchesPattern(CONTRACT_INSTANT)))
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(JsonPath.<String>read(listed, "$.items[0].createdAt"))
        .isEqualTo(JsonPath.<String>read(body, "$.createdAt"));
    assertThat(JsonPath.<String>read(listed, "$.items[0].updatedAt"))
        .isEqualTo(JsonPath.<String>read(body, "$.updatedAt"));
  }

  @Test
  void create_savesTheStatusAndAvailabilityGiven() throws Exception {
    postJson(
            "{\"name\":\"Bao tay len\",\"price\":90000,\"status\":\"HIDDEN\","
                + "\"availability\":\"OUT_OF_STOCK\",\"description\":\"   \"}")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("HIDDEN"))
        .andExpect(jsonPath("$.availability").value("OUT_OF_STOCK"))
        .andExpect(jsonPath("$.description").isEmpty())
        .andExpect(jsonPath("$.compareAtPrice").isEmpty());
  }

  @Test
  void create_withAnInvalidBody_savesNothing() throws Exception {
    postJson("{\"name\":\"\",\"price\":0}").andExpect(status().isBadRequest());

    assertThat(count()).isZero();
  }

  // ============================================================
  // Generated slug (AC8)
  // ============================================================

  @Test
  void create_withoutSlug_addsSuffixes2Then3WhenTheSlugIsTaken() {
    assertThat(create("Áo thun cổ tròn", null).slug()).isEqualTo("ao-thun-co-tron");
    assertThat(create("Áo thun cổ tròn", null).slug()).isEqualTo("ao-thun-co-tron-2");
    assertThat(create("Áo Thun Cổ Tròn", null).slug()).isEqualTo("ao-thun-co-tron-3");
  }

  @Test
  void create_withNullSlugInJson_generatesTheSlug() throws Exception {
    postJson("{\"name\":\"Đầm maxi đỏ 2026\",\"slug\":null,\"price\":1250000}")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.slug").value("dam-maxi-do-2026"));
  }

  @Test
  void create_withoutSlug_takesTheFirstFreeSuffix() {
    create("Quần jean nam", null);
    create("Quần jean nam", "quan-jean-nam-3");

    assertThat(create("Quần jean nam", null).slug()).isEqualTo("quan-jean-nam-2");
    assertThat(create("Quần jean nam", null).slug()).isEqualTo("quan-jean-nam-4");
  }

  @Test
  void create_withoutSlug_seesALegacySlugInOtherCaseAsTaken() {
    insertLegacy("Combo", "Combo-3-Ao");

    assertThat(create("Combo 3 áo", null).slug()).isEqualTo("combo-3-ao-2");
  }

  @Test
  void create_withANameOfSymbolsOnly_usesSanPham() {
    assertThat(create("!!! ???", null).slug()).isEqualTo("san-pham");
    assertThat(create("***", null).slug()).isEqualTo("san-pham-2");
  }

  @Test
  void create_withALongName_cutsTheBaseSoTheSlugKeeps100Characters() {
    String name = "a".repeat(150);

    assertThat(create(name, null).slug()).isEqualTo("a".repeat(100));
    String second = create(name, null).slug();

    assertThat(second).isEqualTo("a".repeat(98) + "-2").hasSize(100);
  }

  @Test
  void create_withALongName_seesTheTakenSuffixesOfTheCutBase() {
    String name = "b".repeat(150);
    create(name, null);
    create(name, null);
    create(name, null);

    assertThat(create(name, null).slug()).isEqualTo("b".repeat(98) + "-4");
  }

  @Test
  void create_withoutSlug_readsTheTakenSlugsInOneQuery() {
    create("Áo thun", null);
    create("Áo thun", null);
    create("Áo thun cổ tròn", null);
    clearInvocations(repository);

    assertThat(create("Áo thun", null).slug()).isEqualTo("ao-thun-3");

    verify(repository, times(1)).findSlugsAmong(any(String[].class));
    verify(repository, never()).existsBySlug(anyString());
  }

  @Test
  void create_withoutSlug_takesTheBaseWhenOnlySlugsStartingLikeItAreTaken() {
    create("Áo thun cổ tròn", null);
    create("Áo", "ao-2a");
    create("Áo", "ao-x");

    assertThat(create("Áo", null).slug()).isEqualTo("ao");
    assertThat(create("Áo", null).slug()).isEqualTo("ao-2");
  }

  // ============================================================
  // Typed slug
  // ============================================================

  @Test
  void create_withAFreeTypedSlug_keepsIt() {
    create("Áo thun cổ tròn", null);

    assertThat(create("Combo 3 áo thun", "combo-3-ao").slug()).isEqualTo("combo-3-ao");
  }

  @Test
  void create_withATypedSlugTaken_returns409AndSavesNothing() throws Exception {
    create("Áo thun cổ tròn", null);

    postJson("{\"name\":\"Áo thun cổ tròn\",\"slug\":\"ao-thun-co-tron\",\"price\":200000}")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("PRODUCT_SLUG_DUPLICATED"))
        .andExpect(jsonPath("$.detail").value("Product slug already exists."));

    assertThat(count()).isEqualTo(1);
  }

  @Test
  void create_withATypedSlugTakenInOtherCase_returns409() throws Exception {
    insertLegacy("Legacy", "Ao-Thun");

    postJson("{\"name\":\"Áo thun\",\"slug\":\"ao-thun\",\"price\":200000}")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("PRODUCT_SLUG_DUPLICATED"));
  }

  @Test
  void create_whenATypedSlugIsTakenAfterTheCheck_returns409FromTheUniqueConstraint()
      throws Exception {
    create("Áo thun cổ tròn", null);
    missTheSlugOnce("ao-thun-co-tron");

    postJson("{\"name\":\"Áo thun cổ tròn\",\"slug\":\"ao-thun-co-tron\",\"price\":200000}")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("PRODUCT_SLUG_DUPLICATED"))
        .andExpect(jsonPath("$.detail").value("Product slug already exists."));

    assertThat(count()).isEqualTo(1);
  }

  // ============================================================
  // Two adds at once with the same generated slug (NFR12)
  // ============================================================

  @Test
  void create_whenTheGeneratedSlugIsTakenAfterTheCheck_retriesWithTheNextNumber() {
    create("Áo thun cổ tròn", null);
    // The read runs before the other add commits, so it still sees every slug free.
    doReturn(List.of())
        .doAnswer(invocation -> slugsAmong(invocation.getArgument(0)))
        .when(repository)
        .findSlugsAmong(any(String[].class));

    AdminProduct product = create("Áo thun cổ tròn", null);

    assertThat(product.slug()).isEqualTo("ao-thun-co-tron-2");
    assertThat(count()).isEqualTo(2);
  }

  @Test
  void create_twoAddsAtOnceWithTheSameName_bothSaveWithDistinctSlugs() throws Exception {
    ExecutorService pool = Executors.newFixedThreadPool(2);
    try {
      for (int round = 0; round < 5; round++) {
        String name = "Đầm maxi " + round;
        CyclicBarrier start = new CyclicBarrier(2);
        List<Future<AdminProduct>> adds =
            List.of(
                pool.submit(() -> createAfter(start, name)),
                pool.submit(() -> createAfter(start, name)));

        List<String> slugs =
            List.of(
                adds.get(0).get(30, TimeUnit.SECONDS).slug(),
                adds.get(1).get(30, TimeUnit.SECONDS).slug());

        assertThat(slugs)
            .containsExactlyInAnyOrder("dam-maxi-" + round, "dam-maxi-" + round + "-2");
      }
    } finally {
      pool.shutdownNow();
    }
    assertThat(count()).isEqualTo(10);
  }

  // ============================================================
  // Log (NFR12)
  // ============================================================

  @Test
  void create_logsTheOperationIdSlugAndCorrelationIdButNotTheDescription(CapturedOutput output)
      throws Exception {
    String location =
        mockMvc
            .perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(URL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-Correlation-Id", "corr-shop15-log")
                    .header("Authorization", "Basic c2VjcmV0LXVzZXI6c2VjcmV0LXBhc3M=")
                    .content(
                        "{\"name\":\"Quần jean nam\",\"description\":\"mo-ta-bi-mat-123\","
                            + "\"price\":450000}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getHeader("Location");
    String id = location.substring((URL + "/").length());

    // The lines of the app itself. The bind parameters Hibernate traces under the dev profile
    // (application-dev.yml), which another test of the suite loads, are not the log of the add.
    String appLog =
        output
            .getOut()
            .lines()
            .filter(line -> !line.contains("\"logger\":\"org.hibernate."))
            .collect(Collectors.joining("\n"));
    assertThat(appLog)
        .contains("operation=create")
        .contains("id=" + id)
        .contains("slug=quan-jean-nam")
        .contains("correlationId=corr-shop15-log")
        .doesNotContain("mo-ta-bi-mat-123")
        .doesNotContain("c2VjcmV0LXVzZXI6c2VjcmV0LXBhc3M=");
  }

  // ============================================================
  // Helpers
  // ============================================================

  private ResultActions postJson(String body) throws Exception {
    return mockMvc.perform(
        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  private AdminProduct create(String name, String slug) {
    return service.create(
        new CreateProductRequest(name, slug, null, new BigDecimal("100000"), null, null, null));
  }

  private AdminProduct createAfter(CyclicBarrier start, String name) throws Exception {
    start.await(30, TimeUnit.SECONDS);
    return create(name, null);
  }

  /** A product as v0.2.0 writes it, whose slug may break the format (NFR16). */
  private void insertLegacy(String name, String slug) {
    transaction.executeWithoutResult(
        status ->
            jdbc.sql(
                    "INSERT INTO app.products (name, slug, price, created_by, updated_by)"
                        + " VALUES (:name, :slug, 1000, 'system', 'system')")
                .param("name", name)
                .param("slug", slug)
                .update());
  }

  /**
   * Makes the first check of {@code slug} see it free, as when the other add has not committed yet;
   * the next checks read the database.
   */
  private void missTheSlugOnce(String slug) {
    doReturn(false)
        .doAnswer(invocation -> slugExists(invocation.getArgument(0)))
        .when(repository)
        .existsBySlug(slug);
  }

  /** The slugs among the given ones, ignoring case, read by the test outside the spied query. */
  private List<String> slugsAmong(String[] slugs) {
    return transaction.execute(
        status ->
            jdbc.sql("SELECT slug::text FROM app.products WHERE lower(slug::text) IN (:slugs)")
                .param("slugs", Arrays.asList(slugs))
                .query(String.class)
                .list());
  }

  private boolean slugExists(String slug) {
    return transaction.execute(
        status ->
            jdbc.sql("SELECT count(*) FROM app.products WHERE slug = :slug")
                    .param("slug", slug)
                    .query(Long.class)
                    .single()
                > 0);
  }

  private void deleteAll() {
    transaction.executeWithoutResult(status -> jdbc.sql("DELETE FROM app.products").update());
  }

  /** A {@code timestamptz} as PgJDBC returns it, with its microseconds. */
  private static Instant instantOf(Object value) {
    return switch (value) {
      case Timestamp timestamp -> timestamp.toInstant();
      case OffsetDateTime offsetDateTime -> offsetDateTime.toInstant();
      default -> throw new IllegalArgumentException("Not a timestamptz: " + value);
    };
  }

  private long count() {
    return transaction.execute(
        status -> jdbc.sql("SELECT count(*) FROM app.products").query(Long.class).single());
  }
}
