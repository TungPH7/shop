package com.tungph7.learnpostgres.feature.product.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.tungph7.learnpostgres.feature.product.dto.StoreProduct;
import com.tungph7.learnpostgres.feature.product.service.StoreProductService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * The store API of one product, {@code /api/products/{slug}} (ADR-0003): called only by the server
 * of {@code user}, with {@code GET} and {@code HEAD} (NFR8). It shows only {@code ACTIVE} products
 * and takes no status parameter (NFR9). The API Contract is in the plan of SHOP-7.
 */
@RestController
@RequestMapping(StoreProductController.BASE_PATH)
@Tag(name = "Store products", description = "The products shoppers see, for the user app")
public class StoreProductController {

  static final String BASE_PATH = "/api/products";

  private static final String SLUG_DESCRIPTION = "Slug of the product, compared ignoring case";
  private static final String NOT_FOUND_DESCRIPTION =
      "PRODUCT_NOT_FOUND: no product has this slug, or it is hidden or deleted;"
          + " the body is the same in each case";

  private final StoreProductService service;

  public StoreProductController(StoreProductService service) {
    this.service = service;
  }

  /** The {@code ACTIVE} product with this slug; any other is a 404 {@code PRODUCT_NOT_FOUND}. */
  @GetMapping(path = "/{slug}", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Get a product of the store",
      description =
          "Only an ACTIVE product. A slug that never existed, a hidden product and a deleted one"
              + " are the same 404 PRODUCT_NOT_FOUND, apart from instance, timestamp and"
              + " correlationId. A status parameter is ignored.")
  @ApiResponse(
      responseCode = "200",
      description = "OK",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON_VALUE,
              schema = @Schema(implementation = StoreProduct.class)))
  @ApiResponse(
      responseCode = "404",
      description = NOT_FOUND_DESCRIPTION,
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
  public StoreProduct get(
      @Parameter(description = SLUG_DESCRIPTION) @PathVariable("slug") String slug) {
    return service.get(slug);
  }

  /**
   * Whether a shopper can see the product with this slug: 200 or 404, with no body. The proxy of
   * {@code user} calls it before it renders a product page, to answer with a real 404 (AC26).
   *
   * <p>The 404 is built here rather than thrown: a thrown {@code PRODUCT_NOT_FOUND} would write the
   * Problem body of the GET, and a {@code HEAD} response has none.
   */
  @RequestMapping(path = "/{slug}", method = RequestMethod.HEAD)
  @Operation(
      summary = "Check that a product of the store exists",
      description = "As the GET of the same path, with no body: 200 or 404 PRODUCT_NOT_FOUND.")
  @ApiResponse(responseCode = "200", description = "The product is ACTIVE")
  @ApiResponse(responseCode = "404", description = NOT_FOUND_DESCRIPTION)
  public ResponseEntity<Void> head(
      @Parameter(description = SLUG_DESCRIPTION) @PathVariable("slug") String slug) {
    return service.isVisible(slug)
        ? ResponseEntity.ok().build()
        : ResponseEntity.notFound().build();
  }
}
