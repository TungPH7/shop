package com.tungph7.learnpostgres.feature.product.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.tungph7.learnpostgres.feature.product.domain.Product;

/**
 * Writes and single reads of {@link Product} through JPA. The list queries, with search, filter and
 * sort, are hand-written SQL in {@link ProductQueryRepository}.
 */
@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {

  /** The product with this slug, compared case-insensitively ({@code citext}). */
  Optional<Product> findBySlug(String slug);
}
