package com.tungph7.learnpostgres.feature.category.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import org.hibernate.annotations.Type;

import com.tungph7.learnpostgres.common.domain.BaseEntity;
import com.tungph7.learnpostgres.common.domain.CitextType;

/**
 * A product category, one level only, on {@code app.categories} of V7 and V8 (SHOP-81, SHOP-95;
 * ADR-0004, ADR-0005, ADR-0006).
 *
 * <p>The column {@code name} has the collation {@code app.vi_ci}: {@code ORDER BY name} is the
 * Vietnamese order, and {@code categories_name_unique} and every {@code =} on the name ignore case
 * but not accents. The Category Rules (name 1–60 characters, slug format, status) are checked by
 * Bean Validation at the API boundary, and the constraints of V7 back them (NFR14).
 *
 * <p>The products of a category are not mapped: {@code app.products.category_id} belongs to {@code
 * feature/product}, and the SQL of this feature reads it directly (plan of SHOP-81, Architecture
 * Decisions 5).
 */
@Entity
@Table(name = "categories", schema = "app")
public class Category extends BaseEntity {

  /** Whether shoppers see the category. Only {@code VISIBLE} categories are in the store (NFR8). */
  public enum CategoryStatus {
    VISIBLE,
    HIDDEN
  }

  @Column(name = "name", nullable = false, length = 60)
  private String name;

  /**
   * URL-friendly identifier, case-insensitive UNIQUE. {@link CitextType} binds it as text, so the
   * server casts it to {@code citext}.
   */
  @Type(CitextType.class)
  @Column(name = "slug", nullable = false, columnDefinition = "public.citext")
  private String slug;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 16)
  private CategoryStatus status;

  /**
   * Display order, 0–9999 (SHOP-95, ADR-0006): a smaller number comes first, equal numbers by name
   * then id. Checked by Bean Validation at the API boundary; {@code categories_display_order_range}
   * of V8 backs it (NFR9).
   */
  @Column(name = "display_order", nullable = false)
  private int displayOrder;

  /** JPA needs a default constructor, kept protected so business code does not use it. */
  protected Category() {
    // for JPA
  }

  public Category(String name, String slug, CategoryStatus status, int displayOrder) {
    this.name = name;
    this.slug = slug;
    this.status = status;
    this.displayOrder = displayOrder;
  }

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

  public CategoryStatus getStatus() {
    return status;
  }

  public void setStatus(CategoryStatus status) {
    this.status = status;
  }

  public int getDisplayOrder() {
    return displayOrder;
  }

  public void setDisplayOrder(int displayOrder) {
    this.displayOrder = displayOrder;
  }
}
