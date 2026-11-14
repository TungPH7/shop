package com.tungph7.learnpostgres.feature.product.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;
import com.tungph7.learnpostgres.common.config.JpaAuditingConfig;
import com.tungph7.learnpostgres.feature.product.domain.Product;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
// @DataJpaTest does not auto-load auditing — import the config explicitly.
@Import(JpaAuditingConfig.class)
class ProductRepositoryDataJpaTest extends AbstractContainerBaseTest {

  @Autowired ProductRepository repository;
  @Autowired EntityManager em;

  @Test
  void findBySlug_matches_case_insensitively_due_to_citext() {
    // The slug column is citext (case-insensitive UNIQUE) — findBySlug uses citext's equality
    // operator, so it matches regardless of letter case.
    Product p = new Product("Postgres Up & Running", "pg-uar", new BigDecimal("29.99"), null);
    repository.save(p);
    em.flush();

    assertThat(repository.findBySlug("pg-uar")).isPresent();
    assertThat(repository.findBySlug("PG-UAR")).isPresent(); // citext
    assertThat(repository.findBySlug("not-exist")).isEmpty();
  }

  @Test
  void save_assigns_uuid_v7_id_and_audit_fields() {
    Product p = new Product("X", "x-" + System.nanoTime(), new BigDecimal("1.00"), null);

    Product saved = repository.save(p);
    em.flush();

    assertThat(saved.getId()).isNotNull(); // BaseEntity @PrePersist -> UUIDv7
    assertThat(saved.getCreatedAt()).isNotNull(); // JPA Auditing
    assertThat(saved.getUpdatedAt()).isNotNull();
  }

  @Test
  void unique_constraint_violation_when_duplicate_slug() {
    Product a = new Product("A", "dup", new BigDecimal("1"), null);
    repository.save(a);
    em.flush();

    Product b = new Product("B", "dup", new BigDecimal("1"), null);
    repository.save(b);

    // Postgres UNIQUE constraint fires on flush
    assertThatThrownBy(em::flush).hasRootCauseInstanceOf(org.postgresql.util.PSQLException.class);
  }
}
