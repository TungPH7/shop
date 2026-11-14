package com.tungph7.learnpostgres.feature.product.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tungph7.learnpostgres.common.error.ConflictException;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.error.NotFoundException;
import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.dto.CreateProductRequest;
import com.tungph7.learnpostgres.feature.product.mapper.ProductMapper;
import com.tungph7.learnpostgres.feature.product.repository.ProductRepository;

/**
 * Business logic for {@link Product}.
 *
 * <p>Responsibilities:
 *
 * <ul>
 *   <li>Enforce business rules (for example: slug already exists → {@link ConflictException}
 *       instead of letting the DB raise a raw error).
 *   <li>Manage transaction boundaries via method-level {@code @Transactional}.
 *   <li>Throw custom exceptions for the controller layer.
 * </ul>
 *
 * <p>Read-only by default (class-level {@code @Transactional(readOnly = true)}) to reduce locks
 * taken; writing methods override with {@code readOnly = false}.
 */
@Service
@Transactional(readOnly = true)
public class ProductService {

  private final ProductRepository repository;
  private final ProductMapper mapper;

  public ProductService(ProductRepository repository, ProductMapper mapper) {
    this.repository = repository;
    this.mapper = mapper;
  }

  public Product getById(UUID id) {
    return repository
        .findById(id)
        .orElseThrow(
            () ->
                new NotFoundException(
                    ErrorCode.PRODUCT_NOT_FOUND, "Product with id '%s' not found.".formatted(id)));
  }

  public Product getBySlug(String slug) {
    return repository
        .findBySlug(slug)
        .orElseThrow(
            () ->
                new NotFoundException(
                    ErrorCode.PRODUCT_NOT_FOUND,
                    "Product with slug '%s' not found.".formatted(slug)));
  }

  public List<Product> list() {
    return repository.findAll();
  }

  @Transactional
  public Product create(CreateProductRequest req) {
    // Pre-check the slug to return an explicit ConflictException instead of letting the DB UNIQUE
    // constraint surface as a DataIntegrityViolationException. A race remains: two concurrent
    // POSTs with the same slug can both pass the check and INSERT — the DB constraint then catches
    // it (the handler still maps to 409). The pre-check is a UX nicety (fast, clear message), not
    // a replacement for the DB constraint.
    repository
        .findBySlug(req.slug())
        .ifPresent(
            p -> {
              throw new ConflictException(
                  ErrorCode.PRODUCT_SLUG_DUPLICATED,
                  "Product slug '%s' already exists.".formatted(req.slug()));
            });
    return repository.save(mapper.toEntity(req));
  }

  @Transactional
  public Product updatePrice(UUID id, BigDecimal newPrice) {
    Product product = getById(id);
    product.setPrice(newPrice);
    return repository.save(product);
    // Optimistic lock: if the version in the DB has moved since we loaded (because another
    // request updated concurrently), Hibernate throws ObjectOptimisticLockingFailureException
    // and the handler maps it to 409.
  }

  @Transactional
  public int bulkUpdatePriceBySlug(String slug, BigDecimal newPrice) {
    // Bulk update via JPQL — bypasses the JPA Auditing listener; the
    // app.set_updated_at() database trigger ensures updated_at is refreshed.
    int updated = repository.bulkUpdatePriceBySlug(slug, newPrice);
    if (updated == 0) {
      throw new NotFoundException(
          ErrorCode.PRODUCT_NOT_FOUND, "No product with slug '%s'.".formatted(slug));
    }
    return updated;
  }

  @Transactional
  public void delete(UUID id) {
    if (!repository.existsById(id)) {
      throw new NotFoundException(
          ErrorCode.PRODUCT_NOT_FOUND, "Product with id '%s' not found.".formatted(id));
    }
    repository.deleteById(id);
  }
}
