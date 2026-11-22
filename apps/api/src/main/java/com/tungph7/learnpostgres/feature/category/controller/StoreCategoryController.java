package com.tungph7.learnpostgres.feature.category.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.tungph7.learnpostgres.feature.category.dto.CategorySitemapEntry;
import com.tungph7.learnpostgres.feature.category.dto.ItemList;
import com.tungph7.learnpostgres.feature.category.dto.StoreCategory;
import com.tungph7.learnpostgres.feature.category.service.StoreCategoryService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * The store API of categories, {@code /api/categories}, {@code /api/categories/{slug}} and {@code
 * /api/sitemap/categories} (ADR-0003): called only by the server of {@code user}, with {@code GET}
 * and {@code HEAD} (NFR7). It shows only {@code VISIBLE} categories and takes no status parameter
 * (NFR8). The products of a category are in {@code StoreProductController}. The API Contract is in
 * the plan of SHOP-81.
 */
@RestController
@Tag(name = "Store categories", description = "The categories shoppers see, for the user app")
public class StoreCategoryController {

  static final String BASE_PATH = "/api/categories";
  static final String DETAIL_PATH = BASE_PATH + "/{slug}";

  /**
   * Outside {@link #BASE_PATH}, so that a category whose slug is {@code sitemap} keeps its page
   * (ADR-0003).
   */
  static final String SITEMAP_PATH = "/api/sitemap/categories";

  private static final String SLUG_DESCRIPTION = "Slug of the category, compared ignoring case";
  private static final String NOT_FOUND_DESCRIPTION =
      "CATEGORY_NOT_FOUND: no category has this slug, or it is hidden or deleted;"
          + " the body is the same in each case";

  private final StoreCategoryService service;

  public StoreCategoryController(StoreCategoryService service) {
    this.service = service;
  }

  /** The {@code VISIBLE} categories with at least one product on sale, in the order of names. */
  @GetMapping(path = BASE_PATH, produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List the categories of the store",
      description =
          "The VISIBLE categories that have at least one ACTIVE product, sorted by name in"
              + " Vietnamese order ignoring case, then by id: name and slug only. A status"
              + " parameter is ignored.")
  @ApiResponse(responseCode = "200", description = "OK")
  public ItemList<StoreCategory> list() {
    return service.list();
  }

  /** The {@code VISIBLE} category with this slug; any other is a 404 {@code CATEGORY_NOT_FOUND}. */
  @GetMapping(path = DETAIL_PATH, produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Get a category of the store",
      description =
          "Only a VISIBLE category, with or without ACTIVE products; slug is the stored one. A"
              + " slug that never existed, a hidden category and a deleted one are the same 404"
              + " CATEGORY_NOT_FOUND, apart from instance, timestamp and correlationId.")
  @ApiResponse(
      responseCode = "200",
      description = "OK",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON_VALUE,
              schema = @Schema(implementation = StoreCategory.class)))
  @ApiResponse(
      responseCode = "404",
      description = NOT_FOUND_DESCRIPTION,
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
  public StoreCategory get(
      @Parameter(description = SLUG_DESCRIPTION) @PathVariable("slug") String slug) {
    return service.get(slug);
  }

  /**
   * Whether a shopper can see the category with this slug: 200 or 404, with no body. The proxy of
   * {@code user} calls it before it renders a category page, to answer with a real 404 (AC16).
   *
   * <p>The 404 is built here rather than thrown: a thrown {@code CATEGORY_NOT_FOUND} would write
   * the Problem body of the GET, and a {@code HEAD} response has none.
   */
  @RequestMapping(path = DETAIL_PATH, method = RequestMethod.HEAD)
  @Operation(
      summary = "Check that a category of the store exists",
      description = "As the GET of the same path, with no body: 200 or 404 CATEGORY_NOT_FOUND.")
  @ApiResponse(responseCode = "200", description = "The category is VISIBLE")
  @ApiResponse(responseCode = "404", description = NOT_FOUND_DESCRIPTION)
  public ResponseEntity<Void> head(
      @Parameter(description = SLUG_DESCRIPTION) @PathVariable("slug") String slug) {
    return service.isVisible(slug)
        ? ResponseEntity.ok().build()
        : ResponseEntity.notFound().build();
  }

  /** The categories of the sitemap: their slug and last update, in the order of their ids. */
  @GetMapping(path = SITEMAP_PATH, produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List the categories of the sitemap",
      description =
          "The VISIBLE categories that have at least one ACTIVE product, in the order of their"
              + " ids. updatedAt is the later of the last update of the category and of its ACTIVE"
              + " products. A status parameter is ignored.")
  @ApiResponse(responseCode = "200", description = "OK")
  public ItemList<CategorySitemapEntry> sitemap() {
    return service.sitemap();
  }
}
