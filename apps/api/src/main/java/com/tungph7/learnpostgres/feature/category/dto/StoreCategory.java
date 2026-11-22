package com.tungph7.learnpostgres.feature.category.dto;

/**
 * A category as a shopper sees it: {@code StoreCategory} of the API Contract of the plan of
 * SHOP-81. Only its name and the slug as stored: no status, since a shopper only ever sees {@code
 * VISIBLE} categories, no product count and no version (NFR8).
 */
public record StoreCategory(String name, String slug) {}
