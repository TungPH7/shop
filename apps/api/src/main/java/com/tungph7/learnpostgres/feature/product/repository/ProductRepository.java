package com.tungph7.learnpostgres.feature.product.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.tungph7.learnpostgres.feature.product.domain.Product;

/**
 * Writes and single reads of {@link Product} through JPA. The list queries, with search, filter and
 * sort, are hand-written SQL in {@link ProductQueryRepository}.
 *
 * <p>The slug is {@code citext}, whose operators live in schema {@code public}. The servers connect
 * with {@code currentSchema=app}, so their {@code search_path} is {@code app} only: a plain {@code
 * =} on the slug finds no {@code citext} operator and compares as {@code text}, case-sensitively,
 * without the index of {@code products_slug_unique}. Every query on the slug therefore names the
 * operator, {@code OPERATOR(public.=)}, in native SQL, since JPQL cannot.
 */
@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {

  /** The SQL of {@link #findBySlugIgnoringCase}, with its one parameter {@code :slug}. */
  String BY_SLUG_SQL =
      "SELECT * FROM app.products WHERE slug OPERATOR(public.=) CAST(:slug AS public.citext)";

  /** The SQL of {@link #existsBySlug}, with its one parameter {@code :slug}. */
  String EXISTS_BY_SLUG_SQL =
      "SELECT EXISTS (SELECT 1 FROM app.products"
          + " WHERE slug OPERATOR(public.=) CAST(:slug AS public.citext))";

  /** The SQL of {@link #findSlugsAmong}, with its one parameter {@code :slugs}. */
  String SLUGS_AMONG_SQL =
      "SELECT slug::text FROM app.products"
          + " WHERE slug OPERATOR(public.=) ANY(CAST(:slugs AS public.citext[]))";

  /**
   * The product with this slug, compared case-insensitively ({@code citext}), whatever its status:
   * the store reads its detail through it ({@code StoreProductService}). An equality on the slug,
   * read in the index of {@code products_slug_unique} (NFR2).
   */
  @Query(value = BY_SLUG_SQL, nativeQuery = true)
  Optional<Product> findBySlugIgnoringCase(@Param("slug") String slug);

  /** Whether a product has this slug, compared case-insensitively ({@code citext}). */
  @Query(value = EXISTS_BY_SLUG_SQL, nativeQuery = true)
  boolean existsBySlug(@Param("slug") String slug);

  /**
   * The slugs of products among the given ones, compared case-insensitively ({@code citext}), as
   * they are stored: every slug a generated slug and its suffixes could take, read in one query.
   *
   * <p>An equality on the slug, so PostgreSQL can read the slugs in the index of {@code
   * products_slug_unique}; a {@code LIKE} on {@code citext} cannot use that index. The planner
   * chooses whether it does, from the size of the table and the number of slugs: with 10,000
   * products and the 1,000 slugs an add without slug tries, PostgreSQL 17 reads them in the index
   * in about 3 ms ({@code ProductRepositoryDataJpaTest}); on a small table it may read the whole
   * table instead. Native SQL, since JPQL has no array. The array is cast to {@code citext[]}: a
   * {@code text[]} would make PostgreSQL compare as {@code text}, case-sensitively.
   *
   * @param slugs the slugs to look for, such as {@code ao-thun}, {@code ao-thun-2}…
   */
  @Query(value = SLUGS_AMONG_SQL, nativeQuery = true)
  List<String> findSlugsAmong(@Param("slugs") String[] slugs);

  /**
   * The product with this id, its row locked until the transaction ends ({@code FOR NO KEY UPDATE}
   * or {@code FOR UPDATE}), for the edit (SHOP-85, finding 61aa3b05).
   *
   * <p>A category delete that empties this product holds its row until it commits, since the
   * foreign key {@code products_category_fk} sets {@code category_id} to {@code null} (ADR-0004).
   * The lock waits for that delete, then reads the row it left. An unlocked read would see the
   * category the delete is removing, and the edit would write it back.
   */
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("SELECT p FROM Product p WHERE p.id = :id")
  Optional<Product> findByIdForUpdate(@Param("id") UUID id);

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
