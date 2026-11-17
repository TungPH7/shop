package com.tungph7.learnpostgres.feature.product.controller;

import java.net.URI;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.tungph7.learnpostgres.feature.product.dto.AdminProduct;
import com.tungph7.learnpostgres.feature.product.dto.AdminProductSummary;
import com.tungph7.learnpostgres.feature.product.dto.CreateProductRequest;
import com.tungph7.learnpostgres.feature.product.dto.ProductPage;
import com.tungph7.learnpostgres.feature.product.dto.ProductStatusFilter;
import com.tungph7.learnpostgres.feature.product.dto.UpdateProductRequest;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository;
import com.tungph7.learnpostgres.feature.product.service.AdminProductService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
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

  /**
   * One page of products, newest first, of every status unless {@code status} names one. An invalid
   * parameter is a 400 {@code INVALID_PARAMETER} that names it (NFR3); an unknown one is ignored.
   */
  @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List products",
      description =
          "Newest first. q matches products whose name has a word starting with each word of q,"
              + " ignoring accents and case; a q with no letter or digit matches no product."
              + " An invalid parameter is a 400 INVALID_PARAMETER naming it.")
  @ApiResponse(responseCode = "200", description = "OK")
  @ApiResponse(
      responseCode = "400",
      description = "INVALID_PARAMETER: a parameter of the wrong type or out of range",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
  public ProductPage<AdminProductSummary> list(
      @Parameter(description = "Keyword; blank is no search")
          @RequestParam(name = "q", required = false)
          String q,
      @RequestParam(name = "status", defaultValue = "ALL") ProductStatusFilter status,
      @RequestParam(name = "offset", defaultValue = "0") @Min(0) int offset,
      @RequestParam(name = "limit", defaultValue = "20")
          @Min(1)
          @Max(ProductQueryRepository.MAX_LIMIT)
          int limit) {
    return service.list(q, status, offset, limit);
  }

  /**
   * One product, whatever its status, for the edit form: 200, or 404 when no product has the id.
   */
  @GetMapping(path = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Get a product",
      description =
          "Returns the product of every status, hidden too, with the version to send back.")
  @ApiResponse(responseCode = "200", description = "OK")
  @ApiResponse(
      responseCode = "400",
      description = "INVALID_PARAMETER: the id is not a UUID",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
  @ApiResponse(
      responseCode = "404",
      description = "PRODUCT_NOT_FOUND: no product has this id",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
  public AdminProduct get(@PathVariable("id") UUID id) {
    return service.get(id);
  }

  /**
   * Edits a product with every field: 200 with the product and its new version. The checks and
   * their order are those of {@link AdminProductService#update}.
   */
  @PutMapping(path = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Edit a product",
      description =
          "Checks every field against the Product Rules; the price is always 1-999999999. A slug"
              + " equal to the stored one, ignoring case, is kept without checking its format; a"
              + " changed slug must have the format (400 on the field slug) and be free (409"
              + " PRODUCT_SLUG_DUPLICATED). A version other than the stored one is a 409"
              + " OPTIMISTIC_LOCK_CONFLICT, and nothing is written.")
  @ApiResponse(responseCode = "200", description = "OK, with the new version")
  @ApiResponse(
      responseCode = "400",
      description =
          "VALIDATION_FAILED with errors, one per invalid field; INVALID_PARAMETER when the id is"
              + " not a UUID",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
  @ApiResponse(
      responseCode = "404",
      description = "PRODUCT_NOT_FOUND: no product has this id",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
  @ApiResponse(
      responseCode = "409",
      description =
          "OPTIMISTIC_LOCK_CONFLICT: the product was edited since the version sent was read;"
              + " PRODUCT_SLUG_DUPLICATED: another product has the new slug",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
  public AdminProduct update(
      @PathVariable("id") UUID id, @Valid @RequestBody UpdateProductRequest request) {
    return service.update(id, request);
  }

  /**
   * Deletes a product: 204, also when the product is already gone, so a delete whose response was
   * lost can be sent again (NFR19).
   */
  @DeleteMapping("/{id}")
  @Operation(
      summary = "Delete a product",
      description = "Idempotent: 204 also when no product has this id.")
  @ApiResponse(responseCode = "204", description = "Deleted, or already gone")
  @ApiResponse(
      responseCode = "400",
      description = "INVALID_PARAMETER: the id is not a UUID",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
  public ResponseEntity<Void> delete(@PathVariable("id") UUID id) {
    service.delete(id);
    return ResponseEntity.noContent().build();
  }
}
