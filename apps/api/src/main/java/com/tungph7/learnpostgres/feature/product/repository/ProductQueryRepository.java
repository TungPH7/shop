package com.tungph7.learnpostgres.feature.product.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Collections;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.domain.ProductSort;

/**
 * The product lists, in hand-written SQL through {@link JdbcClient} (plan of SHOP-7, Architecture
 * Decisions 6): search on the generated column {@code name_search} with {@code LIKE … ESCAPE}, the
 * "Liên quan nhất" groups with {@code CASE}, and {@code id} as the last sort key.
 *
 * <p>Each list runs two statements, a page and a total, and no more (NFR2). The SQL text is built
 * only from constants of this class: the {@code ORDER BY} comes from a fixed {@link ProductSort},
 * the number of {@code LIKE} conditions from the number of words, and every value the user sent —
 * the keyword, the statuses, the offset and the limit — goes into bind parameters (NFR10).
 */
@Repository
public class ProductQueryRepository {

  /** The most products one list returns (NFR3). */
  public static final int MAX_LIMIT = 100;

  private static final String COLUMNS =
      "p.id, p.name, p.slug, p.price_vnd, p.compare_at_price_vnd, p.status, p.availability,"
          + " p.created_at, p.updated_at";

  private static final String LAST_KEYS = "p.created_at DESC, p.id DESC";

  private static final RowMapper<Row> ROW_MAPPER = ProductQueryRepository::mapRow;

  private final JdbcClient jdbc;

  public ProductQueryRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  /**
   * What one list asks for.
   *
   * @param search the keyword, or {@code null} for no search
   * @param statuses the statuses to list, at least one and never {@code null}: the store always
   *     asks for {@link ProductStatus#ACTIVE} only (NFR9), and only the admin lists ask for every
   *     status, by naming every status. No value means "every status", so a caller that forgets the
   *     statuses fails instead of listing hidden products.
   * @param sort the order; {@link ProductSort#RELEVANCE} needs a keyword
   * @param offset the products to skip, 0 or more
   * @param limit the products of the page, 1 to {@value ProductQueryRepository#MAX_LIMIT}
   */
  public record Criteria(
      ProductSearchTerms search,
      Set<ProductStatus> statuses,
      ProductSort sort,
      int offset,
      int limit) {

    public Criteria {
      Objects.requireNonNull(statuses, "statuses");
      if (statuses.isEmpty()) {
        throw new IllegalArgumentException("No status to list");
      }
      statuses = Collections.unmodifiableSet(EnumSet.copyOf(statuses));
      Objects.requireNonNull(sort, "sort");
      if (sort == ProductSort.RELEVANCE && search == null) {
        throw new IllegalArgumentException("Sort RELEVANCE needs a keyword");
      }
      if (offset < 0) {
        throw new IllegalArgumentException("A negative offset: " + offset);
      }
      if (limit < 1 || limit > MAX_LIMIT) {
        throw new IllegalArgumentException("A limit out of 1 to " + MAX_LIMIT + ": " + limit);
      }
    }

    /**
     * Whether the criteria name every status, so the list needs no status condition: the column
     * {@code status} is NOT NULL and holds only the values of {@link ProductStatus}.
     */
    public boolean coversEveryStatus() {
      return statuses.size() == ProductStatus.values().length;
    }
  }

  /** One product of a list: every column of a summary, without the description. */
  public record Row(
      UUID id,
      String name,
      String slug,
      long priceVnd,
      Long compareAtPriceVnd,
      ProductStatus status,
      ProductAvailability availability,
      Instant createdAt,
      Instant updatedAt) {}

  /**
   * One page and the number of products that match the criteria.
   *
   * @param totalItems every product that matches, not only those of the page
   */
  public record Result(List<Row> items, long totalItems) {}

  /**
   * The page of products that match the criteria, and their total. A keyword with no word, such as
   * {@code %}, matches no product and runs no statement.
   */
  @Transactional(readOnly = true)
  public Result findPage(Criteria criteria) {
    if (criteria.search() != null && criteria.search().matchesNothing()) {
      return new Result(List.of(), 0);
    }
    Map<String, Object> params = new HashMap<>();
    String where = where(criteria, params);

    params.putAll(orderParams(criteria));
    params.put("limit", criteria.limit());
    params.put("offset", criteria.offset());
    List<Row> items =
        jdbc.sql(
                "SELECT "
                    + COLUMNS
                    + " FROM app.products p"
                    + where
                    + " ORDER BY "
                    + orderBy(criteria.sort())
                    + " LIMIT :limit OFFSET :offset")
            .params(params)
            .query(ROW_MAPPER)
            .list();
    long totalItems =
        jdbc.sql("SELECT count(*) FROM app.products p" + where)
            .params(params)
            .query(Long.class)
            .single();
    return new Result(items, totalItems);
  }

  /** The WHERE clause of the criteria; its values go to {@code params}. */
  private static String where(Criteria criteria, Map<String, Object> params) {
    StringBuilder where = new StringBuilder(" WHERE TRUE");
    if (!criteria.coversEveryStatus()) {
      where.append(" AND p.status IN (:statuses)");
      params.put("statuses", criteria.statuses().stream().map(ProductStatus::name).toList());
    }
    if (criteria.search() != null) {
      List<String> patterns = criteria.search().wordPatterns();
      for (int i = 0; i < patterns.size(); i++) {
        where.append(" AND p.name_search LIKE :word").append(i).append(" ESCAPE '\\'");
        params.put("word" + i, patterns.get(i));
      }
    }
    return where.toString();
  }

  /** The fixed ORDER BY of each sort; {@code id DESC} is always the last key (NFR18). */
  private static String orderBy(ProductSort sort) {
    return switch (sort) {
      case NEWEST -> LAST_KEYS;
      case PRICE_ASC -> "p.price_vnd ASC, " + LAST_KEYS;
      case PRICE_DESC -> "p.price_vnd DESC, " + LAST_KEYS;
      case RELEVANCE ->
          "CASE WHEN p.name_search LIKE :phraseAtStart ESCAPE '\\' THEN 1"
              + " WHEN p.name_search LIKE :phraseAtWordStart ESCAPE '\\' THEN 2"
              + " ELSE 3 END, "
              + LAST_KEYS;
    };
  }

  private static Map<String, Object> orderParams(Criteria criteria) {
    if (criteria.sort() != ProductSort.RELEVANCE) {
      return Map.of();
    }
    return Map.of(
        "phraseAtStart", criteria.search().phraseAtStartPattern(),
        "phraseAtWordStart", criteria.search().phraseAtWordStartPattern());
  }

  private static Row mapRow(ResultSet rs, int rowNum) throws SQLException {
    return new Row(
        rs.getObject("id", UUID.class),
        rs.getString("name"),
        rs.getString("slug"),
        rs.getLong("price_vnd"),
        rs.getObject("compare_at_price_vnd", Long.class),
        ProductStatus.valueOf(rs.getString("status")),
        ProductAvailability.valueOf(rs.getString("availability")),
        rs.getTimestamp("created_at").toInstant(),
        rs.getTimestamp("updated_at").toInstant());
  }
}
