package com.tungph7.learnpostgres.feature.product.controller;

import java.net.URI;

import jakarta.validation.Valid;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tungph7.learnpostgres.feature.product.dto.AdminProduct;
import com.tungph7.learnpostgres.feature.product.dto.CreateProductRequest;
import com.tungph7.learnpostgres.feature.product.service.AdminProductService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * The admin API of products, {@code /api/admin/products} (ADR-0003): used by {@code admin} and by
 * the E2E helpers of both apps, behind the basic auth of the {@code admin} host. The API Contract
 * is in the plan of SHOP-7.
 */
@RestController
@RequestMapping(AdminProductController.BASE_PATH)
@Tag(name = "Admin products", description = "Product management for the admin app")
public class AdminProductController {

  static final String BASE_PATH = "/api/admin/products";

  private final AdminProductService service;

  public AdminProductController(AdminProductService service) {
    this.service = service;
  }

  /** Adds a product: 201 with the product and {@code Location: /api/admin/products/{id}}. */
  @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Add a product",
      description =
          "Checks every field against the Product Rules and lists each invalid field in one 400."
              + " Without a slug, the slug is generated from the name, with -2, -3... when taken;"
              + " a slug typed that is taken, ignoring case, is a 409 PRODUCT_SLUG_DUPLICATED.")
  @ApiResponse(
      responseCode = "201",
      description = "Created",
      headers =
          @Header(
              name = "Location",
              description = "/api/admin/products/{id}",
              schema = @Schema(type = "string")),
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON_VALUE,
              schema = @Schema(implementation = AdminProduct.class)))
  @ApiResponse(
      responseCode = "409",
      description = "PRODUCT_SLUG_DUPLICATED: the slug typed is already used",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
  public ResponseEntity<AdminProduct> create(@Valid @RequestBody CreateProductRequest request) {
    AdminProduct product = service.create(request);
    return ResponseEntity.created(URI.create(BASE_PATH + "/" + product.id())).body(product);
  }
}
