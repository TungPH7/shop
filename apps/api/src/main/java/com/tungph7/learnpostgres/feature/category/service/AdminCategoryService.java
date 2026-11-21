package com.tungph7.learnpostgres.feature.category.service;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import com.tungph7.learnpostgres.common.error.ConflictException;
import com.tungph7.learnpostgres.common.error.ConstraintViolations;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.logging.CorrelationContext;
import com.tungph7.learnpostgres.common.text.Slugs;
import com.tungph7.learnpostgres.feature.category.domain.Category;
import com.tungph7.learnpostgres.feature.category.domain.Category.CategoryStatus;
import com.tungph7.learnpostgres.feature.category.dto.AdminCategory;
import com.tungph7.learnpostgres.feature.category.dto.AdminCategoryListItem;
import com.tungph7.learnpostgres.feature.category.dto.CreateCategoryRequest;
import com.tungph7.learnpostgres.feature.category.dto.ItemList;
import com.tungph7.learnpostgres.feature.category.repository.CategoryQueryRepository;
import com.tungph7.learnpostgres.feature.category.repository.CategoryRepository;

/**
 * The admin API of categories (SHOP-81, API Contract of the plan): the list and the add.
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
  private static final String NO_CORRELATION_ID = "none";

  private static final Logger log = LoggerFactory.getLogger(AdminCategoryService.class);

  private final CategoryRepository repository;
  private final CategoryQueryRepository queryRepository;
  private final CorrelationContext correlation;

  public AdminCategoryService(
      CategoryRepository repository,
      CategoryQueryRepository queryRepository,
      CorrelationContext correlation) {
    this.repository = repository;
    this.queryRepository = queryRepository;
    this.correlation = correlation;
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
