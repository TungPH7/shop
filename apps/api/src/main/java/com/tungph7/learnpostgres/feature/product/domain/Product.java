package com.tungph7.learnpostgres.feature.product.domain;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import org.hibernate.annotations.Type;

import com.tungph7.learnpostgres.common.domain.BaseEntity;
import com.tungph7.learnpostgres.common.domain.CitextType;

/**
 * A product of the catalog, on schema V4 of {@code app.products} (SHOP-7; ADR-0001, ADR-0002).
 *
 * <p>Prices are whole dong, {@code long} here and {@code BIGINT} in the database (NFR14). The
 * legacy column {@code price NUMERIC(12,2)} is deliberately not mapped: the trigger {@code
 * trg_products_sync_legacy_price} sets it from {@code price_vnd} on every write of this entity, so
 * {@code v0.2.0} still reads the right price after a rollback, and the contract step that drops the
 * column changes no Java (NFR22). Never map it again.
 *
 * <p>The generated column {@code name_search} is not mapped either: the database fills it from the
 * name, and only the list queries of {@code ProductQueryRepository} read it.
 *
 * <p>The Product Rules (name 1–150 characters, price 1–999,999,999, slug format…) are checked by
 * Bean Validation at the API boundary, and the CHECK constraints of V4 back them (NFR15). A product
 * written before the Epic may break the name and slug rules, and keeps them until an admin saves it
 * (NFR16), so the entity does not enforce them.
 */
@Entity
@Table(name = "products", schema = "app")
public class Product extends BaseEntity {

  /** Whether shoppers see the product. Only {@code ACTIVE} products are in the store (NFR9). */
  public enum ProductStatus {
    ACTIVE,
    HIDDEN
  }

  /** Whether the product is in stock. An {@code OUT_OF_STOCK} product stays in the store list. */
  public enum ProductAvailability {
    IN_STOCK,
    OUT_OF_STOCK
  }

  @Column(name = "name", nullable = false, length = 255)
  private String name;

  /**
   * URL-friendly identifier, case-insensitive UNIQUE. {@link CitextType} binds it as text, so the
   * server casts it to {@code citext} (see that class).
   */
  @Type(CitextType.class)
  @Column(name = "slug", nullable = false, columnDefinition = "public.citext")
  private String slug;

  @Column(name = "description")
  private String description;

  @Column(name = "price_vnd", nullable = false)
  private long priceVnd;

  @Column(name = "compare_at_price_vnd")
  private Long compareAtPriceVnd;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 16)
  private ProductStatus status;

  @Enumerated(EnumType.STRING)
  @Column(name = "availability", nullable = false, length = 16)
  private ProductAvailability availability;

  /**
   * The id of the category of the product, or {@code null} when it has none (SHOP-81). A plain
   * {@code UUID}, not a {@code @ManyToOne}: the product reads no category, and {@code
   * feature/product} checks the id through {@code CategoryRepository}. The foreign key {@code
   * products_category_fk} sets it to {@code null} when the category is deleted (ADR-0004).
   */
  @Column(name = "category_id")
  private UUID categoryId;

  /** JPA needs a default constructor — kept protected so business code does not use it. */
  protected Product() {
    // for JPA
  }

  public Product(
      String name,
      String slug,
      String description,
      long priceVnd,
      Long compareAtPriceVnd,
      ProductStatus status,
      ProductAvailability availability) {
    this.name = name;
    this.slug = slug;
    this.description = description;
    this.priceVnd = priceVnd;
    this.compareAtPriceVnd = compareAtPriceVnd;
    this.status = status;
    this.availability = availability;
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

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  /** The selling price, whole dong. */
  public long getPriceVnd() {
    return priceVnd;
  }

  public void setPriceVnd(long priceVnd) {
    this.priceVnd = priceVnd;
  }

  /** The compare-at price, whole dong, above the selling price; {@code null} when none. */
  public Long getCompareAtPriceVnd() {
    return compareAtPriceVnd;
  }

  public void setCompareAtPriceVnd(Long compareAtPriceVnd) {
    this.compareAtPriceVnd = compareAtPriceVnd;
  }

  public ProductStatus getStatus() {
    return status;
  }

  public void setStatus(ProductStatus status) {
    this.status = status;
  }

  public ProductAvailability getAvailability() {
    return availability;
  }

  public void setAvailability(ProductAvailability availability) {
    this.availability = availability;
  }

  /** The id of the category of the product, {@code null} when it has none. */
  public UUID getCategoryId() {
    return categoryId;
  }

  public void setCategoryId(UUID categoryId) {
    this.categoryId = categoryId;
  }
}
