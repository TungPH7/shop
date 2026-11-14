package com.tungph7.learnpostgres.feature.product.mapper;

import org.mapstruct.Mapper;

import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.dto.CreateProductRequest;
import com.tungph7.learnpostgres.feature.product.dto.ProductResponse;

@Mapper
public interface ProductMapper {

  /**
   * Maps request → entity. The id and audit fields are populated by {@code BaseEntity} /
   * {@code @PrePersist} / JPA Auditing — NOT from the request (they are absent from the DTO too).
   */
  Product toEntity(CreateProductRequest req);

  /**
   * Maps entity → response. The entity fields {@code version}, {@code updatedAt}, {@code createdBy}
   * and {@code updatedBy} have no counterpart in the response — MapStruct's default {@code
   * unmappedSourcePolicy = WARN} suffices (not {@code ERROR}).
   */
  ProductResponse toResponse(Product product);
}
