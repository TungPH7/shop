package com.tungph7.learnpostgres.feature.category.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.IntFunction;

import javax.sql.DataSource;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DelegatingDataSource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;

/**
 * NFR2 of SHOP-81 (SHOP-82, step 10): with 200 categories and 10,000 products, one category holding
 * 5,000 of them, each command runs 5 times after a warm-up, and the median is at most 200 ms for a
 * read, 300 ms for a write and 1 s for the delete of the category of 5,000 products, which leaves
 * them without category (NFR15). Each command is measured at the HTTP boundary, through MockMvc, so
 * the median holds every statement, the transaction and the JSON.
 *
 * <p>The warm-up run counts the SQL statements of the command on this data: a fixed number, the one
 * the plan names for each read (Architecture Decisions 6), so none grows with the categories or the
 * products. The counting wraps the {@code DataSource} of the application, and counts each statement
 * a connection prepares or creates.
 *
 * <p>The data is committed, since each request runs in transactions of its own, and deleted after
 * the class.
 *
 * <p>The plan of each statement depends on the statistics of the two tables. The class starts from
 * the stale ones that an earlier class can leave, with autovacuum paused on both tables until the
 * end, and analyzes the tables once the data is in. So the median does not depend on the order of
 * the classes or on when the daemon last ran: on stale statistics, the lists of categories take
 * more than 200 ms.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(CategoryPerformanceIntegrationTest.StatementCounting.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class CategoryPerformanceIntegrationTest extends AbstractContainerBaseTest {

  private static final int CATEGORIES = 200;
  private static final int PRODUCTS = 10_000;
  private static final int PRODUCTS_OF_THE_BIG_CATEGORY = 5_000;

  /** The {@code ACTIVE} products of the big category: one in ten is hidden. */
  private static final int ACTIVE_OF_THE_BIG_CATEGORY = 4_500;

  /** The products an earlier class added and deleted, before it left the statistics. */
  private static final int EARLIER_PRODUCTS = 20_000;

  /** The products the statistics of the earlier class describe, all of one category. */
  private static final int EARLIER_PRODUCTS_OF_ONE_CATEGORY = 20;

  private static final int RUNS = 5;
  private static final long MAX_READ_MILLIS = 200;
  private static final long MAX_WRITE_MILLIS = 300;
  private static final long MAX_DELETE_MILLIS = 1_000;

  /** The category that holds 5,000 products, 4,500 of them {@code ACTIVE}. */
  private static final String BIG = "danh-muc-1";

  private static final AtomicInteger STATEMENTS = new AtomicInteger();
  private static final Logger LOG =
      LoggerFactory.getLogger(CategoryPerformanceIntegrationTest.class);

  @Autowired MockMvc mockMvc;
  @Autowired DataSource dataSource;
  @Autowired PlatformTransactionManager transactionManager;

  private JdbcClient jdbc;
  private TransactionTemplate transaction;

  /** One command measured: the median of {@value #RUNS} runs, and the statements of one run. */
  record Measure(long medianMillis, int statements) {}

  @BeforeAll
  void insertTheData() {
    jdbc = JdbcClient.create(dataSource);
    // The pool does not auto-commit, so each write of the test runs in a transaction of its own.
    transaction = new TransactionTemplate(transactionManager);
    transaction.executeWithoutResult(
        tx -> {
          pauseAutovacuum();
          leaveTheStatisticsOfAnEarlierClass();
        });
    transaction.executeWithoutResult(
        tx -> {
          deleteAll();
          insertCategories();
          insertProducts();
        });
    transaction.executeWithoutResult(tx -> analyzeTheData());
  }

  /**
   * Deletes the data, then turns autovacuum back on in a transaction of its own, so it is on again
   * even when the delete fails.
   */
  @AfterAll
  void deleteTheData() {
    try {
      // TRUNCATE, not DELETE: the next class starts from an empty table, not 10,000 dead rows.
      transaction.executeWithoutResult(tx -> truncateTheTables());
    } finally {
      transaction.executeWithoutResult(tx -> resumeAutovacuum());
    }
  }

  @Test
  void eachRead_takesAtMost200MillisecondsAtTheMedian_inAFixedNumberOfStatements()
      throws Exception {
    UUID product = productId("perf-2");
    String products = "/api/categories/" + BIG + "/products";
    int lastPage = ACTIVE_OF_THE_BIG_CATEGORY - 24;

    Map<String, Measure> measures = new LinkedHashMap<>();
    measures.put("admin, categories", read(get("/api/admin/categories")));
    measures.put("admin, product", read(get("/api/admin/products/" + product)));
    measures.put("store, categories", read(get("/api/categories")));
    measures.put("store, category sitemap", read(get("/api/sitemap/categories")));
    measures.put("store, category", read(get("/api/categories/" + BIG)));
    measures.put("store, category, HEAD", read(head("/api/categories/" + BIG)));
    measures.put("store, product", read(get("/api/products/perf-2")));
    for (String sort : List.of("NEWEST", "PRICE_ASC", "PRICE_DESC")) {
      measures.put(
          "store, products of the category, " + sort + ", first page",
          read(get(products).param("sort", sort)));
      measures.put(
          "store, products of the category, " + sort + ", last page",
          read(get(products).param("sort", sort).param("offset", String.valueOf(lastPage))));
    }
    LOG.info(
        "NFR2 of SHOP-81, reads, median in ms of {} runs and statements of one run: {}",
        RUNS,
        measures);

    assertThat(measures)
        .allSatisfy(
            (command, measure) ->
                assertThat(measure.medianMillis())
                    .as(command)
                    .isLessThanOrEqualTo(MAX_READ_MILLIS));
    Map<String, Integer> statements = new LinkedHashMap<>();
    measures.forEach(
        (command, measure) ->
            statements.put(command, command.contains("products of the category") ? 3 : 1));
    assertThat(statementsOf(measures)).containsExactlyEntriesOf(statements);
    mockMvc
        .perform(get(products).param("offset", String.valueOf(lastPage)))
        .andExpect(jsonPath("$.items.length()").value(24))
        .andExpect(jsonPath("$.totalItems").value(ACTIVE_OF_THE_BIG_CATEGORY));
  }

  @Test
  void eachWrite_takesAtMost300MillisecondsAtTheMedian_inAFixedNumberOfStatements() {
    // Neither the big category nor its products: the delete keeps a category of exactly 5,000.
    UUID edited = categoryId("danh-muc-3");
    UUID one = categoryId("danh-muc-4");
    UUID another = categoryId("danh-muc-5");
    UUID product = productId("perf-5001");
    long productVersion = productVersion(product);

    Map<String, Measure> measures = new LinkedHashMap<>();
    measures.put(
        "admin, add a category",
        write(
            run ->
                post("/api/admin/categories")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Perf thêm %d\"}".formatted(run))));
    measures.put(
        "admin, edit a category",
        write(
            run ->
                put("/api/admin/categories/" + edited)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        ("{\"name\":\"Danh mục 3 sửa %d\",\"slug\":\"danh-muc-3\","
                                + "\"status\":\"VISIBLE\",\"version\":%d}")
                            .formatted(run, run))));
    measures.put(
        "admin, add a product with a category",
        write(
            run ->
                post("/api/admin/products")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"name\":\"Perf áo mới %d\",\"price\":150000,\"categoryId\":\"%s\"}"
                            .formatted(run, one))));
    measures.put(
        "admin, edit a product with a category",
        write(
            run ->
                put("/api/admin/products/" + product)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        ("{\"name\":\"Perf sửa %d\",\"slug\":\"perf-5001\",\"price\":150000,"
                                + "\"status\":\"ACTIVE\",\"availability\":\"IN_STOCK\","
                                + "\"version\":%d,\"categoryId\":\"%s\"}")
                            .formatted(run, productVersion + run, run % 2 == 0 ? one : another))));
    LOG.info(
        "NFR2 of SHOP-81, writes, median in ms of {} runs and statements of one run: {}",
        RUNS,
        measures);

    assertThat(measures)
        .allSatisfy(
            (command, measure) ->
                assertThat(measure.medianMillis())
                    .as(command)
                    .isLessThanOrEqualTo(MAX_WRITE_MILLIS));
    Map<String, Integer> statements = new LinkedHashMap<>();
    statements.put("admin, add a category", 3);
    statements.put("admin, edit a category", 4);
    statements.put("admin, add a product with a category", 3);
    statements.put("admin, edit a product with a category", 4);
    assertThat(statementsOf(measures)).containsExactlyEntriesOf(statements);
  }

  /**
   * The delete of a category of 5,000 products, which the foreign key leaves without category in
   * the same statement. Each run deletes a category of its own, given the 5,000 products of the big
   * category before the run; the products go back to the big category at the end.
   */
  @Test
  void deleteOfACategoryOf5000Products_takesAtMost1SecondAtTheMedian_inTwoStatements() {
    UUID big = categoryId(BIG);
    List<UUID> products =
        jdbc.sql("SELECT id FROM app.products WHERE category_id = ?")
            .param(big)
            .query(UUID.class)
            .list();
    assertThat(products).hasSize(PRODUCTS_OF_THE_BIG_CATEGORY);
    long productsBefore = count("SELECT count(*) FROM app.products");

    Measure measure;
    try {
      measure =
          measure(
              run -> delete("/api/admin/categories/" + categoryOf(products, "Perf xóa " + run)),
              204);
      assertThat(count("SELECT count(*) FROM app.products WHERE category_id IS NULL"))
          .isEqualTo(PRODUCTS_OF_THE_BIG_CATEGORY);
    } finally {
      transaction.executeWithoutResult(
          tx ->
              jdbc.sql("UPDATE app.products SET category_id = ? WHERE id = ANY(?)")
                  .params(big, products.toArray(UUID[]::new))
                  .update());
    }
    LOG.info(
        "NFR2 of SHOP-81, delete of a category of {} products, median in ms of {} runs and"
            + " statements of one run: {}",
        PRODUCTS_OF_THE_BIG_CATEGORY,
        RUNS,
        measure);

    assertThat(measure.medianMillis()).isLessThanOrEqualTo(MAX_DELETE_MILLIS);
    assertThat(measure.statements()).isEqualTo(2);
    assertThat(count("SELECT count(*) FROM app.products")).isEqualTo(productsBefore);
  }

  // ============================================================
  // Measures
  // ============================================================

  private Measure read(RequestBuilder request) {
    return measure(run -> request, 200);
  }

  private Measure write(IntFunction<RequestBuilder> request) {
    return measure(request, 0);
  }

  /**
   * Runs the command of run 0 as the warm-up, counting its statements, then times runs 1 to {@value
   * #RUNS}.
   *
   * @param request the request of each run, from 0
   * @param status the status each run must answer, or 0 for any 2xx
   */
  private Measure measure(IntFunction<RequestBuilder> request, int status) {
    RequestBuilder warmUp = request.apply(0);
    STATEMENTS.set(0);
    perform(warmUp, status);
    int statements = STATEMENTS.get();
    long[] nanos = new long[RUNS];
    for (int run = 1; run <= RUNS; run++) {
      RequestBuilder builder = request.apply(run);
      long start = System.nanoTime();
      perform(builder, status);
      nanos[run - 1] = System.nanoTime() - start;
    }
    Arrays.sort(nanos);
    return new Measure(nanos[RUNS / 2] / 1_000_000, statements);
  }

  private void perform(RequestBuilder request, int status) {
    try {
      int answered = mockMvc.perform(request).andReturn().getResponse().getStatus();
      if (status == 0) {
        assertThat(answered).isBetween(200, 299);
      } else {
        assertThat(answered).isEqualTo(status);
      }
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private static Map<String, Integer> statementsOf(Map<String, Measure> measures) {
    Map<String, Integer> statements = new LinkedHashMap<>();
    measures.forEach((command, measure) -> statements.put(command, measure.statements()));
    return statements;
  }

  // ============================================================
  // Data
  // ============================================================

  /**
   * A new category given these products, outside the time of the run: the products of a deleted
   * category have none.
   */
  private UUID categoryOf(List<UUID> products, String name) {
    return transaction.execute(
        tx -> {
          UUID id =
              jdbc.sql("INSERT INTO app.categories (name, slug) VALUES (?, ?) RETURNING id")
                  .params(name, "perf-xoa-" + UUID.randomUUID())
                  .query(UUID.class)
                  .single();
          jdbc.sql("UPDATE app.products SET category_id = ? WHERE id = ANY(?)")
              .params(id, products.toArray(UUID[]::new))
              .update();
          return id;
        });
  }

  private UUID categoryId(String slug) {
    return jdbc.sql("SELECT id FROM app.categories WHERE slug::text = ?")
        .param(slug)
        .query(UUID.class)
        .single();
  }

  private UUID productId(String slug) {
    return jdbc.sql("SELECT id FROM app.products WHERE slug::text = ?")
        .param(slug)
        .query(UUID.class)
        .single();
  }

  private long count(String sql) {
    return jdbc.sql(sql).query(Long.class).single();
  }

  private long productVersion(UUID product) {
    return jdbc.sql("SELECT version FROM app.products WHERE id = ?")
        .param(product)
        .query(Long.class)
        .single();
  }

  /** 200 categories, {@code danh-muc-1} to {@code danh-muc-200}; one in ten is hidden. */
  private void insertCategories() {
    jdbc.sql(
            """
INSERT INTO app.categories (name, slug, status)
SELECT 'Danh mục ' || i,
       'danh-muc-' || i,
       CASE WHEN i % 10 = 0 THEN 'HIDDEN' ELSE 'VISIBLE' END
  FROM generate_series(1, :categories) AS s(i)
""")
        .param("categories", CATEGORIES)
        .update();
  }

  /**
   * 10,000 products like those of {@code ProductQueryPerformanceIntegrationTest}, one in ten
   * hidden: the first 5,000 in {@code danh-muc-1}, the others spread over the 199 other categories.
   */
  private void insertProducts() {
    jdbc.sql(
            """
INSERT INTO app.products
    (id, name, slug, description, price_vnd, status, availability, category_id,
     created_at, updated_at)
SELECT app.gen_uuid_v7(),
       (ARRAY['Áo thun', 'Quần jean', 'Đầm maxi', 'Bao tay', 'Áo khoác', 'Combo 3 áo'])[1 + i % 6]
           || ' ' || (ARRAY['cổ tròn', 'nam', 'đỏ', 'len', 'thun nỉ', 'basic'])[1 + (i / 6) % 6]
           || ' ' || i,
       'perf-' || i,
       repeat('Mô tả sản phẩm, chất liệu cotton. ', 15),
       1000 * (1 + (i * 7919) % 2000),
       CASE WHEN i % 10 = 0 THEN 'HIDDEN' ELSE 'ACTIVE' END,
       CASE WHEN i % 7 = 0 THEN 'OUT_OF_STOCK' ELSE 'IN_STOCK' END,
       c.id,
       timestamptz '2026-01-01 00:00:00+00' + (i / 3) * interval '1 minute',
       timestamptz '2026-01-01 00:00:00+00' + (i / 3) * interval '1 minute'
  FROM generate_series(1, :products) AS s(i)
  JOIN app.categories c
    ON c.slug::text = 'danh-muc-'
           || CASE WHEN i <= :big THEN 1 ELSE 2 + i % (:categories - 1) END
""")
        .param("products", PRODUCTS)
        .param("big", PRODUCTS_OF_THE_BIG_CATEGORY)
        .param("categories", CATEGORIES)
        .update();
  }

  /**
   * Empties the two tables. {@code CASCADE} empties too any table whose foreign key points to them,
   * such as a later table of order lines: PostgreSQL refuses a {@code TRUNCATE} of a table that
   * another table references, even an empty one.
   */
  private void truncateTheTables() {
    jdbc.sql("TRUNCATE app.products, app.categories CASCADE").update();
  }

  private void deleteAll() {
    jdbc.sql("DELETE FROM app.products").update();
    jdbc.sql("DELETE FROM app.categories").update();
  }

  /**
   * Keeps autovacuum from analyzing the two tables while the class runs, so the planner sees the
   * statistics this class leaves, not those of a run of the daemon at a random instant.
   */
  private void pauseAutovacuum() {
    jdbc.sql("ALTER TABLE app.categories SET (autovacuum_enabled = false)").update();
    jdbc.sql("ALTER TABLE app.products SET (autovacuum_enabled = false)").update();
  }

  /**
   * The statistics of the data measured, which autovacuum gives a Production database within a
   * minute of a change of 50 rows and a tenth of the table. Without them, the planner keeps those
   * of {@link #leaveTheStatisticsOfAnEarlierClass()}, and reads every product again for each
   * category in the list and the sitemap of the store: more than 200 ms (NFR2).
   */
  private void analyzeTheData() {
    jdbc.sql("ANALYZE app.categories, app.products").update();
  }

  private void resumeAutovacuum() {
    jdbc.sql("ALTER TABLE app.categories RESET (autovacuum_enabled)").update();
    jdbc.sql("ALTER TABLE app.products RESET (autovacuum_enabled)").update();
  }

  /**
   * The statistics an earlier class can leave: a table of products that held {@value
   * #EARLIER_PRODUCTS} rows, all deleted and not vacuumed yet, analyzed while it held {@value
   * #EARLIER_PRODUCTS_OF_ONE_CATEGORY} products of a single category. On them the planner takes the
   * table of products for a few rows.
   */
  private void leaveTheStatisticsOfAnEarlierClass() {
    truncateTheTables();
    jdbc.sql(
            """
INSERT INTO app.products (name, slug, description, price_vnd)
SELECT 'Trước ' || i, 'truoc-' || i, repeat('Mô tả sản phẩm, chất liệu cotton. ', 15), 1000
  FROM generate_series(1, :products) AS s(i)
""")
        .param("products", EARLIER_PRODUCTS)
        .update();
    jdbc.sql("DELETE FROM app.products").update();
    jdbc.sql("INSERT INTO app.categories (name, slug) VALUES ('Trước', 'truoc')").update();
    jdbc.sql(
            """
INSERT INTO app.products (name, slug, price_vnd, category_id)
SELECT 'Trước ' || i, 'truoc-' || i, 1000, c.id
  FROM generate_series(1, :products) AS s(i) CROSS JOIN app.categories c
""")
        .param("products", EARLIER_PRODUCTS_OF_ONE_CATEGORY)
        .update();
    jdbc.sql("ANALYZE app.categories, app.products").update();
  }

  // ============================================================
  // Counting the statements
  // ============================================================

  /** Wraps the {@code DataSource} of the application in {@link CountingDataSource}. */
  @TestConfiguration(proxyBeanMethods = false)
  static class StatementCounting {

    @Bean
    static BeanPostProcessor countingDataSource() {
      return new BeanPostProcessor() {
        @Override
        public Object postProcessAfterInitialization(Object bean, String beanName) {
          return bean instanceof DataSource target && !(bean instanceof CountingDataSource)
              ? new CountingDataSource(target)
              : bean;
        }
      };
    }
  }

  /** Counts in {@link #STATEMENTS} each statement its connections prepare or create. */
  static final class CountingDataSource extends DelegatingDataSource {

    CountingDataSource(DataSource target) {
      super(target);
    }

    @Override
    public Connection getConnection() throws SQLException {
      return counting(super.getConnection());
    }

    @Override
    public Connection getConnection(String username, String password) throws SQLException {
      return counting(super.getConnection(username, password));
    }

    private static Connection counting(Connection target) {
      return (Connection)
          Proxy.newProxyInstance(
              Connection.class.getClassLoader(),
              new Class<?>[] {Connection.class},
              (proxy, method, args) -> {
                String name = method.getName();
                if (name.equals("prepareStatement")
                    || name.equals("createStatement")
                    || name.equals("prepareCall")) {
                  STATEMENTS.incrementAndGet();
                }
                return invoke(target, method, args);
              });
    }

    private static Object invoke(Object target, Method method, Object[] args) throws Throwable {
      try {
        return method.invoke(target, args);
      } catch (InvocationTargetException e) {
        throw e.getCause();
      }
    }
  }
}
