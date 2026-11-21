package com.tungph7.learnpostgres.feature.category.service;

import org.springframework.stereotype.Service;

import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.error.NotFoundException;
import com.tungph7.learnpostgres.feature.category.dto.CategorySitemapEntry;
import com.tungph7.learnpostgres.feature.category.dto.ItemList;
import com.tungph7.learnpostgres.feature.category.dto.StoreCategory;
import com.tungph7.learnpostgres.feature.category.repository.CategoryQueryRepository;
import com.tungph7.learnpostgres.feature.category.repository.CategoryQueryRepository.SitemapRow;
import com.tungph7.learnpostgres.feature.category.repository.CategoryQueryRepository.StoreRow;

/**
 * The store API of categories (SHOP-81, API Contract of the plan): only {@code VISIBLE} categories,
 * whatever the request asks (NFR8), each in one statement (NFR2).
 */
@Service
public class StoreCategoryService {

  /**
   * The one detail of every 404 of a category in the store. A hidden category, a deleted one and a
   * slug that never existed get the same body, so a shopper cannot tell them apart (NFR8).
   */
  public static final String NOT_FOUND = "Category not found.";

  private final CategoryQueryRepository queryRepository;

  public StoreCategoryService(CategoryQueryRepository queryRepository) {
    this.queryRepository = queryRepository;
  }

  /** The {@code VISIBLE} categories with a product on sale, in the order of names (AC17). */
  public ItemList<StoreCategory> list() {
    return new ItemList<>(
        queryRepository.findStoreList().stream().map(StoreCategoryService::toStore).toList());
  }

  /**
   * The {@code VISIBLE} category with this slug, compared ignoring case, with or without products
   * on sale (AC15).
   *
   * @throws NotFoundException {@code CATEGORY_NOT_FOUND} when no category has this slug or it is
   *     hidden
   */
  public StoreCategory get(String slug) {
    return queryRepository
        .findVisibleBySlug(slug)
        .map(StoreCategoryService::toStore)
        .orElseThrow(() -> new NotFoundException(ErrorCode.CATEGORY_NOT_FOUND, NOT_FOUND));
  }

  /** Whether a shopper can see the category with this slug: the answer of {@link #get}. */
  public boolean isVisible(String slug) {
    return queryRepository.findVisibleBySlug(slug).isPresent();
  }

  /** The categories of the sitemap of the store, in the order of their ids (AC19). */
  public ItemList<CategorySitemapEntry> sitemap() {
    return new ItemList<>(
        queryRepository.findSitemap().stream().map(StoreCategoryService::toEntry).toList());
  }

  private static StoreCategory toStore(StoreRow row) {
    return new StoreCategory(row.name(), row.slug());
  }

  private static CategorySitemapEntry toEntry(SitemapRow row) {
    return new CategorySitemapEntry(row.slug(), row.updatedAt());
  }
}
