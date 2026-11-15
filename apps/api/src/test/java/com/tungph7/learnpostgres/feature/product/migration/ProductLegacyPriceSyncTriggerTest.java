package com.tungph7.learnpostgres.feature.product.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.jdbc.core.simple.JdbcClient;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;

/**
 * {@code trg_products_sync_legacy_price} of V4, one test or set of tests per row of the table
 * "Trigger đồng bộ" in the plan of SHOP-7 (ADR-0001). Each write uses the column list of the
 * version it stands for: Hibernate of {@code v0.2.0} writes {@code price} and never the new
 * columns; the entity of {@code v0.3.0} writes the new columns and never {@code price}.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ProductLegacyPriceSyncTriggerTest extends AbstractContainerBaseTest {

  private MigrationDatabase db;
  private JdbcClient jdbc;

  @BeforeAll
  void createV4Database() {
    db = MigrationDatabase.create(POSTGRES);
    jdbc = db.jdbc();
    db.flyway().migrate();
  }

  @AfterEach
  void deleteProducts() {
    jdbc.sql("DELETE FROM app.products").update();
  }

  @AfterAll
  void dropDatabase() {
    db.close();
  }

  // ============================================================
  // INSERT by v0.2.0: price_vnd is NULL
  // ============================================================

  @ParameterizedTest(name = "price {0} -> price_vnd {1}, {2}")
  @CsvSource({
    "250000.00,     250000,      ACTIVE",
    "199999.50,     200000,      ACTIVE",
    "0.50,          1,           ACTIVE",
    "999999999.49,  999999999,   ACTIVE",
    "0.00,          0,           HIDDEN",
    "0.49,          0,           HIDDEN",
    "999999999.50,  1000000000,  HIDDEN",
    "9999999999.99, 10000000000, HIDDEN"
  })
  void an_insert_by_v020_gets_the_rounded_price_and_is_hidden_when_that_price_is_invalid(
      String price, long priceVnd, String status) {
    UUID id = insertAsV020("Áo thun cổ tròn", "ao-thun-co-tron", price);

    Map<String, Object> row = row(id);
    assertThat(row.get("price")).isEqualTo(new BigDecimal(price));
    assertThat(row.get("price_vnd")).isEqualTo(priceVnd);
    assertThat(row.get("status")).isEqualTo(status);
    assertThat(row.get("availability")).isEqualTo("IN_STOCK");
    assertThat(row.get("compare_at_price_vnd")).isNull();
    assertThat(row.get("name_search")).isEqualTo(" ao thun co tron ");
  }

  // ============================================================
  // INSERT by v0.3.0: price is NULL
  // ============================================================

  @Test
  void an_insert_by_v030_copies_price_vnd_to_price_and_keeps_its_other_columns() {
    UUID id =
        insertAsV030(
            "Đầm maxi đỏ 2026", "dam-maxi-do-2026", 200_000L, 250_000L, "HIDDEN", "OUT_OF_STOCK");

    Map<String, Object> row = row(id);
    assertThat(row.get("price")).isEqualTo(new BigDecimal("200000.00"));
    assertThat(row.get("price_vnd")).isEqualTo(200_000L);
    assertThat(row.get("compare_at_price_vnd")).isEqualTo(250_000L);
    assertThat(row.get("status")).isEqualTo("HIDDEN");
    assertThat(row.get("availability")).isEqualTo("OUT_OF_STOCK");
    assertThat(row.get("name_search")).isEqualTo(" dam maxi do 2026 ");
  }

  @Test
  void an_insert_that_writes_both_prices_keeps_price_vnd_and_copies_it_to_price() {
    UUID id =
        jdbc.sql(
                """
                INSERT INTO app.products (id, name, slug, price, price_vnd)
                VALUES (gen_random_uuid(), 'Cả hai giá', 'ca-hai-gia', 1.00, 300000)
                RETURNING id
                """)
            .query(UUID.class)
            .single();

    assertThat(row(id).get("price")).isEqualTo(new BigDecimal("300000.00"));
    assertThat(row(id).get("price_vnd")).isEqualTo(300_000L);
  }

  // ============================================================
  // UPDATE by v0.3.0: price_vnd changes
  // ============================================================

  @Test
  void an_update_by_v030_of_price_vnd_copies_it_to_price() {
    UUID id =
        insertAsV030(
            "Áo thun cổ tròn", "ao-thun-co-tron", 200_000L, 250_000L, "ACTIVE", "IN_STOCK");

    updateAsV030(id, "Áo thun cổ tròn", 180_000L, 250_000L, "ACTIVE", "IN_STOCK");

    Map<String, Object> row = row(id);
    assertThat(row.get("price")).isEqualTo(new BigDecimal("180000.00"));
    assertThat(row.get("price_vnd")).isEqualTo(180_000L);
    assertThat(row.get("compare_at_price_vnd")).isEqualTo(250_000L);
    assertThat(row.get("status")).isEqualTo("ACTIVE");
  }

  @Test
  void an_update_by_v030_of_a_hidden_legacy_product_leaves_the_status_it_sends() {
    UUID id = insertAsV020("Bao tay len", "bao-tay-len", "0.00");

    updateAsV030(id, "Bao tay len", 150_000L, null, "ACTIVE", "IN_STOCK");

    Map<String, Object> row = row(id);
    assertThat(row.get("price")).isEqualTo(new BigDecimal("150000.00"));
    assertThat(row.get("price_vnd")).isEqualTo(150_000L);
    assertThat(row.get("status")).isEqualTo("ACTIVE");
  }

  @Test
  void an_update_that_changes_both_prices_keeps_price_vnd_and_copies_it_to_price() {
    UUID id = insertAsV020("Quần jean nam", "quan-jean-nam", "450000.00");

    jdbc.sql("UPDATE app.products SET price = 1.00, price_vnd = 460000 WHERE id = ?")
        .param(id)
        .update();

    assertThat(row(id).get("price")).isEqualTo(new BigDecimal("460000.00"));
    assertThat(row(id).get("price_vnd")).isEqualTo(460_000L);
  }

  // ============================================================
  // UPDATE by v0.2.0 (PUT .../price, bulk-price): price changes, price_vnd does not
  // ============================================================

  /** The two price writes of v0.2.0, with the SQL each one sends. */
  enum V020PriceWrite {
    /** {@code ProductService.updatePrice}: Hibernate updates every mapped column. */
    UPDATE_PRICE(
        """
        UPDATE app.products
           SET description = description, name = name, price = :price, slug = slug,
               updated_at = now(), updated_by = 'system', version = version + 1
         WHERE id = :id
        """),
    /** {@code bulkUpdatePriceBySlug}: JPQL {@code UPDATE Product p SET p.price = :price}. */
    BULK_PRICE(
        "UPDATE app.products SET price = :price WHERE slug = (SELECT slug FROM app.products WHERE"
            + " id = :id)");

    private final String sql;

    V020PriceWrite(String sql) {
      this.sql = sql;
    }

    void apply(JdbcClient jdbc, UUID id, String price) {
      jdbc.sql(sql).param("price", new BigDecimal(price)).param("id", id).update();
    }
  }

  @ParameterizedTest
  @EnumSource(V020PriceWrite.class)
  void a_price_write_by_v020_rounds_the_new_price_into_price_vnd(V020PriceWrite write) {
    UUID id = insertAsV020("Khăn lụa", "khan-lua", "250000.00");

    write.apply(jdbc, id, "199999.50");

    Map<String, Object> row = row(id);
    assertThat(row.get("price")).isEqualTo(new BigDecimal("199999.50"));
    assertThat(row.get("price_vnd")).isEqualTo(200_000L);
    assertThat(row.get("status")).isEqualTo("ACTIVE");
  }

  @ParameterizedTest
  @EnumSource(V020PriceWrite.class)
  void a_price_write_by_v020_of_zero_hides_the_product(V020PriceWrite write) {
    UUID id = insertAsV020("Khăn lụa", "khan-lua", "250000.00");

    write.apply(jdbc, id, "0.00");

    assertThat(row(id).get("price_vnd")).isEqualTo(0L);
    assertThat(row(id).get("status")).isEqualTo("HIDDEN");
  }

  @ParameterizedTest
  @EnumSource(V020PriceWrite.class)
  void a_price_write_by_v020_above_999999999_hides_the_product_and_drops_its_compare_at_price(
      V020PriceWrite write) {
    UUID id = insertAsV030("Khăn lụa", "khan-lua", 200_000L, 250_000L, "ACTIVE", "IN_STOCK");

    write.apply(jdbc, id, "1000000000.00");

    Map<String, Object> row = row(id);
    assertThat(row.get("price_vnd")).isEqualTo(1_000_000_000L);
    assertThat(row.get("status")).isEqualTo("HIDDEN");
    assertThat(row.get("compare_at_price_vnd")).isNull();
  }

  @ParameterizedTest
  @EnumSource(V020PriceWrite.class)
  void a_price_write_by_v020_keeps_a_compare_at_price_still_above_the_new_price(
      V020PriceWrite write) {
    UUID id = insertAsV030("Khăn lụa", "khan-lua", 200_000L, 250_000L, "ACTIVE", "IN_STOCK");

    write.apply(jdbc, id, "240000.00");

    assertThat(row(id).get("price_vnd")).isEqualTo(240_000L);
    assertThat(row(id).get("compare_at_price_vnd")).isEqualTo(250_000L);
  }

  @ParameterizedTest(name = "{0}, new price {1}")
  @CsvSource({
    "UPDATE_PRICE, 250000.00",
    "UPDATE_PRICE, 260000.00",
    "BULK_PRICE,   250000.00",
    "BULK_PRICE,   260000.00"
  })
  void a_price_write_by_v020_drops_a_compare_at_price_no_longer_above_the_new_price(
      V020PriceWrite write, String price) {
    UUID id = insertAsV030("Khăn lụa", "khan-lua", 200_000L, 250_000L, "ACTIVE", "IN_STOCK");

    write.apply(jdbc, id, price);

    assertThat(row(id).get("compare_at_price_vnd")).isNull();
    assertThat(row(id).get("status")).isEqualTo("ACTIVE");
  }

  @ParameterizedTest
  @EnumSource(V020PriceWrite.class)
  void a_hidden_product_stays_hidden_when_v020_gives_it_a_valid_price(V020PriceWrite write) {
    UUID id = insertAsV020("Bao tay len", "bao-tay-len", "0.00");

    write.apply(jdbc, id, "120000.00");

    assertThat(row(id).get("price_vnd")).isEqualTo(120_000L);
    assertThat(row(id).get("status")).isEqualTo("HIDDEN");
  }

  // ============================================================
  // Any other UPDATE: no price column changes
  // ============================================================

  @Test
  void an_update_by_v030_that_keeps_price_vnd_leaves_both_prices_as_they_are() {
    // NFR16: 9,999,999,999.99 became 10,000,000,000, which price NUMERIC(12,2) cannot hold.
    UUID id = insertAsV020("Máy ảnh cổ", "may-anh-co", "9999999999.99");

    updateAsV030(id, "Máy ảnh cổ Leica", 10_000_000_000L, null, "HIDDEN", "OUT_OF_STOCK");

    Map<String, Object> row = row(id);
    assertThat(row.get("price")).isEqualTo(new BigDecimal("9999999999.99"));
    assertThat(row.get("price_vnd")).isEqualTo(10_000_000_000L);
    assertThat(row.get("availability")).isEqualTo("OUT_OF_STOCK");
    assertThat(row.get("name_search")).isEqualTo(" may anh co leica ");
  }

  @Test
  void an_update_by_v030_that_keeps_price_vnd_leaves_a_price_with_a_fraction_as_it_is() {
    UUID id = insertAsV020("Khăn lụa", "khan-lua", "199999.50");

    updateAsV030(id, "Khăn lụa", 200_000L, 250_000L, "ACTIVE", "IN_STOCK");

    Map<String, Object> row = row(id);
    assertThat(row.get("price")).isEqualTo(new BigDecimal("199999.50"));
    assertThat(row.get("price_vnd")).isEqualTo(200_000L);
    assertThat(row.get("compare_at_price_vnd")).isEqualTo(250_000L);
  }

  @Test
  void an_update_by_v020_with_the_same_price_leaves_the_new_columns_as_they_are() {
    UUID id = insertAsV030("Khăn lụa", "khan-lua", 200_000L, 250_000L, "HIDDEN", "OUT_OF_STOCK");

    V020PriceWrite.UPDATE_PRICE.apply(jdbc, id, "200000.00");

    Map<String, Object> row = row(id);
    assertThat(row.get("price_vnd")).isEqualTo(200_000L);
    assertThat(row.get("compare_at_price_vnd")).isEqualTo(250_000L);
    assertThat(row.get("status")).isEqualTo("HIDDEN");
    assertThat(row.get("availability")).isEqualTo("OUT_OF_STOCK");
  }

  // ============================================================
  // Helpers: the SQL of each version
  // ============================================================

  /** The INSERT Hibernate sends for the entity of v0.2.0 (columns in its order). */
  private UUID insertAsV020(String name, String slug, String price) {
    UUID id = UUID.randomUUID();
    jdbc.sql(
            """
            INSERT INTO app.products
                (created_at, created_by, description, name, price, slug, updated_at, updated_by,
                 version, id)
            VALUES (now(), 'system', NULL, ?, ?, ?, now(), 'system', 0, ?)
            """)
        .params(name, new BigDecimal(price), slug, id)
        .update();
    return id;
  }

  /** The INSERT of the entity of v0.3.0, which maps the new columns and not price. */
  private UUID insertAsV030(
      String name,
      String slug,
      long priceVnd,
      Long compareAtPriceVnd,
      String status,
      String availability) {
    UUID id = UUID.randomUUID();
    jdbc.sql(
            """
            INSERT INTO app.products
                (availability, compare_at_price_vnd, created_at, created_by, description, name,
                 price_vnd, slug, status, updated_at, updated_by, version, id)
            VALUES (?, ?, now(), 'system', NULL, ?, ?, ?, ?, now(), 'system', 0, ?)
            """)
        .params(availability, compareAtPriceVnd, name, priceVnd, slug, status, id)
        .update();
    return id;
  }

  /** The UPDATE of the entity of v0.3.0: every mapped column, price excepted. */
  private void updateAsV030(
      UUID id,
      String name,
      long priceVnd,
      Long compareAtPriceVnd,
      String status,
      String availability) {
    jdbc.sql(
            """
            UPDATE app.products
               SET availability = ?, compare_at_price_vnd = ?, description = description,
                   name = ?, price_vnd = ?, slug = slug, status = ?, updated_at = now(),
                   updated_by = 'system', version = version + 1
             WHERE id = ?
            """)
        .params(availability, compareAtPriceVnd, name, priceVnd, status, id)
        .update();
  }

  private Map<String, Object> row(UUID id) {
    return jdbc.sql(
            """
            SELECT price, price_vnd, compare_at_price_vnd, status, availability, name_search
              FROM app.products WHERE id = ?
            """)
        .param(id)
        .query()
        .singleRow();
  }
}
