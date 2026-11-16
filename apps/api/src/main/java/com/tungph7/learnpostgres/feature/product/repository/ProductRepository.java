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

  /** Whether a product has this slug, compared case-insensitively ({@code citext}). */
  boolean existsBySlug(String slug);

  /**
   * The slugs equal to {@code base} or matching the {@code LIKE} pattern, both compared
   * case-insensitively ({@code citext}): every slug a generated slug and its suffixes could take,
   * read in one query.
   *
   * <p>Native SQL, since JPQL refuses {@code LIKE} on the {@code citext} type of the slug. Both
   * parameters are cast to {@code citext}: a {@code text} parameter would make PostgreSQL compare
   * as {@code text}, case-sensitively.
   *
   * @param base the generated slug
   * @param pattern a {@code LIKE} pattern, such as {@code ao-thun-%}
   */
  @Query(
      value =
          "SELECT slug::text FROM app.products WHERE slug = CAST(:base AS public.citext)"
              + " OR slug LIKE CAST(:pattern AS public.citext)",
      nativeQuery = true)
  List<String> findSlugsOfFamily(@Param("base") String base, @Param("pattern") String pattern);

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
