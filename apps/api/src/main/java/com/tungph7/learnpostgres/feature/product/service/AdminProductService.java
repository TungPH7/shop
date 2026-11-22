package com.tungph7.learnpostgres.feature.product.service;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import jakarta.persistence.EntityManager;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tungph7.learnpostgres.common.error.BadRequestException;
import com.tungph7.learnpostgres.common.error.ConflictException;
import com.tungph7.learnpostgres.common.error.ConstraintViolations;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.error.NotFoundException;
import com.tungph7.learnpostgres.common.logging.CorrelationContext;
import com.tungph7.learnpostgres.common.text.SlugFormat;
import com.tungph7.learnpostgres.common.text.Slugs;
import com.tungph7.learnpostgres.feature.category.repository.CategoryRepository;
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
import com.tungph7.learnpostgres.feature.product.dto.UpdateProductRequest;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Criteria;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository.Result;
import com.tungph7.learnpostgres.feature.product.repository.ProductRepository;
import com.tungph7.learnpostgres.feature.product.repository.ProductSearchTerms;

/**
 * The admin API of products (SHOP-7, API Contract of the plan): the add, the list, the read, the
 * edit and the delete.
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
 *
 * <p>The edit ({@link #update}) checks, in this order: the product exists (404), a changed slug has
 * the format (400), the version is the stored one (409), a changed slug is free (409). Each check
 * fails before anything is written.
 */
@Service
public class AdminProductService {

  /** How many times an add whose generated slug was taken meanwhile tries again. */
  static final int MAX_SLUG_RETRIES = 3;

  /** The highest suffix of a generated slug. */
  static final int MAX_SLUG_NUMBER = 1000;

  private static final String SLUG_TAKEN = "Product slug already exists.";
  private static final String NOT_FOUND = "Product not found.";
  private static final String VERSION_CHANGED =
      "Product was modified by another request. Reload it and retry.";
  private static final String NO_CORRELATION_ID = "none";

  private static final Logger log = LoggerFactory.getLogger(AdminProductService.class);

  private final ProductRepository repository;
  private final ProductQueryRepository queryRepository;
  private final CorrelationContext correlation;
  private final EntityManager entityManager;
  private final CategoryRepository categoryRepository;

  public AdminProductService(
      ProductRepository repository,
      ProductQueryRepository queryRepository,
      CorrelationContext correlation,
      EntityManager entityManager,
      CategoryRepository categoryRepository) {
    this.repository = repository;
    this.queryRepository = queryRepository;
    this.correlation = correlation;
    this.entityManager = entityManager;
    this.categoryRepository = categoryRepository;
  }

  /**
   * Adds a product from a valid request, and logs the add at INFO without the description or the
   * request (NFR12).
   *
   * @throws ConflictException {@code PRODUCT_SLUG_DUPLICATED} when the slug typed is taken, or when
   *     a generated slug kept being taken by adds at the same time
   */
  public AdminProduct create(CreateProductRequest request) {
    UUID categoryId = existingCategory(request.categoryId());
    Product saved =
        request.slug() != null
            ? createWithTypedSlug(request, categoryId)
            : createWithGeneratedSlug(request, categoryId);
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
   * One product, whatever its status, as the edit form reads it.
   *
   * @throws NotFoundException {@code PRODUCT_NOT_FOUND} when no product has this id
   */
  @Transactional(readOnly = true)
  public AdminProduct get(UUID id) {
    return AdminProduct.from(find(id));
  }

  /**
   * Edits a product with every field of a valid request, and returns it with its new version.
   * Logged at INFO with the operation, the id, the slug and the correlation id, never the
   * description or the request (NFR12).
   *
   * <p>The slug (API Contract, section "Slug khi sửa", and NFR16):
   *
   * <ul>
   *   <li>equal to the stored one, ignoring case as {@code citext} does: the stored slug is kept as
   *       it is, without checking its format, so a product of before the Epic with a slug out of
   *       the format is saved, and a slug sent in upper case does not replace it;
   *   <li>otherwise: it must have the format ({@link Slugs#isValid}), and no other product may have
   *       it. The UNIQUE constraint {@code products_slug_unique} is the last guard against an add
   *       or an edit at the same time (NFR12).
   * </ul>
   *
   * <p>The version (AC13): a version other than the stored one is a 409. Two edits at once with the
   * same version both pass that check; {@code @Version} of Hibernate then writes {@code WHERE
   * version = ?}, and the second edit is an {@code ObjectOptimisticLockingFailureException}, which
   * {@code GlobalExceptionHandler} makes the same 409.
   *
   * <p>The category (plan of SHOP-81, Architecture Decisions 7, NFR19): an absent {@code
   * categoryId} keeps the category of the product, {@code null} drops it, and an id must be an
   * existing category, hidden too (400 on {@code categoryId}). It is checked after the slug format
   * and before the version, the 400s before the 409s. A category deleted between the check and the
   * write breaks {@code products_category_fk}, which is the same 400 (AC10).
   *
   * <p>The product is read with its row locked ({@link ProductRepository#findByIdForUpdate}). A
   * category delete that empties the product holds that row until it commits, so the edit reads the
   * product the delete left: an absent {@code categoryId} then keeps no category, and the response
   * is a 200 without one, never a 400 on a field the request did not send.
   *
   * <p>After the write the product is read again, since the trigger {@code
   * trg_products_set_updated_at} sets {@code updated_at} in the database: the response then shows
   * the instant a later read shows.
   *
   * @throws NotFoundException {@code PRODUCT_NOT_FOUND} when no product has this id
   * @throws BadRequestException {@code VALIDATION_FAILED} on the field {@code slug}, when the slug
   *     changes to one out of the format
   * @throws BadRequestException {@code VALIDATION_FAILED} on the field {@code categoryId}, when no
   *     category has the id sent
   * @throws ConflictException {@code OPTIMISTIC_LOCK_CONFLICT} when the version is not the stored
   *     one; {@code PRODUCT_SLUG_DUPLICATED} when another product has the new slug
   */
  @Transactional
  public AdminProduct update(UUID id, UpdateProductRequest request) {
    Product product =
        repository
            .findByIdForUpdate(id)
            .orElseThrow(() -> new NotFoundException(ErrorCode.PRODUCT_NOT_FOUND, NOT_FOUND));
    boolean slugChanged = !sameSlug(request.slug(), product.getSlug());
    if (slugChanged && !Slugs.isValid(request.slug())) {
      throw invalidSlug(
          request.slug(),
          request.slug().length() > Slugs.MAX_LENGTH
              ? SlugFormat.TOO_LONG
              : SlugFormat.WRONG_FORMAT);
    }
    UUID categoryId =
        request.categoryId().present()
            ? existingCategory(request.categoryId().value())
            : product.getCategoryId();
    if (!product.getVersion().equals(request.version())) {
      throw new ConflictException(ErrorCode.OPTIMISTIC_LOCK_CONFLICT, VERSION_CHANGED);
    }
    if (slugChanged && repository.existsBySlug(request.slug())) {
      throw slugTaken(null);
    }

    product.setName(request.name());
    if (slugChanged) {
      product.setSlug(request.slug());
    }
    product.setDescription(request.description());
    product.setPriceVnd(request.price().longValueExact());
    product.setCompareAtPriceVnd(toLong(request.compareAtPrice()));
    product.setStatus(request.status());
    product.setAvailability(request.availability());
    product.setCategoryId(categoryId);
    try {
      repository.saveAndFlush(product);
    } catch (DataIntegrityViolationException e) {
      if (isSlugTaken(e)) {
        throw slugTaken(e);
      }
      throw categoryGoneOrItself(e, request.categoryId().value());
    }
    entityManager.refresh(product);

    log.info(
        "Product updated: operation=update id={} slug={} correlationId={}",
        product.getId(),
        product.getSlug(),
        correlation.currentId().orElse(NO_CORRELATION_ID));
    return AdminProduct.from(product);
  }

  /**
   * The 400 {@code VALIDATION_FAILED} of a changed slug out of the format: the body {@code
   * GlobalExceptionHandler} writes for the field errors of Bean Validation, with one error, on the
   * field {@code slug}.
   *
   * @param slug the slug sent
   * @param message what is wrong with it, {@link SlugFormat#WRONG_FORMAT} or {@link
   *     SlugFormat#TOO_LONG}
   */
  public static BadRequestException invalidSlug(String slug, String message) {
    Map<String, Object> error = new LinkedHashMap<>();
    error.put("field", "slug");
    error.put("rejectedValue", slug);
    error.put("message", message);
    BadRequestException e =
        new BadRequestException(ErrorCode.VALIDATION_FAILED, "Validation failed for 1 field(s).");
    e.putProperty("errors", List.of(error));
    return e;
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

  /**
   * The id of the category a request names, checked to exist, hidden too; {@code null} when it
   * names none. The format is already checked by {@code ValidCategoryId}.
   *
   * @throws BadRequestException {@code VALIDATION_FAILED} on the field {@code categoryId} when no
   *     category has the id (AC10)
   */
  private UUID existingCategory(String categoryId) {
    if (categoryId == null) {
      return null;
    }
    UUID id = UUID.fromString(categoryId);
    if (!categoryRepository.existsById(id)) {
      throw categoryGone(categoryId, null);
    }
    return id;
  }

  /**
   * The 400 on {@code categoryId} when the write broke {@code products_category_fk}, as when the
   * category was deleted after the check: the body of the check, with the id sent (AC10, NFR11).
   * Any other violation is passed on as it is.
   */
  private static RuntimeException categoryGoneOrItself(
      DataIntegrityViolationException e, String categoryId) {
    return ConstraintViolations.isViolationOf(e, ConstraintViolations.PRODUCT_CATEGORY_FK)
        ? categoryGone(categoryId, e)
        : e;
  }

  private static BadRequestException categoryGone(String categoryId, Throwable cause) {
    return BadRequestException.ofField(
        ConstraintViolations.CATEGORY_ID_FIELD,
        categoryId,
        ConstraintViolations.NOT_AN_EXISTING_CATEGORY,
        cause);
  }

  private Product find(UUID id) {
    return repository
        .findById(id)
        .orElseThrow(() -> new NotFoundException(ErrorCode.PRODUCT_NOT_FOUND, NOT_FOUND));
  }

  /** Whether two slugs are the same slug for {@code citext}, which ignores case. */
  private static boolean sameSlug(String sent, String stored) {
    return sent.toLowerCase(Locale.ROOT).equals(stored.toLowerCase(Locale.ROOT));
  }

  private Product createWithTypedSlug(CreateProductRequest request, UUID categoryId) {
    if (repository.existsBySlug(request.slug())) {
      throw slugTaken(null);
    }
    try {
      return repository.saveAndFlush(newProduct(request, request.slug(), categoryId));
    } catch (DataIntegrityViolationException e) {
      if (isSlugTaken(e)) {
        throw slugTaken(e);
      }
      throw categoryGoneOrItself(e, request.categoryId());
    }
  }

  private Product createWithGeneratedSlug(CreateProductRequest request, UUID categoryId) {
    String base = ProductSlugs.fromName(request.name());
    for (int retry = 0; ; retry++) {
      String slug = firstFreeSlug(base);
      try {
        return repository.saveAndFlush(newProduct(request, slug, categoryId));
      } catch (DataIntegrityViolationException e) {
        if (!isSlugTaken(e)) {
          throw categoryGoneOrItself(e, request.categoryId());
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
   * <p>The query asks for exactly the candidates, each built by {@link Slugs#candidates}, so it
   * reads no other slug that only starts like the base, and it needs no property of how a long base
   * is cut: each candidate is the slug that would be saved.
   *
   * @throws ConflictException {@code PRODUCT_SLUG_DUPLICATED} when every number is taken
   */
  private String firstFreeSlug(String base) {
    List<String> candidates = Slugs.candidates(base, MAX_SLUG_NUMBER);
    Set<String> taken =
        repository.findSlugsAmong(candidates.toArray(String[]::new)).stream()
            .map(slug -> slug.toLowerCase(Locale.ROOT))
            .collect(Collectors.toSet());
    return candidates.stream()
        .filter(slug -> !taken.contains(slug))
        .findFirst()
        .orElseThrow(() -> slugTaken(null));
  }

  private static Product newProduct(CreateProductRequest request, String slug, UUID categoryId) {
    Product product =
        new Product(
            request.name(),
            slug,
            request.description(),
            request.price().longValueExact(),
            toLong(request.compareAtPrice()),
            request.status() != null ? request.status() : ProductStatus.ACTIVE,
            request.availability() != null ? request.availability() : ProductAvailability.IN_STOCK);
    product.setCategoryId(categoryId);
    return product;
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
