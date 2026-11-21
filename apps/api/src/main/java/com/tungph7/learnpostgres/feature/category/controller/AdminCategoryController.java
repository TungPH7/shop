package com.tungph7.learnpostgres.feature.category.controller;

import java.net.URI;

import jakarta.validation.Valid;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tungph7.learnpostgres.feature.category.dto.AdminCategory;
import com.tungph7.learnpostgres.feature.category.dto.AdminCategoryListItem;
import com.tungph7.learnpostgres.feature.category.dto.CreateCategoryRequest;
import com.tungph7.learnpostgres.feature.category.dto.ItemList;
import com.tungph7.learnpostgres.feature.category.service.AdminCategoryService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * The admin API of categories, {@code /api/admin/categories} (ADR-0003): used by {@code admin} and
 * by the E2E helpers of both apps, behind the basic auth of the {@code admin} host. The API
 * Contract is in the plan of SHOP-81.
 */
@RestController
@RequestMapping(AdminCategoryController.BASE_PATH)
@Tag(name = "Admin categories", description = "Category management for the admin app")
public class AdminCategoryController {

  static final String BASE_PATH = "/api/admin/categories";

  static final String PROBLEM_JSON = "application/problem+json";
  static final String PROBLEM_REF = "#/components/schemas/ProblemDetail";

  private final AdminCategoryService service;

  public AdminCategoryController(AdminCategoryService service) {
    this.service = service;
  }

  /**
   * Every category, visible or hidden, in the Vietnamese order of names then by id, each with the
   * number of its products (AC1): the whole list in one response (NFR1).
   */
  @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List categories",
      description =
          "Every category, VISIBLE and HIDDEN, sorted by name in Vietnamese order ignoring case,"
              + " then by id; productCount counts every product of the category, on sale or"
              + " hidden. The whole list, without pages.")
  @ApiResponse(responseCode = "200", description = "OK")
  public ItemList<AdminCategoryListItem> list() {
    return service.list();
  }

  /** Adds a category: 201 with the category and {@code Location: /api/admin/categories/{id}}. */
  @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Add a category",
      description =
          "Checks every field against the Category Rules and lists each invalid field in one 400."
              + " Then a name taken, ignoring case but not accents, is a 409"
              + " CATEGORY_NAME_DUPLICATED, and a slug typed that is taken, ignoring case, a 409"
              + " CATEGORY_SLUG_DUPLICATED. Without a slug, the slug is generated from the name,"
              + " with -2, -3... when taken, up to -1000. The status defaults to VISIBLE.")
  @ApiResponse(
      responseCode = "201",
      description = "Created",
      headers =
          @Header(
              name = "Location",
              description = "/api/admin/categories/{id}",
              schema = @Schema(type = "string")),
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON_VALUE,
              schema = @Schema(implementation = AdminCategory.class)))
  @ApiResponse(
      responseCode = "400",
      description = "VALIDATION_FAILED with errors, one per invalid field",
      content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM_REF)))
  @ApiResponse(
      responseCode = "409",
      description =
          "CATEGORY_NAME_DUPLICATED: another category has the name; CATEGORY_SLUG_DUPLICATED: the"
              + " slug typed is taken, or every generated slug up to -1000 is",
      content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM_REF)))
  public ResponseEntity<AdminCategory> create(@Valid @RequestBody CreateCategoryRequest request) {
    AdminCategory category = service.create(request);
    return ResponseEntity.created(URI.create(BASE_PATH + "/" + category.id())).body(category);
  }
}
