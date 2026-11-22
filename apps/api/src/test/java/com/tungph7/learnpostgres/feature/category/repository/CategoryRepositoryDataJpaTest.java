package com.tungph7.learnpostgres.feature.category.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import java.util.UUID;

import javax.sql.DataSource;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;
import com.tungph7.learnpostgres.common.config.JpaAuditingConfig;
import com.tungph7.learnpostgres.common.error.ConstraintViolations;
import com.tungph7.learnpostgres.feature.category.domain.Category;
import com.tungph7.learnpostgres.feature.category.domain.Category.CategoryStatus;

/**
 * The entity {@link Category} and {@link CategoryRepository} on schema V7 (SHOP-82, step 3). Each
 * test runs in a transaction that rolls back.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(JpaAuditingConfig.class)
class CategoryRepositoryDataJpaTest extends AbstractContainerBaseTest {

  @Autowired CategoryRepository repository;
  @Autowired EntityManager em;
  @Autowired DataSource dataSource;

  private JdbcClient jdbc;

  @BeforeEach
  void setUp() {
    jdbc = JdbcClient.create(dataSource);
    jdbc.sql("DELETE FROM app.products").update();
    jdbc.sql("DELETE FROM app.categories").update();
  }

  // ============================================================
  // The entity
  // ============================================================

  @Test
  void save_writesTheNameSlugStatusAndAuditColumns() {
    Category saved =
        repository.saveAndFlush(new Category("Áo khoác", "ao-khoac", CategoryStatus.HIDDEN));

    Map<String, Object> row =
        jdbc.sql(
                "SELECT name, slug::text AS slug, status, version, created_by FROM app.categories"
                    + " WHERE id = ?")
            .param(saved.getId())
            .query()
            .singleRow();
    assertThat(row)
        .containsEntry("name", "Áo khoác")
        .containsEntry("slug", "ao-khoac")
        .containsEntry("status", "HIDDEN")
        .containsEntry("version", 0L)
        .containsEntry("created_by", "system");
    assertThat(saved.getId().version()).as("UUIDv7").isEqualTo(7);
    assertThat(saved.getCreatedAt()).isNotNull();
  }

  @Test
  void save_ofANameTakenIgnoringCase_breaksTheUniqueConstraintOfTheName() {
    repository.saveAndFlush(new Category("Áo", "ao", CategoryStatus.VISIBLE));

    assertThatThrownBy(
            () -> repository.saveAndFlush(new Category("ÁO", "ao-2", CategoryStatus.VISIBLE)))
        .isInstanceOf(DataIntegrityViolationException.class)
        .satisfies(
            e -> assertThat(ConstraintViolations.nameOf(e)).contains("categories_name_unique"));
  }

  // ============================================================
  // Names
  // ============================================================

  @Test
  void existsByName_ignoresCaseButNotAccents() {
    repository.saveAndFlush(new Category("Áo thun", "ao-thun", CategoryStatus.VISIBLE));

    assertThat(repository.existsByName("Áo thun")).isTrue();
    assertThat(repository.existsByName("áo THUN")).isTrue();
    assertThat(repository.existsByName("Ao thun")).isFalse();
    assertThat(repository.existsByName("Áo")).isFalse();
  }

  @Test
  void existsByNameAndIdNot_leavesOutTheCategoryItself() {
    Category ao = repository.saveAndFlush(new Category("Áo", "ao", CategoryStatus.VISIBLE));
    Category quan = repository.saveAndFlush(new Category("Quần", "quan", CategoryStatus.VISIBLE));

    assertThat(repository.existsByNameAndIdNot("áo", ao.getId())).isFalse();
    assertThat(repository.existsByNameAndIdNot("áo", quan.getId())).isTrue();
  }

  // ============================================================
  // Slugs, compared as citext
  // ============================================================

  @Test
  void existsBySlug_ignoresCase() {
    repository.saveAndFlush(new Category("Áo", "ao", CategoryStatus.VISIBLE));

    assertThat(repository.existsBySlug("ao")).isTrue();
    assertThat(repository.existsBySlug("AO")).isTrue();
    assertThat(repository.existsBySlug("ao-2")).isFalse();
  }

  @Test
  void findSlugsAmong_returnsTheTakenOnesAsStored() {
    repository.saveAndFlush(new Category("Áo thun", "ao-thun", CategoryStatus.VISIBLE));
    repository.saveAndFlush(new Category("Ao thun", "ao-thun-3", CategoryStatus.HIDDEN));
    repository.saveAndFlush(new Category("Áo thun dài", "ao-thun-dai", CategoryStatus.VISIBLE));

    assertThat(repository.findSlugsAmong(new String[] {"AO-THUN", "ao-thun-2", "ao-thun-3"}))
        .containsExactlyInAnyOrder("ao-thun", "ao-thun-3");
  }

  @Test
  void findVisibleIdBySlug_findsAVisibleCategoryIgnoringCaseAndNeverAHiddenOne() {
    Category ao = repository.saveAndFlush(new Category("Áo", "ao", CategoryStatus.VISIBLE));
    repository.saveAndFlush(new Category("Phụ kiện", "phu-kien", CategoryStatus.HIDDEN));

    assertThat(repository.findVisibleIdBySlug("AO")).contains(ao.getId());
    assertThat(repository.findVisibleIdBySlug("phu-kien")).isEmpty();
    assertThat(repository.findVisibleIdBySlug("khong-co")).isEmpty();
  }

  // ============================================================
  // The delete
  // ============================================================

  @Test
  void deleteCategoryById_deletesInOneStatementAndLeavesItsProductsWithoutCategory() {
    Category ao = repository.saveAndFlush(new Category("Áo", "ao", CategoryStatus.VISIBLE));
    UUID product = UUID.randomUUID();
    jdbc.sql(
            "INSERT INTO app.products (id, name, slug, price_vnd, category_id)"
                + " VALUES (?, 'Áo thun', 'ao-thun-xoa', 250000, ?)")
        .params(product, ao.getId())
        .update();

    int deleted = repository.deleteCategoryById(ao.getId());

    assertThat(deleted).isEqualTo(1);
    assertThat(repository.existsById(ao.getId())).isFalse();
    assertThat(
            jdbc.sql("SELECT category_id IS NULL FROM app.products WHERE id = ?")
                .param(product)
                .query(Boolean.class)
                .single())
        .isTrue();
    assertThat(repository.deleteCategoryById(ao.getId())).as("already gone").isZero();
  }
}
