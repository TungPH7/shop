package com.tungph7.learnpostgres.feature.product.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.domain.ProductSort;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Criteria;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Result;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Row;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.SitemapResult;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.SitemapRow;

/**
 * The list queries of {@link ProductQueryRepository} on schema V4 (Testcontainers PostgreSQL 17).
 * Each test runs in a transaction that rolls back, so its products are gone afterwards.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(ProductQueryRepository.class)
class ProductQueryRepositoryIntegrationTest extends AbstractContainerBaseTest {

  private static final Instant T0 = Instant.parse("2026-11-16T02:00:00Z");
  private static final Set<ProductStatus> EVERY_STATUS = EnumSet.allOf(ProductStatus.class);
  private static final Set<ProductStatus> ONLY_ACTIVE = Set.of(ProductStatus.ACTIVE);
  private static final Set<ProductStatus> ONLY_HIDDEN = Set.of(ProductStatus.HIDDEN);

  @Autowired ProductQueryRepository repository;
  @Autowired DataSource dataSource;

  private JdbcClient jdbc;
  private long sequence;

  @BeforeEach
  void setUp() {
    jdbc = JdbcClient.create(dataSource);
    jdbc.sql("DELETE FROM app.products").update();
  }

  // ============================================================
  // Search without accents (AC2, AC18)
  // ============================================================

  @ParameterizedTest
  @ValueSource(strings = {"dam", "đầm", "ĐẦM", "Dam Maxi", "do 2026"})
  void findPage_withOrWithoutAccents_findsTheNameWithAccents(String q) {
    insert("Đầm maxi đỏ 2026", 1_250_000L, minutes(1));
    insert("Quần jean nam", 450_000L, minutes(2));

    assertThat(names(search(q, ProductSort.NEWEST))).containsExactly("Đầm maxi đỏ 2026");
  }

  @Test
  void findPage_withAo_findsAoThunButNotBaoTayLen() {
    insert("Áo thun cổ tròn", 250_000L, minutes(1));
    insert("Bao tay len", 90_000L, minutes(2));
    insert("Quần jean nam", 450_000L, minutes(3));

    assertThat(names(search("ao", ProductSort.NEWEST))).containsExactly("Áo thun cổ tròn");
  }

  @ParameterizedTest
  @ValueSource(strings = {"ao thun", "ÁO THUN", "Áo Thun", "thun ao", "ao th", "  áo   thun  "})
  void findPage_needsEveryWordAtTheStartOfAWordInAnyOrder(String q) {
    insert("Áo thun cổ tròn", 250_000L, minutes(1));
    insert("Áo khoác len", 550_000L, minutes(2));
    insert("Quần jean nam", 450_000L, minutes(3));

    assertThat(names(search(q, ProductSort.NEWEST))).containsExactly("Áo thun cổ tròn");
  }

  @ParameterizedTest
  @ValueSource(strings = {"hun", "xyz", "ao xyz"})
  void findPage_withAWordThatStartsNoWordOfTheName_findsNothing(String q) {
    insert("Áo thun cổ tròn", 250_000L, minutes(1));

    Result result = search(q, ProductSort.NEWEST);

    assertThat(result.items()).isEmpty();
    assertThat(result.totalItems()).isZero();
  }

  // ============================================================
  // Keywords %, _, \ and ' (NFR10)
  // ============================================================

  @ParameterizedTest
  @ValueSource(strings = {"%", "_", "\\", "'", "%%", "_%_", "' OR '1'='1", "'; DROP TABLE x; --"})
  void findPage_withAKeywordOfSpecialCharacters_findsNothingAndBreaksNothing(String q) {
    insert("Giảm 50% áo_thun", 250_000L, minutes(1));
    insert("Quần jean nam", 450_000L, minutes(2));

    Result result = search(q, ProductSort.NEWEST);

    assertThat(result.items()).isEmpty();
    assertThat(result.totalItems()).isZero();
    assertThat(count("SELECT count(*) FROM app.products")).isEqualTo(2);
  }

  @Test
  void findPage_withAPercentAfterAWord_searchesTheWordOnly() {
    insert("Giảm 50% áo thun", 250_000L, minutes(1));
    insert("Áo 5 lỗ", 150_000L, minutes(2));
    insert("Quần jean nam", 450_000L, minutes(3));

    assertThat(names(search("50%", ProductSort.NEWEST))).containsExactly("Giảm 50% áo thun");
  }

  @Test
  void findPage_withAnUnderscoreBetweenWords_searchesBothWords() {
    insert("Áo thun cổ tròn", 250_000L, minutes(1));
    insert("Áo len", 350_000L, minutes(2));

    assertThat(names(search("ao_thun", ProductSort.NEWEST))).containsExactly("Áo thun cổ tròn");
  }

  // ============================================================
  // Relevance: three groups, the newest first in each (AC19)
  // ============================================================

  @Test
  void findPage_byRelevance_putsTheThreeGroupsOfAc19InOrder() {
    insert("Áo thun cổ tròn", 250_000L, minutes(1));
    insert("Combo 3 áo thun", 399_000L, minutes(2));
    insert("Áo khoác thun nỉ", 650_000L, minutes(3));

    assertThat(names(search("ao thun", ProductSort.RELEVANCE)))
        .containsExactly("Áo thun cổ tròn", "Combo 3 áo thun", "Áo khoác thun nỉ");
  }

  @Test
  void findPage_byRelevance_putsTheNewestFirstWithinAGroup() {
    insert("Áo thun cổ tròn", 250_000L, minutes(1));
    insert("Áo khoác thun nỉ", 650_000L, minutes(2));
    insert("Combo 3 áo thun", 399_000L, minutes(3));
    insert("Áo thun polo", 300_000L, minutes(4));
    insert("Set 2 áo thun", 450_000L, minutes(5));
    insert("Áo len pha thun", 500_000L, minutes(6));

    assertThat(names(search("ao thun", ProductSort.RELEVANCE)))
        .containsExactly(
            "Áo thun polo",
            "Áo thun cổ tròn",
            "Set 2 áo thun",
            "Combo 3 áo thun",
            "Áo len pha thun",
            "Áo khoác thun nỉ");
  }

  @Test
  void findPage_byRelevance_comparesThePhraseWithoutAccentsOrCase() {
    insert("Combo ÁO THUN", 399_000L, minutes(1));
    insert("Thun áo", 250_000L, minutes(2));

    assertThat(names(search("Áo Thun", ProductSort.RELEVANCE)))
        .containsExactly("Combo ÁO THUN", "Thun áo");
  }

  // ============================================================
  // Sorts (AC20): the newest first between equal prices
  // ============================================================

  @Test
  void findPage_byNewest_putsTheLastCreatedFirst() {
    insert("Áo thun cổ tròn", 250_000L, minutes(1));
    insert("Quần jean nam", 450_000L, minutes(3));
    insert("Bao tay len", 90_000L, minutes(2));

    assertThat(names(list(ProductSort.NEWEST)))
        .containsExactly("Quần jean nam", "Bao tay len", "Áo thun cổ tròn");
  }

  @Test
  void findPage_byPriceAsc_putsTheNewerOfTwoEqualPricesFirst() {
    insert("Quần jean nam", 450_000L, minutes(1));
    insert("Áo thun cũ", 250_000L, minutes(2));
    insert("Bao tay len", 90_000L, minutes(3));
    insert("Áo thun mới", 250_000L, minutes(4));

    assertThat(names(list(ProductSort.PRICE_ASC)))
        .containsExactly("Bao tay len", "Áo thun mới", "Áo thun cũ", "Quần jean nam");
  }

  @Test
  void findPage_byPriceDesc_putsTheNewerOfTwoEqualPricesFirst() {
    insert("Quần jean nam", 450_000L, minutes(1));
    insert("Áo thun cũ", 250_000L, minutes(2));
    insert("Bao tay len", 90_000L, minutes(3));
    insert("Áo thun mới", 250_000L, minutes(4));

    assertThat(names(list(ProductSort.PRICE_DESC)))
        .containsExactly("Quần jean nam", "Áo thun mới", "Áo thun cũ", "Bao tay len");
  }

  @Test
  void findPage_byPrice_ordersTheWholeLongRange() {
    insert("Đồng hồ cũ", 9_999_999_999L, ProductStatus.HIDDEN, minutes(1));
    insert("Áo thun", 250_000L, ProductStatus.ACTIVE, minutes(2));

    Result result =
        repository.findPage(new Criteria(null, EVERY_STATUS, ProductSort.PRICE_DESC, 0, 20));

    assertThat(result.items()).extracting(Row::priceVnd).containsExactly(9_999_999_999L, 250_000L);
  }

  // ============================================================
  // Status filter (AC3, NFR9)
  // ============================================================

  @Test
  void findPage_withStatusActive_leavesOutHiddenProducts() {
    insert("Áo thun cổ tròn", 250_000L, ProductStatus.ACTIVE, minutes(1));
    insert("Bao tay len", 0L, ProductStatus.HIDDEN, minutes(2));

    Result result = repository.findPage(new Criteria(null, ONLY_ACTIVE, ProductSort.NEWEST, 0, 24));

    assertThat(names(result)).containsExactly("Áo thun cổ tròn");
    assertThat(result.totalItems()).isEqualTo(1);
  }

  @Test
  void findPage_withStatusActiveAndAKeyword_leavesOutAHiddenProductThatMatches() {
    insert("Áo thun cổ tròn", 250_000L, ProductStatus.ACTIVE, minutes(1));
    insert("Áo thun cũ", 0L, ProductStatus.HIDDEN, minutes(2));

    Result result =
        repository.findPage(
            new Criteria(terms("ao thun"), ONLY_ACTIVE, ProductSort.RELEVANCE, 0, 24));

    assertThat(names(result)).containsExactly("Áo thun cổ tròn");
    assertThat(result.totalItems()).isEqualTo(1);
  }

  @Test
  void findPage_withStatusHidden_findsOnlyHiddenProducts() {
    insert("Áo thun cổ tròn", 250_000L, ProductStatus.ACTIVE, minutes(1));
    insert("Bao tay len", 0L, ProductStatus.HIDDEN, minutes(2));

    Result result = repository.findPage(new Criteria(null, ONLY_HIDDEN, ProductSort.NEWEST, 0, 20));

    assertThat(names(result)).containsExactly("Bao tay len");
    assertThat(result.totalItems()).isEqualTo(1);
  }

  @Test
  void findPage_withEveryStatus_findsEveryStatus() {
    insert("Áo thun cổ tròn", 250_000L, ProductStatus.ACTIVE, minutes(1));
    insert("Bao tay len", 0L, ProductStatus.HIDDEN, minutes(2));

    Result result =
        repository.findPage(new Criteria(null, EVERY_STATUS, ProductSort.NEWEST, 0, 20));

    assertThat(names(result)).containsExactly("Bao tay len", "Áo thun cổ tròn");
    assertThat(result.totalItems()).isEqualTo(2);
  }

  // ============================================================
  // Paging: total, offset, and no repeat or gap on ties (NFR18)
  // ============================================================

  @Test
  void findPage_givesTheTotalOfTheFilterAndNotOfThePage() {
    for (int i = 1; i <= 25; i++) {
      insert("Áo thun " + i, 100_000L + i, minutes(i));
    }

    Result first = repository.findPage(new Criteria(null, EVERY_STATUS, ProductSort.NEWEST, 0, 20));
    Result second =
        repository.findPage(new Criteria(null, EVERY_STATUS, ProductSort.NEWEST, 20, 20));
    Result beyond =
        repository.findPage(new Criteria(null, EVERY_STATUS, ProductSort.NEWEST, 40, 20));

    assertThat(first.items()).hasSize(20);
    assertThat(first.items().getFirst().name()).isEqualTo("Áo thun 25");
    assertThat(second.items())
        .extracting(Row::name)
        .containsExactly("Áo thun 5", "Áo thun 4", "Áo thun 3", "Áo thun 2", "Áo thun 1");
    assertThat(beyond.items()).isEmpty();
    assertThat(List.of(first.totalItems(), second.totalItems(), beyond.totalItems()))
        .containsOnly(25L);
  }

  @ParameterizedTest
  @EnumSource(ProductSort.class)
  void findPage_pagesThroughEqualPricesAndDatesWithoutRepeatOrGap(ProductSort sort) {
    List<UUID> ids = new ArrayList<>();
    for (int i = 1; i <= 7; i++) {
      ids.add(insert("Áo thun " + i, 250_000L, T0));
    }
    ProductSearchTerms search = sort == ProductSort.RELEVANCE ? terms("ao thun") : null;

    List<UUID> paged = new ArrayList<>();
    for (int offset = 0; offset < 9; offset += 3) {
      Result page = repository.findPage(new Criteria(search, EVERY_STATUS, sort, offset, 3));
      page.items().forEach(row -> paged.add(row.id()));
      assertThat(page.totalItems()).isEqualTo(7);
    }

    // id DESC is the last key: the latest UUIDv7 first.
    assertThat(paged).containsExactlyElementsOf(ids.reversed());
  }

  // ============================================================
  // Row
  // ============================================================

  @Test
  void findPage_readsEveryColumnOfTheRow() {
    UUID id = insert("Combo 3 áo thun", 399_000L, ProductStatus.HIDDEN, minutes(1));
    jdbc.sql(
            """
UPDATE app.products
   SET compare_at_price_vnd = 450000, availability = 'OUT_OF_STOCK', slug = 'Combo-3-Ao'
 WHERE id = :id
""")
        .param("id", id)
        .update();
    // trg_products_set_updated_at sets it to now() on the update.
    Instant updatedAt =
        jdbc.sql("SELECT updated_at FROM app.products WHERE id = ?")
            .param(id)
            .query(Timestamp.class)
            .single()
            .toInstant();

    Row row =
        repository
            .findPage(new Criteria(null, EVERY_STATUS, ProductSort.NEWEST, 0, 20))
            .items()
            .getFirst();

    assertThat(row)
        .isEqualTo(
            new Row(
                id,
                "Combo 3 áo thun",
                "Combo-3-Ao",
                399_000L,
                450_000L,
                ProductStatus.HIDDEN,
                ProductAvailability.OUT_OF_STOCK,
                minutes(1),
                updatedAt));
  }

  @Test
  void findPage_readsAMissingCompareAtPriceAsNull() {
    insert("Áo thun cổ tròn", 250_000L, minutes(1));

    Row row = list(ProductSort.NEWEST).items().getFirst();

    assertThat(row.compareAtPriceVnd()).isNull();
    assertThat(row.availability()).isEqualTo(ProductAvailability.IN_STOCK);
  }

  // ============================================================
  // Two SQL statements per list, none for a keyword with no word (NFR2)
  // ============================================================

  @ParameterizedTest
  @EnumSource(ProductSort.class)
  void findPage_runsExactlyTwoStatements_aPageAndATotal(ProductSort sort) {
    for (int i = 1; i <= 30; i++) {
      insert("Áo thun " + i, 100_000L + i, minutes(i));
    }
    AtomicInteger statements = new AtomicInteger();
    ProductQueryRepository counted = countingRepository(statements);
    ProductSearchTerms search = sort == ProductSort.RELEVANCE ? terms("ao thun") : terms("ao");

    Result result = counted.findPage(new Criteria(search, ONLY_ACTIVE, sort, 0, 24));

    assertThat(result.items()).hasSize(24);
    assertThat(statements).hasValue(2);
  }

  @Test
  void findPage_withAKeywordThatHasNoWord_runsNoStatement() {
    AtomicInteger statements = new AtomicInteger();
    ProductQueryRepository counted = countingRepository(statements);

    Result result =
        counted.findPage(new Criteria(terms("%"), EVERY_STATUS, ProductSort.NEWEST, 0, 20));

    assertThat(result.items()).isEmpty();
    assertThat(result.totalItems()).isZero();
    assertThat(statements).hasValue(0);
  }

  // ============================================================
  // Sitemap (SHOP-32): ACTIVE only, by id, two statements
  // ============================================================

  @Test
  void findSitemapPage_listsOnlyActiveProducts_inTheOrderOfTheirIds() {
    UUID first = insert("Áo thun cổ tròn", 250_000L, minutes(3));
    insert("Bao tay len", 90_000L, ProductStatus.HIDDEN, minutes(2));
    UUID third = insert("Quần jean nam", 450_000L, minutes(1));

    SitemapResult result = repository.findSitemapPage(0, 1_000);

    assertThat(result.items())
        .extracting(SitemapRow::slug)
        .containsExactly(slugOf(first), slugOf(third));
    assertThat(result.totalItems()).isEqualTo(2);
  }

  @Test
  void findSitemapPage_readsTheSlugAsSavedAndTheLastUpdate() {
    UUID id = insert("Áo thun cổ tròn", 250_000L, minutes(7));
    jdbc.sql("UPDATE app.products SET slug = 'Ao-Thun-Cu' WHERE id = :id").param("id", id).update();
    Instant updatedAt =
        jdbc.sql("SELECT updated_at FROM app.products WHERE id = :id")
            .param("id", id)
            .query(Timestamp.class)
            .single()
            .toInstant();

    SitemapResult result = repository.findSitemapPage(0, 1_000);

    assertThat(result.items()).containsExactly(new SitemapRow("Ao-Thun-Cu", updatedAt));
  }

  @Test
  void findSitemapPage_pagesThroughEveryActiveProductWithoutRepeatOrGap() {
    List<String> active = new ArrayList<>();
    for (int i = 1; i <= 25; i++) {
      active.add(slugOf(insert("Áo thun " + i, 100_000L, minutes(1))));
      insert("Ẩn " + i, 100_000L, ProductStatus.HIDDEN, minutes(1));
    }

    List<String> slugs = new ArrayList<>();
    for (int offset = 0; offset < 25; offset += 10) {
      SitemapResult page = repository.findSitemapPage(offset, 10);
      assertThat(page.totalItems()).isEqualTo(25);
      page.items().forEach(row -> slugs.add(row.slug()));
    }

    assertThat(slugs).containsExactlyElementsOf(active);
  }

  @Test
  void findSitemapPage_withAnOffsetPastTheEnd_returnsNoRowButTheTotal() {
    insert("Áo thun cổ tròn", 250_000L, minutes(1));

    SitemapResult result = repository.findSitemapPage(1_000, 1_000);

    assertThat(result.items()).isEmpty();
    assertThat(result.totalItems()).isEqualTo(1);
  }

  @Test
  void findSitemapPage_runsExactlyTwoStatements_aPageAndATotal() {
    for (int i = 1; i <= 30; i++) {
      insert("Áo thun " + i, 100_000L, minutes(i));
    }
    AtomicInteger statements = new AtomicInteger();
    ProductQueryRepository counted = countingRepository(statements);

    SitemapResult result = counted.findSitemapPage(0, 1_000);

    assertThat(result.items()).hasSize(30);
    assertThat(statements).hasValue(2);
  }

  @ParameterizedTest
  @ValueSource(ints = {0, -1, 1_001})
  void findSitemapPage_withALimitOutOfRange_fails(int limit) {
    assertThatThrownBy(() -> repository.findSitemapPage(0, limit))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void findSitemapPage_withANegativeOffset_fails() {
    assertThatThrownBy(() -> repository.findSitemapPage(-1, 1_000))
        .isInstanceOf(IllegalArgumentException.class);
  }

  // ============================================================
  // Helpers
  // ============================================================

  private String slugOf(UUID id) {
    return jdbc.sql("SELECT slug::text FROM app.products WHERE id = :id")
        .param("id", id)
        .query(String.class)
        .single();
  }

  private Result search(String q, ProductSort sort) {
    return repository.findPage(new Criteria(terms(q), EVERY_STATUS, sort, 0, 24));
  }

  private Result list(ProductSort sort) {
    return repository.findPage(new Criteria(null, EVERY_STATUS, sort, 0, 24));
  }

  private static ProductSearchTerms terms(String q) {
    return ProductSearchTerms.of(q).orElseThrow();
  }

  private static List<String> names(Result result) {
    return result.items().stream().map(Row::name).toList();
  }

  private static Instant minutes(int minutes) {
    return T0.plusSeconds(60L * minutes);
  }

  private UUID insert(String name, long priceVnd, Instant createdAt) {
    return insert(name, priceVnd, ProductStatus.ACTIVE, createdAt);
  }

  /**
   * Inserts as {@code v0.3.0} does, with a chosen {@code created_at}. The ids grow with each
   * insert, as UUIDv7 do, so {@code id DESC} puts the last insert first.
   */
  private UUID insert(String name, long priceVnd, ProductStatus status, Instant createdAt) {
    sequence++;
    UUID id = new UUID(0x019a_0000_0000_7000L, 0x8000_0000_0000_0000L | sequence);
    jdbc.sql(
            """
            INSERT INTO app.products
                (id, name, slug, price_vnd, status, availability, created_at, updated_at)
            VALUES (:id, :name, :slug, :priceVnd, :status, 'IN_STOCK', :createdAt, :createdAt)
            """)
        .param("id", id)
        .param("name", name)
        .param("slug", "p-" + sequence)
        .param("priceVnd", priceVnd)
        .param("status", status.name())
        .param("createdAt", Timestamp.from(createdAt))
        .update();
    return id;
  }

  private long count(String sql) {
    return jdbc.sql(sql).query(Long.class).single();
  }

  /**
   * A repository on the connection of the test transaction, which sees the rows of the test,
   * counting each statement it prepares or creates.
   */
  private ProductQueryRepository countingRepository(AtomicInteger statements) {
    Connection connection = DataSourceUtils.getConnection(dataSource);
    DataSource counting =
        new SingleConnectionDataSource(countingConnection(connection, statements), true);
    return new ProductQueryRepository(JdbcClient.create(counting));
  }

  private static Connection countingConnection(Connection target, AtomicInteger statements) {
    return (Connection)
        Proxy.newProxyInstance(
            Connection.class.getClassLoader(),
            new Class<?>[] {Connection.class},
            (proxy, method, args) -> {
              String name = method.getName();
              if (name.equals("prepareStatement")
                  || name.equals("createStatement")
                  || name.equals("prepareCall")) {
                statements.incrementAndGet();
              }
              return invoke(target, method, args);
            });
  }

  private static Object invoke(Object target, java.lang.reflect.Method method, Object[] args)
      throws Throwable {
    try {
      return method.invoke(target, args);
    } catch (InvocationTargetException e) {
      throw e.getCause();
    }
  }
}
