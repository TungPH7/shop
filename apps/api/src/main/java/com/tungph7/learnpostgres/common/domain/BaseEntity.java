package com.tungph7.learnpostgres.common.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Version;

import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * Base class for all business entities.
 *
 * <p>Provides:
 *
 * <ul>
 *   <li>PK of type UUIDv7 (generated Java-side in {@code @PrePersist}; the database also has a
 *       {@code DEFAULT app.gen_uuid_v7()} fallback for inserts that bypass JPA).
 *   <li>Four audit fields ({@code created_at}, {@code updated_at}, {@code created_by}, {@code
 *       updated_by}) filled automatically by Spring Data JPA Auditing — see {@code
 *       JpaAuditingConfig}.
 *   <li>{@code @Version} for optimistic locking — Hibernate injects {@code WHERE version=?} into
 *       UPDATE statements and throws {@code OptimisticLockException} on mismatch.
 * </ul>
 *
 * <p>Inheritance: {@code @MappedSuperclass} — fields are merged into each concrete entity's table;
 * there is no separate table for {@code BaseEntity}.
 *
 * <p>Equals/hashCode: keyed on {@code id} (so the hashCode does not change when the entity is first
 * persisted).
 */
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity {

  @Id
  @Column(name = "id", nullable = false, updatable = false, columnDefinition = "uuid")
  private UUID id;

  @CreatedDate
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @LastModifiedDate
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @CreatedBy
  @Column(name = "created_by", nullable = false, updatable = false, length = 64)
  private String createdBy;

  @LastModifiedBy
  @Column(name = "updated_by", nullable = false, length = 64)
  private String updatedBy;

  @Version
  @Column(name = "version", nullable = false)
  private Long version;

  /**
   * Generates a UUIDv7 right before INSERT if the app code has not set the id. {@code @PrePersist}
   * runs once per INSERT only (never on UPDATE).
   */
  @PrePersist
  protected void onPrePersist() {
    if (id == null) {
      id = UuidV7.generate();
    }
  }

  // -----------------------------------------------------------------
  // Getters / setters — handwritten for clarity. Lombok may be used in
  // concrete entities; BaseEntity is intentionally explicit.
  // -----------------------------------------------------------------

  public UUID getId() {
    return id;
  }

  /**
   * Setter is intentionally package-private — only test or migration code should set the id
   * manually. Business code must not call it.
   */
  void setId(UUID id) {
    this.id = id;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public String getCreatedBy() {
    return createdBy;
  }

  public String getUpdatedBy() {
    return updatedBy;
  }

  public Long getVersion() {
    return version;
  }

  // -----------------------------------------------------------------
  // equals / hashCode keyed on id (Vlad Mihalcea pattern)
  // -----------------------------------------------------------------

  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (!(o instanceof BaseEntity that)) {
      return false;
    }
    // Two unsaved entities (id=null) are considered different, even if they share a class.
    return id != null && id.equals(that.id);
  }

  @Override
  public int hashCode() {
    // Constant per concrete class — does not change when the id is later assigned.
    return getClass().hashCode();
  }

  @Override
  public String toString() {
    return "%s{id=%s}".formatted(getClass().getSimpleName(), id);
  }
}
