package com.tungph7.learnpostgres.feature.product.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import javax.sql.DataSource;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;
import com.tungph7.learnpostgres.common.config.JpaAuditingConfig;
import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;

/**
 * The entity of {@code v0.3.0} on schema V4. It maps {@code price_vnd} and never the legacy {@code
 * price}, which {@code trg_products_sync_legacy_price} keeps equal to it (ADR-0001), so {@code
 * v0.2.0} reads the right price after a rollback.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
// @DataJpaTest does not auto-load auditing — import the config explicitly.
@Import(JpaAuditingConfig.class)
class ProductRepositoryDataJpaTest extends AbstractContainerBaseTest {

  private static final Logger LOG = LoggerFactory.getLogger(ProductRepositoryDataJpaTest.class);

  @Autowired ProductRepository repository;
  @Autowired EntityManager em;
  @Autowired DataSource dataSource;

  private JdbcClient jdbc;

  @BeforeEach
  void setUp() {
    // Same DataSource, so the reads join the transaction of the test and see its rows.
    jdbc = JdbcClient.create(dataSource);
  }

  // ============================================================
  // The legacy price follows price_vnd (rollback to v0.2.0)
  // ============================================================

  @Test
  void save_ofANewProduct_writesTheLegacyPriceEqualToPriceVnd() {
    Product saved = repository.save(product("Áo thun cổ tròn", "ao-thun-co-tron", 250_000L));
    em.flush();

    Map<String, Object> row = row(saved.getId());
    assertThat(row.get("price_vnd")).isEqualTo(250_000L);
    assertThat((BigDecimal) row.get("price")).isEqualByComparingTo("250000");
  }

  @Test
  void save_ofANewPriceVnd_updatesTheLegacyPriceToo() {
    Product saved = repository.save(product("Áo thun cổ tròn", "ao-thun-co-tron", 250_000L));
    em.flush();

    saved.setPriceVnd(199_000L);
    em.flush();

    Map<String, Object> row = row(saved.getId());
    assertThat(row.get("price_vnd")).isEqualTo(199_000L);
    assertThat((BigDecimal) row.get("price")).isEqualByComparingTo("199000");
  }

  @Test
  void save_ofAPriceAbove999999999OnAHiddenProduct_keepsBothPricesEqual() {
    Product saved =
        repository.save(
            new Product(
                "Đồng hồ cũ",
                "dong-ho-cu",
                null,
                9_999_999_999L,
                null,
                ProductStatus.HIDDEN,
                ProductAvailability.IN_STOCK));
    em.flush();

    Map<String, Object> row = row(saved.getId());
    assertThat((BigDecimal) row.get("price")).isEqualByComparingTo("9999999999");
    assertThat(row.get("status")).isEqualTo("HIDDEN");
  }

  // ============================================================
  // Mapping of the new columns
  // ============================================================

  @Test
  void findById_readsBackEveryColumnTheEntityMaps() {
    UUID id =
        repository
            .save(
                new Product(
                    "Combo 3 áo thun",
                    "combo-3-ao",
                    "Ba áo thun basic.\nCổ tròn.",
                    399_000L,
                    450_000L,
                    ProductStatus.HIDDEN,
                    ProductAvailability.OUT_OF_STOCK))
            .getId();
    em.flush();
    em.clear();

    Product read = repository.findById(id).orElseThrow();

    assertThat(read.getName()).isEqualTo("Combo 3 áo thun");
    assertThat(read.getSlug()).isEqualTo("combo-3-ao");
    assertThat(read.getDescription()).isEqualTo("Ba áo thun basic.\nCổ tròn.");
    assertThat(read.getPriceVnd()).isEqualTo(399_000L);
    assertThat(read.getCompareAtPriceVnd()).isEqualTo(450_000L);
    assertThat(read.getStatus()).isEqualTo(ProductStatus.HIDDEN);
    assertThat(read.getAvailability()).isEqualTo(ProductAvailability.OUT_OF_STOCK);
    assertThat(read.getVersion()).isZero();
  }

  @Test
  void setters_changeTheColumnsTheyMap() {
    Product saved = repository.save(product("Khăn lụa", "khan-lua", 120_000L));
    em.flush();

    saved.setName("Khăn lụa tơ tằm");
    saved.setSlug("khan-lua-to-tam");
    saved.setDescription("Lụa tơ tằm.");
    saved.setCompareAtPriceVnd(150_000L);
    saved.setStatus(ProductStatus.HIDDEN);
    saved.setAvailability(ProductAvailability.OUT_OF_STOCK);
    em.flush();

    Map<String, Object> row = row(saved.getId());
    assertThat(row.get("name")).isEqualTo("Khăn lụa tơ tằm");
    assertThat(row.get("slug")).isEqualTo("khan-lua-to-tam");
    assertThat(row.get("description")).isEqualTo("Lụa tơ tằm.");
    assertThat(row.get("compare_at_price_vnd")).isEqualTo(150_000L);
    assertThat(row.get("status")).isEqualTo("HIDDEN");
    assertThat(row.get("availability")).isEqualTo("OUT_OF_STOCK");
    assertThat(row.get("name_search")).isEqualTo(" khan lua to tam ");
  }

  // ============================================================
  // Slug, id and audit fields
  // ============================================================

  @Test
  void theSession_hasSearchPathAppOnly_asOnTheServers() {
    // The operators of citext live in schema public: these tests see them only if they are
    // called explicitly, as on the servers.
    assertThat(jdbc.sql("SHOW search_path").query(String.class).single()).isEqualTo("app");
  }

  @Test
  void findBySlugIgnoringCase_matchesCaseInsensitively_dueToCitext() {
    repository.save(product("Quần jean nam", "quan-jean-nam", 450_000L));
    em.flush();

    assertThat(repository.findBySlugIgnoringCase("quan-jean-nam")).isPresent();
    assertThat(repository.findBySlugIgnoringCase("QUAN-JEAN-NAM")).isPresent();
    assertThat(repository.findBySlugIgnoringCase("not-exist")).isEmpty();
  }

  @Test
  void findBySlugIgnoringCase_canBeServedByTheIndexOfTheUniqueSlug() {
    // Seq scans off: a plan that still reads the whole table means the condition cannot use the
    // index, as a text comparison on the citext slug could not.
    jdbc.sql("SET LOCAL enable_seqscan = off").update();
    String sql = ProductRepository.BY_SLUG_SQL.replace(":slug", "'Quan-Jean-NAM'");

    String plan = String.join("\n", jdbc.sql("EXPLAIN " + sql).query(String.class).list());

    assertThat(plan)
        .contains("products_slug_unique")
        .contains("Index Cond")
        .doesNotContain("Seq Scan");
  }

  @Test
  void existsBySlug_canBeServedByTheIndexOfTheUniqueSlug() {
    jdbc.sql("SET LOCAL enable_seqscan = off").update();
    String sql = ProductRepository.EXISTS_BY_SLUG_SQL.replace(":slug", "'Quan-Jean-NAM'");

    String plan = String.join("\n", jdbc.sql("EXPLAIN " + sql).query(String.class).list());

    assertThat(plan)
        .contains("products_slug_unique")
        .contains("Index Cond")
        .doesNotContain("Seq Scan");
  }

  @Test
  void existsBySlug_matchesCaseInsensitively_dueToCitext() {
    repository.save(product("Quần jean nam", "quan-jean-nam", 450_000L));
    em.flush();

    assertThat(repository.existsBySlug("quan-jean-nam")).isTrue();
    assertThat(repository.existsBySlug("Quan-Jean-NAM")).isTrue();
    assertThat(repository.existsBySlug("quan-jean")).isFalse();
  }

  @Test
  void save_assignsAUuidV7IdAndTheAuditFields() {
    Product saved = repository.save(product("X", "x-" + System.nanoTime(), 1L));
    em.flush();

    assertThat(saved.getId()).isNotNull();
    assertThat(saved.getId().version()).isEqualTo(7);
    assertThat(saved.getCreatedAt()).isNotNull();
    assertThat(saved.getUpdatedAt()).isNotNull();
  }

  @Test
  void save_ofADuplicateSlugInAnotherCase_breaksTheUniqueConstraint() {
    repository.save(product("A", "dup", 1L));
    em.flush();

    repository.save(product("B", "DUP", 1L));

    assertThatThrownBy(em::flush).hasRootCauseInstanceOf(org.postgresql.util.PSQLException.class);
  }

  // ============================================================
  // The slugs taken among the candidates of a generated slug
  // ============================================================

  @Test
  void findSlugsAmong_readsOnlyTheSlugsGiven_ignoringCase() {
    repository.save(product("Áo", "ao", 1L));
    repository.save(product("Áo", "AO-2", 1L));
    repository.save(product("Áo", "ao-2a", 1L));
    repository.save(product("Áo", "ao-thun", 1L));
    em.flush();

    assertThat(repository.findSlugsAmong(new String[] {"ao", "ao-2", "ao-3"}))
        .containsExactlyInAnyOrder("ao", "AO-2");
  }

  @Test
  void findSlugsAmong_ofNoSlugTaken_readsNothing() {
    repository.save(product("Áo", "ao-thun", 1L));
    em.flush();

    assertThat(repository.findSlugsAmong(new String[] {"ao", "ao-2"})).isEmpty();
  }

  @Test
  void findSlugsAmong_canBeServedByTheIndexOfTheUniqueSlug() {
    // Seq scans off: a plan that still reads the whole table means the condition cannot use the
    // index, as a LIKE on citext could not.
    jdbc.sql("SET LOCAL enable_seqscan = off").update();
    String sql = ProductRepository.SLUGS_AMONG_SQL.replace(":slugs", "'{ao,ao-2,ao-3}'::text");

    String plan = String.join("\n", jdbc.sql("EXPLAIN " + sql).query(String.class).list());

    // An Index Cond, not a Filter over the whole index: a text comparison would only filter.
    assertThat(plan)
        .contains("products_slug_unique")
        .contains("Index Cond")
        .doesNotContain("Seq Scan");
  }

  /**
   * A measure, not a pin of the plan: with seq scans on, the planner chooses, and a hashed read of
   * the whole table would be fast too. The plan and its time go to the log; the test asserts only
   * the result, and the median of NFR2 as a wide bound. {@link
   * #findSlugsAmong_canBeServedByTheIndexOfTheUniqueSlug} pins that the index can serve it.
   */
  @Test
  void findSlugsAmong_ofTheCandidatesOfAName_with10000Products_findsTheTakenOnesWithin200Ms() {
    insertProducts(10_000);
    // The 1,000 slugs an add without slug tries (AdminProductService.MAX_SLUG_NUMBER).
    String candidates =
        Stream.concat(
                Stream.of("ao-thun"), IntStream.rangeClosed(2, 1_000).mapToObj(n -> "ao-thun-" + n))
            .collect(Collectors.joining(",", "'{", "}'::text"));
    String sql = ProductRepository.SLUGS_AMONG_SQL.replace(":slugs", candidates);

    String plan =
        String.join(
            "\n", jdbc.sql("EXPLAIN (ANALYZE, COSTS OFF) " + sql).query(String.class).list());
    LOG.info("findSlugsAmong, 1,000 candidates, 10,000 products, seq scans on:\n{}", plan);
    String[] slugs =
        Stream.concat(
                Stream.of("AO-THUN"), IntStream.rangeClosed(2, 1_000).mapToObj(n -> "ao-thun-" + n))
            .toArray(String[]::new);

    repository.findSlugsAmong(slugs); // warm-up: JIT and the buffers of the database
    long[] nanos = new long[5];
    for (int i = 0; i < nanos.length; i++) {
      long start = System.nanoTime();
      assertThat(repository.findSlugsAmong(slugs)).containsExactly("ao-thun");
      nanos[i] = System.nanoTime() - start;
    }
    Arrays.sort(nanos);

    assertThat(nanos[nanos.length / 2] / 1_000_000).as("median in ms").isLessThanOrEqualTo(200);
  }

  // ============================================================
  // Helpers
  // ============================================================

  private static Product product(String name, String slug, long priceVnd) {
    return new Product(
        name, slug, null, priceVnd, null, ProductStatus.ACTIVE, ProductAvailability.IN_STOCK);
  }

  /**
   * {@code count} products like Production, as in {@code ProductQueryPerformanceIntegrationTest},
   * plus {@code ao-thun}, then fresh statistics for the planner. In the transaction of the test,
   * which rolls back.
   */
  private void insertProducts(int count) {
    jdbc.sql(
            """
INSERT INTO app.products (id, name, slug, description, price_vnd, status, availability)
SELECT app.gen_uuid_v7(), 'Áo thun cổ tròn ' || i, 'perf-' || i,
       repeat('Mô tả sản phẩm, chất liệu cotton. ', 15), 1000 * (1 + i % 2000),
       'ACTIVE', 'IN_STOCK'
  FROM generate_series(1, :count) AS s(i)
""")
        .param("count", count)
        .update();
    repository.save(product("Áo thun", "ao-thun", 1L));
    em.flush();
    jdbc.sql("ANALYZE app.products").update();
  }

  private Map<String, Object> row(UUID id) {
    return jdbc.sql(
            """
SELECT name, slug::text AS slug, description, price, price_vnd, compare_at_price_vnd, status,
       availability, name_search
  FROM app.products WHERE id = ?
""")
        .param(id)
        .query()
        .singleRow();
  }
}
