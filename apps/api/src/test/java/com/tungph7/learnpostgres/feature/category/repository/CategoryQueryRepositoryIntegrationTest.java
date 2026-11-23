package com.tungph7.learnpostgres.feature.category.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

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
import com.tungph7.learnpostgres.feature.category.repository.CategoryQueryRepository.SitemapRow;
import com.tungph7.learnpostgres.feature.category.repository.CategoryQueryRepository.StoreRow;

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
  // The display order (SHOP-95: AC5, AC6, AC7, AC8, NFR11)
  // ============================================================

  @Test
  void findAdminList_returnsTheDisplayOrderOfEachCategory() {
    category("Áo", "VISIBLE", 7);
    category("Quần", "VISIBLE");

    assertThat(repository.findAdminList())
        .extracting(AdminRow::name, AdminRow::displayOrder)
        .containsExactly(tuple("Quần", 0), tuple("Áo", 7));
  }

  @Test
  void findAdminList_sortsTheCategoriesOfAc5ByDisplayOrderThenName_hiddenOnesIncluded() {
    theFourCategoriesOfAc5();

    assertThat(repository.findAdminList())
        .extracting(AdminRow::name)
        .containsExactly("Quần", "Bao tay", "Đầm", "Áo");
  }

  @Test
  void findStoreList_sortsTheCategoriesOfAc7ByDisplayOrderThenName() {
    for (UUID id : theFourCategoriesOfAc5()) {
      product("ACTIVE", id);
    }
    jdbc.sql("UPDATE app.categories SET status = 'VISIBLE'").update();

    assertThat(repository.findStoreList())
        .extracting(StoreRow::name)
        .containsExactly("Quần", "Bao tay", "Đầm", "Áo");
  }

  @Test
  void findStoreList_leavesOutTheHiddenCategoryOfAc5_andKeepsTheOrderOfTheOthers() {
    for (UUID id : theFourCategoriesOfAc5()) {
      product("ACTIVE", id);
    }

    assertThat(repository.findStoreList())
        .extracting(StoreRow::name)
        .containsExactly("Quần", "Bao tay", "Áo");
  }

  @Test
  void bothLists_sortTheThreeCategoriesOfAc8WithoutNumberByName() {
    for (String name : List.of("Quần", "Bao tay", "Áo khoác")) {
      product("ACTIVE", category(name, "VISIBLE"));
    }

    assertThat(repository.findAdminList())
        .extracting(AdminRow::name, AdminRow::displayOrder)
        .containsExactly(tuple("Áo khoác", 0), tuple("Bao tay", 0), tuple("Quần", 0));
    assertThat(repository.findStoreList())
        .extracting(StoreRow::name)
        .containsExactly("Áo khoác", "Bao tay", "Quần");
  }

  @Test
  void bothLists_compareTheDisplayOrderAsANumber_nineBeforeTen() {
    product("ACTIVE", category("Áo", "VISIBLE", 10));
    product("ACTIVE", category("Quần", "VISIBLE", 9));

    assertThat(repository.findAdminList()).extracting(AdminRow::name).containsExactly("Quần", "Áo");
    assertThat(repository.findStoreList()).extracting(StoreRow::name).containsExactly("Quần", "Áo");
  }

  @Test
  void bothLists_sortTheNamesOfNfr17AtTheSameNumberInTheVietnameseOrder() {
    List<String> expected =
        List.of("An toàn", "Áo khoác", "Ăn vặt", "Bao tay", "Dép", "Đầm", "quần");
    category("Zzz trước", "VISIBLE", 1);
    for (String name : List.of("quần", "Đầm", "Ăn vặt", "Dép", "An toàn", "Bao tay", "Áo khoác")) {
      product("ACTIVE", category(name, "VISIBLE", 3));
    }

    assertThat(repository.findAdminList())
        .extracting(AdminRow::name)
        .containsExactlyElementsOf(
            Stream.concat(Stream.of("Zzz trước"), expected.stream()).toList());
    assertThat(repository.findStoreList())
        .extracting(StoreRow::name)
        .containsExactlyElementsOf(expected);
  }

  @Test
  void findSitemap_staysInTheOrderOfIds_whateverTheDisplayOrder() {
    UUID first = category("Áo", "VISIBLE", 9);
    UUID second = category("Quần", "VISIBLE", 0);
    product("ACTIVE", second);
    product("ACTIVE", first);
    List<String> slugsById =
        jdbc.sql("SELECT slug::text FROM app.categories WHERE id IN (?, ?) ORDER BY id")
            .params(first, second)
            .query(String.class)
            .list();

    assertThat(repository.findSitemap())
        .extracting(SitemapRow::slug)
        .containsExactlyElementsOf(slugsById);
  }

  // ============================================================
  // The delete, and what it logs
  // ============================================================

  @Test
  void lockForDelete_givesTheSlug_orNothingForAnUnknownId() {
    UUID ao = category("Áo", "VISIBLE");

    assertThat(repository.lockForDelete(ao)).contains("slug-1");
    assertThat(repository.lockForDelete(UUID.randomUUID())).isEmpty();
  }

  @Test
  void delete_countsTheProductsThenLeavesThemWithoutCategory() {
    UUID ao = category("Áo", "VISIBLE");
    UUID other = category("Quần", "VISIBLE");
    product("ACTIVE", ao);
    product("HIDDEN", ao);
    product("ACTIVE", other);

    assertThat(repository.delete(ao)).contains(2L);

    assertThat(count("SELECT count(*) FROM app.categories WHERE id = ?", ao)).isZero();
    assertThat(count("SELECT count(*) FROM app.products WHERE category_id IS NULL", null))
        .isEqualTo(2);
    assertThat(count("SELECT count(*) FROM app.products WHERE category_id = ?", other))
        .isEqualTo(1);
  }

  @Test
  void delete_ofAnUnknownId_deletesNothing() {
    assertThat(repository.delete(UUID.randomUUID())).isEmpty();
  }

  // ============================================================
  // Helpers
  // ============================================================

  private long count(String sql, UUID id) {
    var statement = jdbc.sql(sql);
    return (id == null ? statement : statement.param(id)).query(Long.class).single();
  }

  private UUID category(String name, String status) {
    sequence++;
    return jdbc.sql("INSERT INTO app.categories (name, slug, status) VALUES (?, ?, ?) RETURNING id")
        .params(name, "slug-" + sequence, status)
        .query(UUID.class)
        .single();
  }

  private UUID category(String name, String status, int displayOrder) {
    sequence++;
    return jdbc.sql(
            "INSERT INTO app.categories (name, slug, status, display_order)"
                + " VALUES (?, ?, ?, ?) RETURNING id")
        .params(name, "slug-" + sequence, status, displayOrder)
        .query(UUID.class)
        .single();
  }

  /**
   * "Áo" 2, "Bao tay" 1, "Đầm" 1 and "Quần" 0, "Đầm" hidden (AC5, AC6, AC7 of SHOP-95), added in an
   * order that is neither of names nor of numbers.
   */
  private List<UUID> theFourCategoriesOfAc5() {
    return List.of(
        category("Đầm", "HIDDEN", 1),
        category("Áo", "VISIBLE", 2),
        category("Quần", "VISIBLE", 0),
        category("Bao tay", "VISIBLE", 1));
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
