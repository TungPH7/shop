package com.tungph7.learnpostgres.feature.category.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.tungph7.learnpostgres.feature.category.domain.Category;

/**
 * Writes and single reads of {@link Category} through JPA. The lists are hand-written SQL in {@link
 * CategoryQueryRepository}.
 *
 * <p>The name is compared with a plain {@code =}: the column has the collation {@code app.vi_ci},
 * and the collation of a column wins over the default collation of a parameter, so the comparison
 * ignores case as {@code categories_name_unique} does (plan of SHOP-81, Architecture Decisions 6).
 *
 * <p>The slug is {@code citext}, whose operators live in schema {@code public}, while the servers
 * connect with {@code search_path = app}: every query on the slug names the operator, {@code
 * OPERATOR(public.=)}, in native SQL, as {@code ProductRepository} does.
 */
@Repository
public interface CategoryRepository extends JpaRepository<Category, UUID> {

  /** Whether a category has this name, ignoring case but not accents (AC4). */
  boolean existsByName(String name);

  /** Whether a category other than {@code id} has this name, ignoring case but not accents. */
  boolean existsByNameAndIdNot(String name, UUID id);

  /** Whether a category has this slug, compared case-insensitively ({@code citext}). */
  @Query(
      value =
          "SELECT EXISTS (SELECT 1 FROM app.categories"
              + " WHERE slug OPERATOR(public.=) CAST(:slug AS public.citext))",
      nativeQuery = true)
  boolean existsBySlug(@Param("slug") String slug);

  /**
   * The slugs of categories among the given ones, compared case-insensitively ({@code citext}), as
   * they are stored: every slug a generated slug and its suffixes could take, in one query. The
   * array is cast to {@code citext[]}, so the comparison ignores case.
   */
  @Query(
      value =
          "SELECT slug::text FROM app.categories"
              + " WHERE slug OPERATOR(public.=) ANY(CAST(:slugs AS public.citext[]))",
      nativeQuery = true)
  List<String> findSlugsAmong(@Param("slugs") String[] slugs);

  /**
   * The id of the {@code VISIBLE} category with this slug, compared case-insensitively: a hidden
   * category is never found, as if it did not exist (NFR8).
   */
  @Query(
      value =
          "SELECT id FROM app.categories"
              + " WHERE slug OPERATOR(public.=) CAST(:slug AS public.citext)"
              + " AND status = 'VISIBLE'",
      nativeQuery = true)
  Optional<UUID> findVisibleIdBySlug(@Param("slug") String slug);
}
