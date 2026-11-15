package com.tungph7.learnpostgres.feature.product.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;
import com.tungph7.learnpostgres.feature.product.dto.CreateProductRequest;
import com.tungph7.learnpostgres.feature.product.dto.UpdatePriceRequest;
import com.tungph7.learnpostgres.feature.product.repository.ProductRepository;

import tools.jackson.databind.ObjectMapper;

/**
 * The code of {@code v0.2.0} on schema V4 (SHOP-13; NFR17): its write paths ({@code POST}, {@code
 * PUT .../price}, {@code PUT .../bulk-price}) keep the new columns right through the trigger of V4,
 * and its read path sees the price {@code v0.3.0} writes. The other product tests of {@code v0.2.0}
 * run unchanged on the same schema.
 */
@SpringBootTest
@AutoConfigureMockMvc
class LegacyProductWritesOnV4IntegrationTest extends AbstractContainerBaseTest {

  @Autowired MockMvc mockMvc;
  @Autowired ObjectMapper json;
  @Autowired ProductRepository repository;
  @Autowired Flyway flyway;
  @Autowired DataSource dataSource;
  @Autowired PlatformTransactionManager transactionManager;

  private JdbcClient jdbc;
  private TransactionTemplate transaction;

  @BeforeEach
  void setUp() {
    jdbc = JdbcClient.create(dataSource);
    // The pool runs with auto-commit off: a write of the test commits in a transaction of its own.
    transaction = new TransactionTemplate(transactionManager);
  }

  @AfterEach
  void cleanup() {
    repository.deleteAll();
  }

  @Test
  void the_product_tests_run_on_schema_v4_with_ddl_auto_validate() {
    assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("4");
  }

  // ============================================================
  // POST /api/products
  // ============================================================

  @Test
  void POST_of_v020_fills_the_new_columns() throws Exception {
    UUID id = create("Áo thun cổ tròn", "ao-thun-co-tron", "250000.00");

    Map<String, Object> row = row(id);
    assertThat(row.get("price_vnd")).isEqualTo(250_000L);
    assertThat(row.get("compare_at_price_vnd")).isNull();
    assertThat(row.get("status")).isEqualTo("ACTIVE");
    assertThat(row.get("availability")).isEqualTo("IN_STOCK");
    assertThat(row.get("name_search")).isEqualTo(" ao thun co tron ");
  }

  @ParameterizedTest
  @ValueSource(strings = {"0.00", "1000000000.00"})
  void POST_of_v020_with_a_price_the_new_rules_refuse_creates_a_hidden_product(String price)
      throws Exception {
    UUID id = create("Bao tay len", "bao-tay-len", price);

    assertThat(row(id).get("status")).isEqualTo("HIDDEN");
  }

  // ============================================================
  // PUT /api/products/{id}/price
  // ============================================================

  @Test
  void PUT_price_of_v020_rounds_into_price_vnd_and_drops_a_compare_at_price_no_longer_above_it()
      throws Exception {
    UUID id = create("Khăn lụa", "khan-lua", "250000.00");
    setCompareAtPriceAsV030(id, 300_000L);

    mockMvc
        .perform(
            put("/api/products/{id}/price", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    json.writeValueAsBytes(new UpdatePriceRequest(new BigDecimal("300000.40")))))
        .andExpect(status().isOk());

    Map<String, Object> row = row(id);
    assertThat(row.get("price")).isEqualTo(new BigDecimal("300000.40"));
    assertThat(row.get("price_vnd")).isEqualTo(300_000L);
    assertThat(row.get("compare_at_price_vnd")).isNull();
    assertThat(row.get("status")).isEqualTo("ACTIVE");
  }

  @Test
  void PUT_price_of_v020_hides_at_zero_and_a_later_valid_price_leaves_the_product_hidden()
      throws Exception {
    UUID id = create("Khăn lụa", "khan-lua", "250000.00");

    putPrice(id, "0.00");
    assertThat(row(id).get("status")).isEqualTo("HIDDEN");

    putPrice(id, "120000.00");
    assertThat(row(id).get("price_vnd")).isEqualTo(120_000L);
    assertThat(row(id).get("status")).isEqualTo("HIDDEN");
  }

  // ============================================================
  // PUT /api/products/bulk-price/{slug}
  // ============================================================

  @Test
  void PUT_bulk_price_of_v020_rounds_into_price_vnd() throws Exception {
    UUID id = create("Khăn lụa", "khan-lua", "250000.00");

    putBulkPrice("khan-lua", "199999.50");

    assertThat(row(id).get("price_vnd")).isEqualTo(200_000L);
    assertThat(row(id).get("status")).isEqualTo("ACTIVE");
  }

  @Test
  void PUT_bulk_price_of_v020_above_999999999_hides_the_product() throws Exception {
    UUID id = create("Khăn lụa", "khan-lua", "250000.00");

    putBulkPrice("khan-lua", "1500000000.00");

    assertThat(row(id).get("price_vnd")).isEqualTo(1_500_000_000L);
    assertThat(row(id).get("status")).isEqualTo("HIDDEN");
  }

  // ============================================================
  // Rollback: v0.2.0 reads what v0.3.0 writes
  // ============================================================

  @Test
  void GET_of_v020_reads_the_price_of_a_product_v030_wrote() throws Exception {
    UUID id = UUID.randomUUID();
    transaction.executeWithoutResult(
        tx ->
            jdbc.sql(
                    """
                    INSERT INTO app.products
                        (availability, compare_at_price_vnd, created_at, created_by, description,
                         name, price_vnd, slug, status, updated_at, updated_by, version, id)
                    VALUES ('IN_STOCK', 250000, now(), 'system', NULL, 'Áo thun cổ tròn', 200000,
                            'ao-thun-co-tron', 'ACTIVE', now(), 'system', 0, ?)
                    """)
                .param(id)
                .update());

    String body =
        mockMvc
            .perform(get("/api/products/{id}", id))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(json.readTree(body).get("price").decimalValue())
        .isEqualByComparingTo(new BigDecimal("200000"));
  }

  // ============================================================
  // Helpers
  // ============================================================

  private UUID create(String name, String slug, String price) throws Exception {
    String body =
        mockMvc
            .perform(
                post("/api/products")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        json.writeValueAsBytes(
                            new CreateProductRequest(name, slug, new BigDecimal(price), null))))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return UUID.fromString(json.readTree(body).get("id").asText());
  }

  private void putPrice(UUID id, String price) throws Exception {
    mockMvc
        .perform(
            put("/api/products/{id}/price", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(new UpdatePriceRequest(new BigDecimal(price)))))
        .andExpect(status().isOk());
  }

  private void putBulkPrice(String slug, String price) throws Exception {
    mockMvc
        .perform(
            put("/api/products/bulk-price/{slug}", slug)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(new UpdatePriceRequest(new BigDecimal(price)))))
        .andExpect(status().isOk())
        .andExpect(content().string("1"));
  }

  /** What v0.3.0 does when an admin sets a compare-at price: only the new columns. */
  private void setCompareAtPriceAsV030(UUID id, long compareAtPriceVnd) {
    transaction.executeWithoutResult(
        tx ->
            jdbc.sql("UPDATE app.products SET compare_at_price_vnd = ? WHERE id = ?")
                .params(compareAtPriceVnd, id)
                .update());
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
