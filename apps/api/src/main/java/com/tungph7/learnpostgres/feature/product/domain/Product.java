package com.tungph7.learnpostgres.feature.product.domain;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import org.hibernate.annotations.Type;

import com.tungph7.learnpostgres.common.domain.BaseEntity;
import com.tungph7.learnpostgres.common.domain.CitextType;

/**
 * Catalog product — the first business entity to extend {@link BaseEntity}.
 *
 * <p>Goals:
 *
 * <ul>
 *   <li>Verify the end-to-end pipeline: {@link BaseEntity} (UUIDv7) + JPA Auditing + database
 *       triggers.
 *   <li>Serve as a running example for downstream concerns (exception handling, validation,
 *       OpenAPI).
 * </ul>
 *
 * <p>Naming: the {@code app} schema is declared explicitly in {@code @Table} — consistent with the
 * JDBC URL's {@code currentSchema=app}, but explicit is safer than implicit.
 */
@Entity
@Table(name = "products", schema = "app")
public class Product extends BaseEntity {

  @Column(name = "name", nullable = false, length = 255)
  private String name;

  /**
   * URL-friendly identifier, case-insensitive UNIQUE.
   *
   * <p>Uses {@code @Type(CitextType.class)} instead of {@code @JdbcTypeCode(SqlTypes.OTHER)}:
   *
   * <ul>
   *   <li>{@code CitextType.getSqlType() = Types.OTHER} so {@code ddl-auto=validate} matches the
   *       {@code citext} metadata.
   *   <li>{@code CitextType.nullSafeSet()} explicitly uses {@code setString()}, so pgjdbc sends
   *       text with {@code Oid.UNSPECIFIED} (thanks to {@code stringtype=unspecified} in the JDBC
   *       URL) and the server casts to {@code citext}, storing plain text.
   *   <li>{@code @JdbcTypeCode(SqlTypes.OTHER)} alone is NOT enough because Hibernate's {@code
   *       ObjectJdbcType} binds strings via the binary (bytea) path, causing the database to store
   *       a hex string.
   * </ul>
   */
  @Type(CitextType.class)
  @Column(name = "slug", nullable = false, columnDefinition = "public.citext")
  private String slug;

  /**
   * Money — {@link BigDecimal} mapped to {@code numeric(12,2)}. NEVER use {@code double} or {@code
   * float}. {@code precision} = total digits, {@code scale} = digits after the decimal point.
   */
  @Column(name = "price", nullable = false, precision = 12, scale = 2)
  private BigDecimal price;

  @Column(name = "description")
  private String description;

  // -----------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------

  /** JPA needs a default constructor — kept protected so business code does not use it. */
  protected Product() {
    // for JPA
  }

  public Product(String name, String slug, BigDecimal price, String description) {
    this.name = name;
    this.slug = slug;
    this.price = price;
    this.description = description;
  }

  // -----------------------------------------------------------------
  // Getters / setters — handwritten (Lombok may be used if preferred)
  // -----------------------------------------------------------------

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getSlug() {
    return slug;
  }

  public void setSlug(String slug) {
    this.slug = slug;
  }

  public BigDecimal getPrice() {
    return price;
  }

  public void setPrice(BigDecimal price) {
    this.price = price;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }
}
