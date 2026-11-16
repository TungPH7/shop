package com.tungph7.learnpostgres.feature.product.repository;

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
   * Deletes the product with this id in one statement, without loading it or checking its version.
   *
   * @return 1 when a product was deleted, 0 when none has this id
   */
  @Transactional
  @Modifying(flushAutomatically = true, clearAutomatically = true)
  @Query("DELETE FROM Product p WHERE p.id = :id")
  int deleteProductById(@Param("id") UUID id);
}
