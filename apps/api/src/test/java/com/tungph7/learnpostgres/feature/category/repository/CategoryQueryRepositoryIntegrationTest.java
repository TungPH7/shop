package com.tungph7.learnpostgres.feature.category.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;

import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;
import com.tungph7.learnpostgres.feature.category.domain.Category.CategoryStatus;
import com.tungph7.learnpostgres.feature.category.repository.CategoryQueryRepository.AdminRow;
import com.tungph7.learnpostgres.feature.category.repository.CategoryQueryRepository.DeleteRow;

/**
 * The hand-written queries of {@link CategoryQueryRepository} on schema V7 (Testcontainers
 * PostgreSQL 17). Each test runs in a transaction that rolls back.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(CategoryQueryRepository.class)
class CategoryQueryRepositoryIntegrationTest extends AbstractContainerBaseTest {

  @Autowired CategoryQueryRepository repository;
  @Autowired DataSource dataSource;

  private JdbcClient jdbc;
  private int sequence;

  @BeforeEach
  void setUp() {
    jdbc = JdbcClient.create(dataSource);
    jdbc.sql("DELETE FROM app.products").update();
    jdbc.sql("DELETE FROM app.categories").update();
  }

  // ============================================================
  // The admin list (AC1, NFR17, NFR18)
  // ============================================================

  @Test
  void findAdminList_listsEveryCategoryWithItsProductCount() {
    UUID ao = category("Áo", "VISIBLE");
    UUID phuKien = category("Phụ kiện", "HIDDEN");
    product("ACTIVE", ao);
    product("ACTIVE", ao);
    product("HIDDEN", ao);
    product("ACTIVE", null);

    List<AdminRow> rows = repository.findAdminList();

    assertThat(rows).extracting(AdminRow::name).containsExactly("Áo", "Phụ kiện");
    assertThat(rows).extracting(AdminRow::id).containsExactly(ao, phuKien);
    assertThat(rows).extracting(AdminRow::productCount).containsExactly(3L, 0L);
    assertThat(rows)
        .extracting(AdminRow::status)
        .containsExactly(CategoryStatus.VISIBLE, CategoryStatus.HIDDEN);
  }

  @Test
  void findAdminList_returnsEachColumnAsSaved() {
    UUID ao = category("Áo", "VISIBLE");
    jdbc.sql(
            "UPDATE app.categories SET created_at = TIMESTAMPTZ '2026-11-22 02:10:00+00',"
                + " version = 4 WHERE id = ?")
        .param(ao)
        .update();

    AdminRow row = repository.findAdminList().getFirst();

    assertThat(row.slug()).isEqualTo("slug-1");
    assertThat(row.createdAt()).hasToString("2026-11-22T02:10:00Z");
    assertThat(row.updatedAt()).isNotNull();
    assertThat(row.version()).isEqualTo(4L);
  }

  @Test
  void findAdminList_sortsTheNamesOfNfr17InTheVietnameseOrder() {
    List<String> expected =
        List.of("An toàn", "Áo khoác", "Ăn vặt", "Bao tay", "Dép", "Đầm", "quần");
    for (String name : List.of("quần", "Đầm", "Ăn vặt", "Dép", "An toàn", "Bao tay", "Áo khoác")) {
      category(name, "VISIBLE");
    }

    assertThat(repository.findAdminList())
        .extracting(AdminRow::name)
        .containsExactlyElementsOf(expected);
  }

  @Test
  void findAdminList_withNoCategory_isEmpty() {
    assertThat(repository.findAdminList()).isEmpty();
  }

  // ============================================================
  // What the delete logs
  // ============================================================

  @Test
  void findForDelete_givesTheSlugAndTheNumberOfProducts() {
    UUID ao = category("Áo", "VISIBLE");
    product("ACTIVE", ao);
    product("HIDDEN", ao);

    assertThat(repository.findForDelete(ao)).contains(new DeleteRow("slug-1", 2L));
    assertThat(repository.findForDelete(UUID.randomUUID())).isEmpty();
  }

  // ============================================================
  // Helpers
  // ============================================================

  private UUID category(String name, String status) {
    sequence++;
    return jdbc.sql("INSERT INTO app.categories (name, slug, status) VALUES (?, ?, ?) RETURNING id")
        .params(name, "slug-" + sequence, status)
        .query(UUID.class)
        .single();
  }

  private void product(String status, UUID categoryId) {
    sequence++;
    jdbc.sql(
            "INSERT INTO app.products (name, slug, price_vnd, status, category_id)"
                + " VALUES (?, ?, 250000, ?, ?)")
        .params("Sản phẩm " + sequence, "san-pham-" + sequence, status, categoryId)
        .update();
  }
}
