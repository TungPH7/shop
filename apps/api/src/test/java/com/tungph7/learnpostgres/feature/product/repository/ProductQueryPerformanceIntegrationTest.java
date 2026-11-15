package com.tungph7.learnpostgres.feature.product.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.domain.ProductSort;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Criteria;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Result;

/**
 * NFR2: with 10,000 products, the median of 5 runs of each kind of list — search, filter, each
 * sort, any page — is at most 200 ms, both statements included. V4 adds no index for these lists;
 * this test decides whether a later migration needs one (ADR-0002).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(ProductQueryRepository.class)
class ProductQueryPerformanceIntegrationTest extends AbstractContainerBaseTest {

  private static final int PRODUCTS = 10_000;
  private static final int RUNS = 5;
  private static final long MAX_MEDIAN_MILLIS = 200;
  private static final Logger LOG =
      LoggerFactory.getLogger(ProductQueryPerformanceIntegrationTest.class);

  @Autowired ProductQueryRepository repository;
  @Autowired DataSource dataSource;

  @Test
  void findPage_with10000Products_takesAtMost200MillisecondsAtTheMedianForEachKindOfList() {
    insertProducts();
    Map<String, Criteria> kinds = new LinkedHashMap<>();
    kinds.put("store, newest", criteria(null, ProductStatus.ACTIVE, ProductSort.NEWEST, 0, 24));
    kinds.put(
        "store, price asc", criteria(null, ProductStatus.ACTIVE, ProductSort.PRICE_ASC, 0, 24));
    kinds.put(
        "store, price desc", criteria(null, ProductStatus.ACTIVE, ProductSort.PRICE_DESC, 0, 24));
    kinds.put(
        "store, last page", criteria(null, ProductStatus.ACTIVE, ProductSort.NEWEST, 8_976, 24));
    kinds.put(
        "store, 100 products", criteria(null, ProductStatus.ACTIVE, ProductSort.PRICE_ASC, 0, 100));
    kinds.put(
        "store, search, relevance",
        criteria("ao thun", ProductStatus.ACTIVE, ProductSort.RELEVANCE, 0, 24));
    kinds.put(
        "store, search, newest",
        criteria("ao thun", ProductStatus.ACTIVE, ProductSort.NEWEST, 0, 24));
    kinds.put(
        "store, search, price asc",
        criteria("ao", ProductStatus.ACTIVE, ProductSort.PRICE_ASC, 0, 24));
    kinds.put(
        "store, search, price desc",
        criteria("dam", ProductStatus.ACTIVE, ProductSort.PRICE_DESC, 0, 24));
    kinds.put(
        "store, search, relevance, page 20",
        criteria("ao", ProductStatus.ACTIVE, ProductSort.RELEVANCE, 456, 24));
    kinds.put("admin, all", criteria(null, null, ProductSort.NEWEST, 0, 20));
    kinds.put("admin, hidden", criteria(null, ProductStatus.HIDDEN, ProductSort.NEWEST, 0, 20));
    kinds.put("admin, search", criteria("quan jean", null, ProductSort.NEWEST, 0, 20));
    kinds.put("admin, last page", criteria(null, null, ProductSort.NEWEST, 9_980, 20));

    Map<String, Long> medians = new LinkedHashMap<>();
    kinds.forEach((kind, criteria) -> medians.put(kind, medianMillis(criteria)));
    LOG.info("NFR2, median in ms of {} runs with {} products: {}", RUNS, PRODUCTS, medians);

    assertThat(medians)
        .as("median in ms of %d runs per kind of list", RUNS)
        .allSatisfy(
            (kind, millis) -> assertThat(millis).as(kind).isLessThanOrEqualTo(MAX_MEDIAN_MILLIS));
    assertThat(repository.findPage(kinds.get("store, search, relevance")).items()).hasSize(24);
    assertThat(repository.findPage(kinds.get("admin, all")).totalItems()).isEqualTo(PRODUCTS);
  }

  private long medianMillis(Criteria criteria) {
    repository.findPage(criteria); // warm-up: JIT and the buffers of the database
    long[] nanos = new long[RUNS];
    for (int i = 0; i < RUNS; i++) {
      long start = System.nanoTime();
      Result result = repository.findPage(criteria);
      nanos[i] = System.nanoTime() - start;
      assertThat(result.totalItems()).isPositive();
    }
    Arrays.sort(nanos);
    return nanos[RUNS / 2] / 1_000_000;
  }

  private static Criteria criteria(
      String q, ProductStatus status, ProductSort sort, int offset, int limit) {
    ProductSearchTerms search = q == null ? null : ProductSearchTerms.of(q).orElseThrow();
    return new Criteria(search, status, sort, offset, limit);
  }

  /**
   * 10,000 products like Production: accented names of 4–6 words, a description of about 500
   * characters, repeated prices and minutes of creation, one in ten hidden. In the transaction of
   * the test, which rolls back.
   */
  private void insertProducts() {
    JdbcClient jdbc = JdbcClient.create(dataSource);
    jdbc.sql("DELETE FROM app.products").update();
    jdbc.sql(
            """
INSERT INTO app.products
    (id, name, slug, description, price_vnd, status, availability, created_at, updated_at)
SELECT app.gen_uuid_v7(),
       (ARRAY['Áo thun', 'Quần jean', 'Đầm maxi', 'Bao tay', 'Áo khoác', 'Combo 3 áo'])[1 + i % 6]
           || ' ' || (ARRAY['cổ tròn', 'nam', 'đỏ', 'len', 'thun nỉ', 'basic'])[1 + (i / 6) % 6]
           || ' ' || i,
       'perf-' || i,
       repeat('Mô tả sản phẩm, chất liệu cotton. ', 15),
       1000 * (1 + (i * 7919) % 2000),
       CASE WHEN i % 10 = 0 THEN 'HIDDEN' ELSE 'ACTIVE' END,
       CASE WHEN i % 7 = 0 THEN 'OUT_OF_STOCK' ELSE 'IN_STOCK' END,
       timestamptz '2026-01-01 00:00:00+00' + (i / 3) * interval '1 minute',
       timestamptz '2026-01-01 00:00:00+00' + (i / 3) * interval '1 minute'
  FROM generate_series(1, :products) AS s(i)
""")
        .param("products", PRODUCTS)
        .update();
  }
}
