package com.tungph7.learnpostgres.feature.product.service;

import java.util.Optional;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.error.NotFoundException;
import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.domain.ProductSort;
import com.tungph7.learnpostgres.feature.product.dto.ProductPage;
import com.tungph7.learnpostgres.feature.product.dto.SitemapEntry;
import com.tungph7.learnpostgres.feature.product.dto.StoreProduct;
import com.tungph7.learnpostgres.feature.product.dto.StoreProductSummary;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Criteria;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Result;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.SitemapResult;
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
  private final ProductQueryRepository queryRepository;

  public StoreProductService(ProductRepository repository, ProductQueryRepository queryRepository) {
    this.repository = repository;
    this.queryRepository = queryRepository;
  }

  /**
   * One page of the {@code ACTIVE} products, newest first with {@code id DESC} as the last key
   * (NFR18), and their total. It runs the two statements of {@link ProductQueryRepository} (NFR2).
   *
   * @param offset the products to skip, 0 or more
   * @param limit the products of the page, 1 to {@value ProductQueryRepository#MAX_LIMIT}
   */
  public ProductPage<StoreProductSummary> list(int offset, int limit) {
    Result result =
        queryRepository.findPage(
            new Criteria(null, Set.of(ProductStatus.ACTIVE), ProductSort.NEWEST, offset, limit));
    return new ProductPage<>(
        result.items().stream().map(StoreProductSummary::from).toList(),
        result.totalItems(),
        offset,
        limit);
  }

  /**
   * One block of the sitemap: the slug and last update of {@code ACTIVE} products, in the order of
   * their ids, and their total (SHOP-32). Only {@code ACTIVE} products, whatever the request asks
   * (NFR9).
   *
   * @param offset the products to skip, 0 or more
   * @param limit the products of the block, 1 to {@value ProductQueryRepository#MAX_SITEMAP_LIMIT}
   */
  public ProductPage<SitemapEntry> sitemap(int offset, int limit) {
    SitemapResult result = queryRepository.findSitemapPage(offset, limit);
    return new ProductPage<>(
        result.items().stream().map(SitemapEntry::from).toList(),
        result.totalItems(),
        offset,
        limit);
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
