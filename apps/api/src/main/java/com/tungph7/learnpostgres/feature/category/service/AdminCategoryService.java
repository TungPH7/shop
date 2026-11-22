package com.tungph7.learnpostgres.feature.category.service;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import jakarta.persistence.EntityManager;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tungph7.learnpostgres.common.error.ConflictException;
import com.tungph7.learnpostgres.common.error.ConstraintViolations;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.error.NotFoundException;
import com.tungph7.learnpostgres.common.logging.CorrelationContext;
import com.tungph7.learnpostgres.common.text.Slugs;
import com.tungph7.learnpostgres.feature.category.domain.Category;
import com.tungph7.learnpostgres.feature.category.domain.Category.CategoryStatus;
import com.tungph7.learnpostgres.feature.category.dto.AdminCategory;
import com.tungph7.learnpostgres.feature.category.dto.AdminCategoryListItem;
import com.tungph7.learnpostgres.feature.category.dto.CreateCategoryRequest;
import com.tungph7.learnpostgres.feature.category.dto.ItemList;
import com.tungph7.learnpostgres.feature.category.dto.UpdateCategoryRequest;
import com.tungph7.learnpostgres.feature.category.repository.CategoryQueryRepository;
import com.tungph7.learnpostgres.feature.category.repository.CategoryRepository;

/**
 * The admin API of categories (SHOP-81, API Contract of the plan): the list, the add, the read, the
 * edit ({@link #update}) and the delete ({@link #delete}).
 *
 * <p>The add checks, in this order, after the field errors of Bean Validation (400):
 *
 * <ol>
 *   <li>a category with the same name, ignoring case but not accents: 409 {@code
 *       CATEGORY_NAME_DUPLICATED};
 *   <li>a typed slug taken, ignoring case: 409 {@code CATEGORY_SLUG_DUPLICATED}.
 * </ol>
 *
 * <p>Without a slug, the slug is generated from the name by {@link Slugs} with the fallback {@value
 * #FALLBACK_SLUG}, then the first free of {@code -2} to {@code -}{@value #MAX_SLUG_NUMBER} is
 * taken, read in one query; past it, a 409 {@code CATEGORY_SLUG_DUPLICATED} asks for a typed slug.
 *
 * <p>The checks run before the insert, so two adds at once can both pass them. The UNIQUE
 * constraints are the last guard (NFR11): a name taken meanwhile is a 409 on the name, a typed slug
 * taken meanwhile a 409 on the slug, and a generated slug taken meanwhile is tried again with the
 * next free number, at most {@value #MAX_SLUG_RETRIES} times. That is why the add is not
 * {@code @Transactional}: each insert runs in its own transaction, and a lost insert does not abort
 * the next one.
 */
@Service
public class AdminCategoryService {

  /** How many times an add whose generated slug was taken meanwhile tries again. */
  static final int MAX_SLUG_RETRIES = 3;

  /** The highest suffix of a generated slug. */
  static final int MAX_SLUG_NUMBER = 1000;

  /** The slug of a name that has no letter or digit left once folded (Tech Stack of the SPEC). */
  static final String FALLBACK_SLUG = "danh-muc";

  private static final String NAME_TAKEN = "Category name already exists.";
  private static final String SLUG_TAKEN = "Category slug already exists.";
  private static final String NOT_FOUND = "Category not found.";
  private static final String VERSION_CHANGED =
      "Category was modified by another request. Reload it and retry.";
  private static final String NO_CORRELATION_ID = "none";

  private static final Logger log = LoggerFactory.getLogger(AdminCategoryService.class);

  private final CategoryRepository repository;
  private final CategoryQueryRepository queryRepository;
  private final CorrelationContext correlation;
  private final EntityManager entityManager;

  public AdminCategoryService(
      CategoryRepository repository,
      CategoryQueryRepository queryRepository,
      CorrelationContext correlation,
      EntityManager entityManager) {
    this.repository = repository;
    this.queryRepository = queryRepository;
    this.correlation = correlation;
    this.entityManager = entityManager;
  }

  /**
   * Every category, visible or hidden, in the order of names, each with the number of its products
   * (AC1): one statement (NFR2).
   */
  public ItemList<AdminCategoryListItem> list() {
    return new ItemList<>(
        queryRepository.findAdminList().stream().map(AdminCategoryListItem::from).toList());
  }

  /**
   * Adds a category from a valid request, and logs the add at INFO with the operation, the id, the
   * slug and the correlation id, never the request (NFR11).
   *
   * @throws ConflictException {@code CATEGORY_NAME_DUPLICATED} when another category has the name;
   *     {@code CATEGORY_SLUG_DUPLICATED} when the slug typed is taken, or when a generated slug
   *     kept being taken by adds at the same time
   */
  public AdminCategory create(CreateCategoryRequest request) {
    if (repository.existsByName(request.name())) {
      throw nameTaken(null);
    }
    Category saved =
        request.slug() != null ? createWithTypedSlug(request) : createWithGeneratedSlug(request);
    log.info(
        "Category created: operation=create id={} slug={} correlationId={}",
        saved.getId(),
        saved.getSlug(),
        correlation.currentId().orElse(NO_CORRELATION_ID));
    return AdminCategory.from(saved);
  }

  /**
   * One category, visible or hidden, as the edit form reads it.
   *
   * @throws NotFoundException {@code CATEGORY_NOT_FOUND} when no category has this id
   */
  @Transactional(readOnly = true)
  public AdminCategory get(UUID id) {
    return AdminCategory.from(find(id));
  }

  /**
   * Edits a category with every field of a valid request, and returns it with its new version.
   * Logged at INFO with the operation, the id, the slug and the correlation id (NFR11).
   *
   * <p>The checks, in the order of the API Contract, each before anything is written: the category
   * exists (404), the version is the stored one (409 {@code OPTIMISTIC_LOCK_CONFLICT}), no other
   * category has the name (409), and a changed slug is free (409). A slug equal to the stored one,
   * ignoring case as {@code citext} does, keeps the stored slug. Two edits at once with the same
   * version both pass the check of the version; {@code @Version} of Hibernate then writes {@code
   * WHERE version = ?}, and the second edit is an {@code ObjectOptimisticLockingFailureException},
   * which {@code GlobalExceptionHandler} makes the same 409. The UNIQUE constraints stay the last
   * guard for the name and the slug.
   *
   * <p>After the write the category is read again, since the trigger {@code
   * trg_categories_set_updated_at} sets {@code updated_at} in the database: the response shows the
   * instant a later read shows.
   *
   * @throws NotFoundException {@code CATEGORY_NOT_FOUND} when no category has this id
   * @throws ConflictException {@code OPTIMISTIC_LOCK_CONFLICT}, {@code CATEGORY_NAME_DUPLICATED} or
   *     {@code CATEGORY_SLUG_DUPLICATED}
   */
  @Transactional
  public AdminCategory update(UUID id, UpdateCategoryRequest request) {
    Category category = find(id);
    if (!category.getVersion().equals(request.version())) {
      throw new ConflictException(ErrorCode.OPTIMISTIC_LOCK_CONFLICT, VERSION_CHANGED);
    }
    if (repository.existsByNameAndIdNot(request.name(), id)) {
      throw nameTaken(null);
    }
    boolean slugChanged = !sameSlug(request.slug(), category.getSlug());
    if (slugChanged && repository.existsBySlug(request.slug())) {
      throw slugTaken(null);
    }

    category.setName(request.name());
    if (slugChanged) {
      category.setSlug(request.slug());
    }
    category.setStatus(request.status());
    try {
      repository.saveAndFlush(category);
    } catch (DataIntegrityViolationException e) {
      throw duplicateOrItself(e);
    }
    entityManager.refresh(category);

    log.info(
        "Category updated: operation=update id={} slug={} correlationId={}",
        category.getId(),
        category.getSlug(),
        correlation.currentId().orElse(NO_CORRELATION_ID));
    return AdminCategory.from(category);
  }

  /**
   * Deletes a category, and does nothing when it is already gone, so the delete is idempotent
   * (NFR12). Two statements in one transaction: the first locks the category and reads its slug
   * ({@link CategoryQueryRepository#lockForDelete}); the second is the {@code DELETE}, which counts
   * the products of the category for the log, then leaves them without category through the foreign
   * key {@code products_category_fk} (NFR15, {@link CategoryQueryRepository#delete}). Each call is
   * logged at INFO with the operation, the id, the slug, the number of products and the correlation
   * id (NFR11).
   */
  @Transactional
  public void delete(UUID id) {
    String correlationId = correlation.currentId().orElse(NO_CORRELATION_ID);
    Optional<String> slug = queryRepository.lockForDelete(id);
    Optional<Long> productCount = slug.flatMap(locked -> queryRepository.delete(id));
    if (productCount.isEmpty()) {
      log.info(
          "Category already gone, nothing deleted: operation=delete id={} correlationId={}",
          id,
          correlationId);
      return;
    }
    log.info(
        "Category deleted: operation=delete id={} slug={} productCount={} correlationId={}",
        id,
        slug.get(),
        productCount.get(),
        correlationId);
  }

  private Category find(UUID id) {
    return repository
        .findById(id)
        .orElseThrow(() -> new NotFoundException(ErrorCode.CATEGORY_NOT_FOUND, NOT_FOUND));
  }

  /** Whether two slugs are the same slug for {@code citext}, which ignores case. */
  private static boolean sameSlug(String sent, String stored) {
    return sent.toLowerCase(Locale.ROOT).equals(stored.toLowerCase(Locale.ROOT));
  }

  private Category createWithTypedSlug(CreateCategoryRequest request) {
    if (repository.existsBySlug(request.slug())) {
      throw slugTaken(null);
    }
    try {
      return repository.saveAndFlush(newCategory(request, request.slug()));
    } catch (DataIntegrityViolationException e) {
      throw duplicateOrItself(e);
    }
  }

  private Category createWithGeneratedSlug(CreateCategoryRequest request) {
    String base = Slugs.fromName(request.name(), FALLBACK_SLUG);
    for (int retry = 0; ; retry++) {
      String slug = firstFreeSlug(base);
      try {
        return repository.saveAndFlush(newCategory(request, slug));
      } catch (DataIntegrityViolationException e) {
        if (!isViolationOf(e, ConstraintViolations.CATEGORY_SLUG_UNIQUE)
            || retry == MAX_SLUG_RETRIES) {
          throw duplicateOrItself(e);
        }
        log.info(
            "Generated slug taken by another add, trying the next number: slug={} retry={}",
            slug,
            retry + 1);
      }
    }
  }

  /**
   * {@code base} when free, else the first free of {@code base-2} to {@code base-}{@value
   * #MAX_SLUG_NUMBER}: the slugs taken among these candidates are read in one query, then compared
   * here, ignoring case as {@code citext} does.
   *
   * @throws ConflictException {@code CATEGORY_SLUG_DUPLICATED} when every number is taken
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

  private static Category newCategory(CreateCategoryRequest request, String slug) {
    return new Category(
        request.name(), slug, request.status() != null ? request.status() : CategoryStatus.VISIBLE);
  }

  /**
   * The 409 of a UNIQUE constraint of the name or the slug that the insert broke, read as {@code
   * GlobalExceptionHandler} reads it; any other violation is passed on as it is.
   */
  private static RuntimeException duplicateOrItself(DataIntegrityViolationException e) {
    if (isViolationOf(e, ConstraintViolations.CATEGORY_NAME_UNIQUE)) {
      return nameTaken(e);
    }
    if (isViolationOf(e, ConstraintViolations.CATEGORY_SLUG_UNIQUE)) {
      return slugTaken(e);
    }
    return e;
  }

  private static boolean isViolationOf(DataIntegrityViolationException e, String constraint) {
    return ConstraintViolations.isViolationOf(e, constraint);
  }

  private static ConflictException nameTaken(Throwable cause) {
    return new ConflictException(ErrorCode.CATEGORY_NAME_DUPLICATED, NAME_TAKEN, cause);
  }

  private static ConflictException slugTaken(Throwable cause) {
    return new ConflictException(ErrorCode.CATEGORY_SLUG_DUPLICATED, SLUG_TAKEN, cause);
  }
}
