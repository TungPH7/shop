package com.tungph7.learnpostgres.feature.product.repository;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.tungph7.learnpostgres.feature.product.domain.Product;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {

  Optional<Product> findBySlug(String slug);

  /**
   * Bulk price update via JPQL {@code @Modifying} — this path does NOT fire the JPA Auditing
   * listener, so it is the classic "blind spot" for {@code @LastModifiedDate}.
   *
   * <p>Kept here to demonstrate that the {@code app.set_updated_at()} database trigger covers the
   * JPA blind spot. In real production, bulk updates should be used sparingly; this exists as a
   * defense-in-depth demonstration.
   */
  @Modifying
  @Query("UPDATE Product p SET p.price = :price WHERE p.slug = :slug")
  int bulkUpdatePriceBySlug(String slug, BigDecimal price);
}
