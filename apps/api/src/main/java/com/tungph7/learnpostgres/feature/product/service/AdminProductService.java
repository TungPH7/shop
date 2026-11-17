package com.tungph7.learnpostgres.feature.product.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tungph7.learnpostgres.common.error.ConflictException;
import com.tungph7.learnpostgres.common.error.ConstraintViolations;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.logging.CorrelationContext;
import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductAvailability;
import com.tungph7.learnpostgres.feature.product.domain.Product.ProductStatus;
import com.tungph7.learnpostgres.feature.product.domain.ProductSlugs;
import com.tungph7.learnpostgres.feature.product.domain.ProductSort;
import com.tungph7.learnpostgres.feature.product.dto.AdminProduct;
import com.tungph7.learnpostgres.feature.product.dto.AdminProductSummary;
import com.tungph7.learnpostgres.feature.product.dto.CreateProductRequest;
import com.tungph7.learnpostgres.feature.product.dto.ProductPage;
import com.tungph7.learnpostgres.feature.product.dto.ProductStatusFilter;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Criteria;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Result;
import com.tungph7.learnpostgres.feature.product.repository.ProductRepository;
import com.tungph7.learnpostgres.feature.product.repository.ProductSearchTerms;

/**
 * The admin API of products (SHOP-7, API Contract of the plan): the add, the list and the delete.
 *
 * <p>The slug of a new product, as the plan sets it:
 *
 * <ul>
 *   <li>typed: kept as it is; taken, ignoring case, is a 409 {@code PRODUCT_SLUG_DUPLICATED};
 *   <li>absent: generated from the name by {@link ProductSlugs}, with {@code -2}, {@code -3}… when
 *       taken, up to {@code -}{@value #MAX_SLUG_NUMBER}; past it, a 409 asks for a typed slug.
 * </ul>
 *
 * <p>The check for a taken slug runs before the insert, so two adds at once can both pass it. The
 * UNIQUE constraint {@code products_slug_unique} is the last guard (NFR12): a typed slug that loses
 * is a 409, and a generated slug that loses is tried again with the next free number, at most
 * {@value #MAX_SLUG_RETRIES} times. That is why this class is not {@code @Transactional}: each
 * insert runs in its own transaction, and a lost insert does not abort the next one.
 */
@Service
public class AdminProductService {

  /** How many times an add whose generated slug was taken meanwhile tries again. */
  static final int MAX_SLUG_RETRIES = 3;

  /** The highest suffix of a generated slug. */
  static final int MAX_SLUG_NUMBER = 1000;

  private static final String SLUG_TAKEN = "Product slug already exists.";
  private static final String NO_CORRELATION_ID = "none";

  private static final Logger log = LoggerFactory.getLogger(AdminProductService.class);

  private final ProductRepository repository;
  private final ProductQueryRepository queryRepository;
  private final CorrelationContext correlation;

  public AdminProductService(
      ProductRepository repository,
      ProductQueryRepository queryRepository,
      CorrelationContext correlation) {
    this.repository = repository;
    this.queryRepository = queryRepository;
    this.correlation = correlation;
  }

  /**
   * Adds a product from a valid request, and logs the add at INFO without the description or the
   * request (NFR12).
   *
   * @throws ConflictException {@code PRODUCT_SLUG_DUPLICATED} when the slug typed is taken, or when
   *     a generated slug kept being taken by adds at the same time
   */
  public AdminProduct create(CreateProductRequest request) {
    Product saved =
        request.slug() != null ? createWithTypedSlug(request) : createWithGeneratedSlug(request);
    log.info(
        "Product created: operation=create id={} slug={} correlationId={}",
        saved.getId(),
        saved.getSlug(),
        correlation.currentId().orElse(NO_CORRELATION_ID));
    return AdminProduct.from(saved);
  }

  /**
   * One page of products, newest first, with the search of the API Contract (section "Từ khóa q").
   *
   * @param q the keyword; {@code null} or blank is no search
   * @param status every status, or only one
   * @param offset the products to skip, 0 or more
   * @param limit the products of the page, 1 to {@value ProductQueryRepository#MAX_LIMIT}
   */
  public ProductPage<AdminProductSummary> list(
      String q, ProductStatusFilter status, int offset, int limit) {
    Result result =
        queryRepository.findPage(
            new Criteria(
                ProductSearchTerms.of(q).orElse(null),
                status.statuses(),
                ProductSort.NEWEST,
                offset,
                limit));
    return new ProductPage<>(
        result.items().stream().map(AdminProductSummary::from).toList(),
        result.totalItems(),
        offset,
        limit);
  }

  /**
   * Deletes a product, and does nothing when it is already gone, so the delete is idempotent
   * (NFR19). Each call is logged at INFO with the operation, the id, the slug and the correlation
   * id (NFR12).
   *
   * <p>The delete is one {@code DELETE} statement rather than a delete of the loaded entity: two
   * deletes of the same product at once then both succeed, instead of the second failing on the
   * version of a row already gone.
   */
  @Transactional
  public void delete(UUID id) {
    String slug = repository.findById(id).map(Product::getSlug).orElse(null);
    int deleted = repository.deleteProductById(id);
    String correlationId = correlation.currentId().orElse(NO_CORRELATION_ID);
    if (deleted > 0) {
      log.info(
          "Product deleted: operation=delete id={} slug={} correlationId={}",
          id,
          slug,
          correlationId);
    } else {
      log.info(
          "Product already gone, nothing deleted: operation=delete id={} correlationId={}",
          id,
          correlationId);
    }
  }

  private Product createWithTypedSlug(CreateProductRequest request) {
    if (repository.existsBySlug(request.slug())) {
      throw slugTaken(null);
    }
    try {
      return repository.saveAndFlush(newProduct(request, request.slug()));
    } catch (DataIntegrityViolationException e) {
      if (isSlugTaken(e)) {
        throw slugTaken(e);
      }
      throw e;
    }
  }

  private Product createWithGeneratedSlug(CreateProductRequest request) {
    String base = ProductSlugs.fromName(request.name());
    for (int retry = 0; ; retry++) {
      String slug = firstFreeSlug(base);
      try {
        return repository.saveAndFlush(newProduct(request, slug));
      } catch (DataIntegrityViolationException e) {
        if (!isSlugTaken(e)) {
          throw e;
        }
        if (retry == MAX_SLUG_RETRIES) {
          throw slugTaken(e);
        }
        log.info(
            "Generated slug taken by another add, trying the next number: slug={} retry={}",
            slug,
            retry + 1);
      }
    }
  }

  /**
   * {@code base} when free, else the first of {@code base-2}, {@code base-3}… up to {@code
   * base-}{@value #MAX_SLUG_NUMBER} that is free. The slugs taken among these candidates are read
   * in one query, then compared here, ignoring case as {@code citext} does.
   *
   * <p>The query asks for exactly the candidates, each built by {@link ProductSlugs#withSuffix}, so
   * it reads no other slug that only starts like the base, and it needs no property of how a long
   * base is cut: each candidate is the slug that would be saved.
   *
   * @throws ConflictException {@code PRODUCT_SLUG_DUPLICATED} when every number is taken
   */
  private String firstFreeSlug(String base) {
    List<String> candidates = slugCandidates(base);
    Set<String> taken =
        repository.findSlugsAmong(candidates.toArray(String[]::new)).stream()
            .map(slug -> slug.toLowerCase(Locale.ROOT))
            .collect(Collectors.toSet());
    return candidates.stream()
        .filter(slug -> !taken.contains(slug))
        .findFirst()
        .orElseThrow(() -> slugTaken(null));
  }

  /**
   * The slugs an add without slug may take, in the order it tries them: {@code base}, then {@code
   * base-2} to {@code base-}{@value #MAX_SLUG_NUMBER}.
   */
  static List<String> slugCandidates(String base) {
    List<String> candidates = new ArrayList<>(MAX_SLUG_NUMBER);
    candidates.add(base);
    for (int number = 2; number <= MAX_SLUG_NUMBER; number++) {
      candidates.add(ProductSlugs.withSuffix(base, number));
    }
    return candidates;
  }

  private static Product newProduct(CreateProductRequest request, String slug) {
    return new Product(
        request.name(),
        slug,
        request.description(),
        request.price().longValueExact(),
        toLong(request.compareAtPrice()),
        request.status() != null ? request.status() : ProductStatus.ACTIVE,
        request.availability() != null ? request.availability() : ProductAvailability.IN_STOCK);
  }

  private static Long toLong(BigDecimal value) {
    return value == null ? null : value.longValueExact();
  }

  /**
   * Whether the insert broke the UNIQUE constraint of the slug, and not another constraint, read as
   * {@code GlobalExceptionHandler} reads it.
   */
  private static boolean isSlugTaken(DataIntegrityViolationException e) {
    return ConstraintViolations.isViolationOf(e, ConstraintViolations.PRODUCT_SLUG_UNIQUE);
  }

  private static ConflictException slugTaken(Throwable cause) {
    return new ConflictException(ErrorCode.PRODUCT_SLUG_DUPLICATED, SLUG_TAKEN, cause);
  }
}
