package com.tungph7.learnpostgres.feature.category.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.tungph7.learnpostgres.feature.category.domain.Category.CategoryStatus;

/**
 * The category lists, in hand-written SQL through {@link JdbcClient} (plan of SHOP-81, Architecture
 * Decisions 6), as {@code ProductQueryRepository} does for products.
 *
 * <p>Each list is one statement, whose count does not grow with the number of categories or
 * products (NFR2), and sorts by {@code name, id}: the collation {@code app.vi_ci} of the column
 * gives the Vietnamese order, and the id breaks the ties (NFR17). The SQL reads {@code
 * app.products} directly and imports nothing of {@code feature/product} (Architecture Decisions 5).
 */
@Repository
public class CategoryQueryRepository {

  private static final String PRODUCT_COUNT =
      "(SELECT count(*) FROM app.products p WHERE p.category_id = c.id)";

  private final JdbcClient jdbc;

  public CategoryQueryRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  /** One category of the admin list, with every column and the number of its products. */
  public record AdminRow(
      UUID id,
      String name,
      String slug,
      CategoryStatus status,
      Instant createdAt,
      Instant updatedAt,
      long version,
      long productCount) {}

  /**
   * What the delete of a category logs (NFR11).
   *
   * @param productCount every product of the category, on sale or hidden
   */
  public record DeleteRow(String slug, long productCount) {}

  /**
   * Every category, visible or hidden, in the order of names, with the number of its products on
   * sale or hidden (AC1). The number is a {@code count(*)} subquery of the same statement, counted
   * when read and never stored (NFR18), and read in the index {@code idx_products_category_id}.
   */
  @Transactional(readOnly = true)
  public List<AdminRow> findAdminList() {
    return jdbc.sql(
            "SELECT c.id, c.name, c.slug::text AS slug, c.status, c.created_at, c.updated_at,"
                + " c.version, "
                + PRODUCT_COUNT
                + " AS product_count FROM app.categories c ORDER BY c.name, c.id")
        .query(CategoryQueryRepository::mapAdminRow)
        .list();
  }

  /**
   * The slug and the number of products of a category about to be deleted, in one statement, for
   * the log of the delete; empty when no category has this id.
   *
   * <p>{@code FOR UPDATE OF c} locks the category until the delete commits: an edit of a product
   * that sets this category then waits on its foreign key check, so no product joins the category
   * between this count and the delete (ADR-0004).
   */
  @Transactional
  public Optional<DeleteRow> findForDelete(UUID id) {
    return jdbc.sql(
            "SELECT c.slug::text AS slug, "
                + PRODUCT_COUNT
                + " AS product_count FROM app.categories c WHERE c.id = :id FOR UPDATE OF c")
        .param("id", id)
        .query((rs, rowNum) -> new DeleteRow(rs.getString("slug"), rs.getLong("product_count")))
        .optional();
  }

  private static AdminRow mapAdminRow(ResultSet rs, int rowNum) throws SQLException {
    return new AdminRow(
        rs.getObject("id", UUID.class),
        rs.getString("name"),
        rs.getString("slug"),
        CategoryStatus.valueOf(rs.getString("status")),
        rs.getTimestamp("created_at").toInstant(),
        rs.getTimestamp("updated_at").toInstant(),
        rs.getLong("version"),
        rs.getLong("product_count"));
  }
}
