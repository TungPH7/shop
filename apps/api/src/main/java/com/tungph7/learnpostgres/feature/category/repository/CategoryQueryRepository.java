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

  /**
   * What a shopper sees of the categories: only {@code VISIBLE} ones, a constant of the SQL, so no
   * request can list a hidden one (NFR8).
   */
  private static final String VISIBLE_ONLY = " WHERE c.status = 'VISIBLE'";

  /** A category has at least one {@code ACTIVE} product (AC17, AC19). */
  private static final String HAS_A_PRODUCT_ON_SALE =
      " AND EXISTS (SELECT 1 FROM app.products p"
          + " WHERE p.category_id = c.id AND p.status = 'ACTIVE')";

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

  /** One category as a shopper sees it: its name and its slug as stored. */
  public record StoreRow(String name, String slug) {}

  /**
   * One category of the sitemap of the store.
   *
   * @param updatedAt the later of the last update of the category and of its {@code ACTIVE}
   *     products (AC19)
   */
  public record SitemapRow(String slug, Instant updatedAt) {}

  /**
   * The {@code VISIBLE} categories that have at least one {@code ACTIVE} product, in the order of
   * names (AC17): the links of the product list of the store, in one statement (NFR2).
   */
  @Transactional(readOnly = true)
  public List<StoreRow> findStoreList() {
    return jdbc.sql(
            "SELECT c.name, c.slug::text AS slug FROM app.categories c"
                + VISIBLE_ONLY
                + HAS_A_PRODUCT_ON_SALE
                + " ORDER BY c.name, c.id")
        .query((rs, rowNum) -> new StoreRow(rs.getString("name"), rs.getString("slug")))
        .list();
  }

  /**
   * The {@code VISIBLE} category with this slug, compared ignoring case ({@code citext}), with or
   * without products on sale (AC15); empty for a hidden, deleted or unknown slug alike (NFR8).
   */
  @Transactional(readOnly = true)
  public Optional<StoreRow> findVisibleBySlug(String slug) {
    return jdbc.sql(
            "SELECT c.name, c.slug::text AS slug FROM app.categories c"
                + VISIBLE_ONLY
                + " AND c.slug OPERATOR(public.=) CAST(:slug AS public.citext)")
        .param("slug", slug)
        .query((rs, rowNum) -> new StoreRow(rs.getString("name"), rs.getString("slug")))
        .optional();
  }

  /**
   * The {@code VISIBLE} categories that have at least one {@code ACTIVE} product, in the order of
   * their ids, with their last update (AC19): one statement (NFR2). A hidden product does not move
   * the last update, since it is not on the page of the category.
   */
  @Transactional(readOnly = true)
  public List<SitemapRow> findSitemap() {
    return jdbc.sql(
            "SELECT c.slug::text AS slug, greatest(c.updated_at,"
                + " (SELECT max(p.updated_at) FROM app.products p"
                + " WHERE p.category_id = c.id AND p.status = 'ACTIVE')) AS updated_at"
                + " FROM app.categories c"
                + VISIBLE_ONLY
                + HAS_A_PRODUCT_ON_SALE
                + " ORDER BY c.id")
        .query(
            (rs, rowNum) ->
                new SitemapRow(rs.getString("slug"), rs.getTimestamp("updated_at").toInstant()))
        .list();
  }

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
   * Locks a category about to be deleted, and reads its slug for the log of the delete; empty when
   * no category has this id.
   *
   * <p>{@code FOR UPDATE} holds the category until the delete commits: an edit of a product that
   * sets this category then waits on its foreign key check, so no product joins the category before
   * the delete (ADR-0004). An assign that already holds the category ({@code FOR KEY SHARE}) makes
   * the lock wait until it commits.
   */
  @Transactional
  public Optional<String> lockForDelete(UUID id) {
    return jdbc.sql("SELECT c.slug::text FROM app.categories c WHERE c.id = :id FOR UPDATE")
        .param("id", id)
        .query(String.class)
        .optional();
  }

  /**
   * Deletes a category, locked first by {@link #lockForDelete}, in one statement, and returns the
   * number of its products, on sale or hidden, for the log (NFR11); empty when no category has this
   * id.
   *
   * <p>The count is in the {@code RETURNING} of the {@code DELETE}. This statement starts once the
   * lock is held, so its snapshot sees a product that an assign added while the lock waited, which
   * a count in the statement of the lock misses (SHOP-85, finding c450b3b0). {@code RETURNING} is
   * computed before the foreign key {@code products_category_fk} ({@code ON DELETE SET NULL})
   * leaves the products without category, at the end of the same statement (NFR15).
   */
  @Transactional
  public Optional<Long> delete(UUID id) {
    return jdbc.sql("DELETE FROM app.categories c WHERE c.id = :id RETURNING " + PRODUCT_COUNT)
        .param("id", id)
        .query(Long.class)
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
