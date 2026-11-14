package com.tungph7.learnpostgres.feature.product.controller;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.dto.CreateProductRequest;
import com.tungph7.learnpostgres.feature.product.dto.ProductResponse;
import com.tungph7.learnpostgres.feature.product.dto.UpdatePriceRequest;
import com.tungph7.learnpostgres.feature.product.mapper.ProductMapper;
import com.tungph7.learnpostgres.feature.product.service.ProductService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/products")
@Tag(name = "Products", description = "Catalog product management")
public class ProductController {

  private final ProductService service;
  private final ProductMapper mapper;

  public ProductController(ProductService service, ProductMapper mapper) {
    this.service = service;
    this.mapper = mapper;
  }

  /** Returns 201 Created with a Location header (standard REST pattern for create). */
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(
      summary = "Create a product",
      description = "Slug must be unique (case-insensitive). Returns 201 with Location header.")
  @ApiResponse(
      responseCode = "201",
      description = "Created",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON_VALUE,
              schema = @Schema(implementation = ProductResponse.class)))
  @ApiResponse(
      responseCode = "409",
      description = "Slug already exists",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
  public ResponseEntity<ProductResponse> create(
      @Valid @RequestBody CreateProductRequest req, UriComponentsBuilder uriBuilder) {
    Product saved = service.create(req);
    URI location = uriBuilder.path("/api/products/{id}").buildAndExpand(saved.getId()).toUri();
    return ResponseEntity.created(location).body(mapper.toResponse(saved));
  }

  @GetMapping("/{id}")
  @Operation(summary = "Get product by id")
  @ApiResponse(responseCode = "200", description = "OK")
  @ApiResponse(
      responseCode = "404",
      description = "Product not found",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
  public ProductResponse getById(
      @Parameter(description = "Product UUID", example = "0193c1f4-7b9a-7a3c-8d2e-aa1c98dead00")
          @PathVariable
          @NotNull
          UUID id) {
    return mapper.toResponse(service.getById(id)); // throws NotFoundException -> 404
  }

  @GetMapping
  @Operation(summary = "List all products")
  public List<ProductResponse> list() {
    return service.list().stream().map(mapper::toResponse).toList();
  }

  @PutMapping("/{id}/price")
  @Operation(summary = "Update product price")
  @ApiResponse(responseCode = "200", description = "OK")
  @ApiResponse(
      responseCode = "404",
      description = "Product not found",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
  @ApiResponse(
      responseCode = "409",
      description = "Optimistic lock conflict",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
  public ProductResponse updatePrice(
      @PathVariable UUID id, @Valid @RequestBody UpdatePriceRequest req) {
    return mapper.toResponse(service.updatePrice(id, req.price())); // optimistic lock -> 409
  }

  @PutMapping("/bulk-price/{slug}")
  public int bulkUpdatePrice(
      @PathVariable String slug, @Valid @RequestBody UpdatePriceRequest req) {
    return service.bulkUpdatePriceBySlug(slug, req.price());
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(summary = "Delete a product")
  @ApiResponse(responseCode = "204", description = "Deleted")
  @ApiResponse(
      responseCode = "404",
      description = "Product not found",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
  public void delete(@PathVariable UUID id) {
    service.delete(id); // throws NotFoundException -> 404
  }
}
