package com.tungph7.learnpostgres.feature.product.service;

import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.error.NotFoundException;
import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.dto.StoreProduct;
import com.tungph7.learnpostgres.feature.product.repository.ProductRepository;

/**
 * The products of the store, as shoppers see them (SHOP-7, API Contract of the plan, ADR-0003):
 * only {@code ACTIVE} products, whatever the request asks (NFR9).
 */
@Service
public class StoreProductService {

  /**
   * The one detail of every 404 of the store. A hidden product, a deleted one and a slug that never
   * existed get the same body, so a shopper cannot tell them apart (NFR9).
   */
  static final String NOT_FOUND = "Product not found.";

  private final ProductRepository repository;

  public StoreProductService(ProductRepository repository) {
    this.repository = repository;
  }

  /**
   * The {@code ACTIVE} product with this slug, compared ignoring case ({@code citext}).
   *
   * @throws NotFoundException {@code PRODUCT_NOT_FOUND} when no product has this slug or the
   *     product is not {@code ACTIVE}
   */
  @Transactional(readOnly = true)
  public StoreProduct get(String slug) {
    return findActive(slug)
        .map(StoreProduct::from)
        .orElseThrow(() -> new NotFoundException(ErrorCode.PRODUCT_NOT_FOUND, NOT_FOUND));
  }

  /**
   * Whether a shopper can see the product with this slug: the same answer as {@link #get}, with no
   * product to build.
   */
  @Transactional(readOnly = true)
  public boolean isVisible(String slug) {
    return findActive(slug).isPresent();
  }

  private Optional<Product> findActive(String slug) {
    return repository
        .findBySlugIgnoringCase(slug)
        .filter(product -> product.getStatus() == ProductStatus.ACTIVE);
  }
}
