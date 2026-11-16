package com.tungph7.learnpostgres.feature.product.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.tungph7.learnpostgres.feature.product.domain.Product;

/**
 * Writes and single reads of {@link Product} through JPA. The list queries, with search, filter and
 * sort, are hand-written SQL in {@link ProductQueryRepository}.
 */
@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {

  /** The product with this slug, compared case-insensitively ({@code citext}). */
  Optional<Product> findBySlug(String slug);

  /**
   * The product with this slug, compared ignoring case whatever the {@code search_path}.
   *
   * <p>The deployed app connects with {@code currentSchema=app}, so its {@code search_path} leaves
   * out {@code public}, where the {@code citext} operators are. A plain {@code slug = ?}, as {@link
   * #findBySlug} writes it, then falls back to the {@code =} of {@code text} and compares with
   * case. Naming the operator, {@code OPERATOR(public.=)}, keeps the comparison and the index of
   * {@code citext}.
   */
  @Query(
      value =
          "SELECT p.* FROM app.products p"
              + " WHERE p.slug OPERATOR(public.=) CAST(:slug AS public.citext)",
      nativeQuery = true)
  Optional<Product> findBySlugIgnoringCase(@Param("slug") String slug);

  /** Whether a product has this slug, compared case-insensitively ({@code citext}). */
  boolean existsBySlug(String slug);

  /** The SQL of {@link #findSlugsAmong}, with its one parameter {@code :slugs}. */
  String SLUGS_AMONG_SQL =
      "SELECT slug::text FROM app.products WHERE slug = ANY(CAST(:slugs AS public.citext[]))";

  /**
   * The slugs of products among the given ones, compared case-insensitively ({@code citext}), as
   * they are stored: every slug a generated slug and its suffixes could take, read in one query.
   *
   * <p>An equality on the slug, so each slug given is one lookup in the index of {@code
   * products_slug_unique}, whatever the size of the table; a {@code LIKE} on {@code citext} cannot
   * use that index. Native SQL, since JPQL has no array. The array is cast to {@code citext[]}: a
   * {@code text[]} would make PostgreSQL compare as {@code text}, case-sensitively.
   *
   * @param slugs the slugs to look for, such as {@code ao-thun}, {@code ao-thun-2}…
   */
  @Query(value = SLUGS_AMONG_SQL, nativeQuery = true)
  List<String> findSlugsAmong(@Param("slugs") String[] slugs);

  /**
   * Deletes the product with this id in one statement, without loading it or checking its version.
   *
   * @return 1 when a product was deleted, 0 when none has this id
   */
  @Transactional
  @Modifying(flushAutomatically = true, clearAutomatically = true)
  @Query("DELETE FROM Product p WHERE p.id = :id")
  int deleteProductById(@Param("id") UUID id);
}
