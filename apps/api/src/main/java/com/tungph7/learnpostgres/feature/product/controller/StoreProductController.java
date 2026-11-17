package com.tungph7.learnpostgres.feature.product.controller;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.tungph7.learnpostgres.feature.product.domain.ProductSort;
import com.tungph7.learnpostgres.feature.product.dto.ProductPage;
import com.tungph7.learnpostgres.feature.product.dto.SitemapEntry;
import com.tungph7.learnpostgres.feature.product.dto.StoreProduct;
import com.tungph7.learnpostgres.feature.product.dto.StoreProductSummary;
import com.tungph7.learnpostgres.feature.product.repository.ProductQueryRepository;
import com.tungph7.learnpostgres.feature.product.service.StoreProductService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * The store API of products, {@code /api/products}, {@code /api/products/{slug}} and {@code
 * /api/sitemap/products} (ADR-0003): called only by the server of {@code user}, with {@code GET}
 * and {@code HEAD} (NFR8). It shows only {@code ACTIVE} products and takes no status parameter
 * (NFR9). The API Contract is in the plan of SHOP-7.
 */
@RestController
@Tag(name = "Store products", description = "The products shoppers see, for the user app")
public class StoreProductController {

  static final String BASE_PATH = "/api/products";
  static final String DETAIL_PATH = BASE_PATH + "/{slug}";

  /**
   * Outside {@link #BASE_PATH}, so that a product whose slug is {@code sitemap} keeps its page
   * (ADR-0003).
   */
  static final String SITEMAP_PATH = "/api/sitemap/products";

  private static final String SLUG_DESCRIPTION = "Slug of the product, compared ignoring case";
  private static final String NOT_FOUND_DESCRIPTION =
      "PRODUCT_NOT_FOUND: no product has this slug, or it is hidden or deleted;"
          + " the body is the same in each case";

  private final StoreProductService service;

  public StoreProductController(StoreProductService service) {
    this.service = service;
  }

  /**
   * One page of the {@code ACTIVE} products that match {@code q}, in the order of {@code sort}
   * (SHOP-29). An invalid parameter is a 400 {@code INVALID_PARAMETER} that names it (NFR3), and so
   * is {@code sort=RELEVANCE} with no keyword; an unknown one, such as {@code status}, is ignored.
   */
  @GetMapping(path = BASE_PATH, produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List the products of the store",
      description =
          "Only ACTIVE products. q matches products whose name has a word starting with each word"
              + " of q, ignoring accents and case; a blank q is no search, and a q with no letter"
              + " or digit matches no product. sort defaults to RELEVANCE when q has a word, else"
              + " NEWEST; id is always the last key, so a page never repeats or skips a product."
              + " A status parameter is ignored. An invalid offset, limit or sort, or RELEVANCE"
              + " with no q, is a 400 INVALID_PARAMETER naming it.")
  @ApiResponse(responseCode = "200", description = "OK")
  @ApiResponse(
      responseCode = "400",
      description =
          "INVALID_PARAMETER: a parameter of the wrong type or out of range, or sort RELEVANCE"
              + " with no q",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
  public ProductPage<StoreProductSummary> list(
      @Parameter(
              description =
                  "Keyword, cut at 100 characters; each word matches the start of a word of the"
                      + " name, ignoring accents and case. Blank is no search")
          @RequestParam(name = "q", required = false)
          String q,
      @Parameter(
              description =
                  "Order: NEWEST, PRICE_ASC or PRICE_DESC (then newest), or RELEVANCE (only with"
                      + " q). Defaults to RELEVANCE when q has a word, else NEWEST")
          @RequestParam(name = "sort", required = false)
          ProductSort sort,
      @Parameter(description = "Products to skip, 0 or more")
          @RequestParam(name = "offset", defaultValue = "0")
          @Min(0)
          int offset,
      @Parameter(description = "Products of the page, 1 to 100")
          @RequestParam(name = "limit", defaultValue = "24")
          @Min(1)
          @Max(ProductQueryRepository.MAX_LIMIT)
          int limit) {
    return service.list(q, sort, offset, limit);
  }

  /**
   * One block of the sitemap: the slug and last update of {@code ACTIVE} products, in the order of
   * their ids (SHOP-32). {@code user} reads every block for its {@code sitemap.xml} (AC28). An
   * invalid parameter is a 400 {@code INVALID_PARAMETER} that names it (NFR3); an unknown one, such
   * as {@code status}, is ignored (NFR9).
   */
  @GetMapping(path = SITEMAP_PATH, produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List the products of the sitemap",
      description =
          "The slug and last update of the ACTIVE products, in the order of their ids, which has"
              + " no ties. A status parameter is ignored. An invalid offset or limit is a 400"
              + " INVALID_PARAMETER naming it.")
  @ApiResponse(responseCode = "200", description = "OK")
  @ApiResponse(
      responseCode = "400",
      description = "INVALID_PARAMETER: a parameter of the wrong type or out of range",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
  public ProductPage<SitemapEntry> sitemap(
      @Parameter(description = "Products to skip, 0 or more")
          @RequestParam(name = "offset", defaultValue = "0")
          @Min(0)
          int offset,
      @Parameter(description = "Products of the block, 1 to 1000")
          @RequestParam(name = "limit", defaultValue = "1000")
          @Min(1)
          @Max(ProductQueryRepository.MAX_SITEMAP_LIMIT)
          int limit) {
    return service.sitemap(offset, limit);
  }

  /** The {@code ACTIVE} product with this slug; any other is a 404 {@code PRODUCT_NOT_FOUND}. */
  @GetMapping(path = DETAIL_PATH, produces = MediaType.APPLICATION_JSON_VALUE)
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
  @RequestMapping(path = DETAIL_PATH, method = RequestMethod.HEAD)
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
