package com.tungph7.learnpostgres.feature.product;

import java.math.BigDecimal;

import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.dto.CreateProductRequest;
import com.tungph7.learnpostgres.feature.product.dto.UpdatePriceRequest;

public final class ProductFixtures {

  private ProductFixtures() {}

  public static CreateProductRequest validRequest() {
    return validRequest("Test Book", "test-book-" + uniqueSuffix());
  }

  public static CreateProductRequest validRequest(String name, String slug) {
    return new CreateProductRequest(name, slug, new BigDecimal("19.99"), "desc");
  }

  public static UpdatePriceRequest priceUpdate(String value) {
    return new UpdatePriceRequest(new BigDecimal(value));
  }

  public static Product persistedEntity(String slug) {
    return new Product("X", slug, new BigDecimal("1.00"), null);
  }

  private static String uniqueSuffix() {
    return Long.toString(System.nanoTime(), 36);
  }
}
