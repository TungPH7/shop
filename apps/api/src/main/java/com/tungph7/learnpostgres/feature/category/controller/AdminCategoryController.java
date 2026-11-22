package com.tungph7.learnpostgres.feature.category.controller;

import java.net.URI;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tungph7.learnpostgres.feature.category.dto.AdminCategory;
import com.tungph7.learnpostgres.feature.category.dto.AdminCategoryListItem;
import com.tungph7.learnpostgres.feature.category.dto.CreateCategoryRequest;
import com.tungph7.learnpostgres.feature.category.dto.ItemList;
import com.tungph7.learnpostgres.feature.category.dto.UpdateCategoryRequest;
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

  /** One category, visible or hidden, for the edit form: 200, or 404 when no category has it. */
  @GetMapping(path = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Get a category",
      description = "Returns the category, VISIBLE or HIDDEN, with the version to send back.")
  @ApiResponse(responseCode = "200", description = "OK")
  @ApiResponse(
      responseCode = "400",
      description = "INVALID_PARAMETER: the id is not a UUID",
      content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM_REF)))
  @ApiResponse(
      responseCode = "404",
      description = "CATEGORY_NOT_FOUND: no category has this id",
      content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM_REF)))
  public AdminCategory get(@PathVariable("id") UUID id) {
    return service.get(id);
  }

  /**
   * Edits a category with every field: 200 with the category and its new version. The checks and
   * their order are those of {@link AdminCategoryService#update}.
   */
  @PutMapping(path = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Edit a category",
      description =
          "Checks every field against the Category Rules (400), then: no category has the id"
              + " (404 CATEGORY_NOT_FOUND); the version is not the stored one (409"
              + " OPTIMISTIC_LOCK_CONFLICT); another category has the name, ignoring case (409"
              + " CATEGORY_NAME_DUPLICATED); the slug changes to one taken (409"
              + " CATEGORY_SLUG_DUPLICATED). Nothing is written when a check fails. A changed slug"
              + " makes the store page of the old one a 404.")
  @ApiResponse(responseCode = "200", description = "OK, with the new version")
  @ApiResponse(
      responseCode = "400",
      description =
          "VALIDATION_FAILED with errors, one per invalid field; INVALID_PARAMETER when the id is"
              + " not a UUID",
      content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM_REF)))
  @ApiResponse(
      responseCode = "404",
      description = "CATEGORY_NOT_FOUND: no category has this id",
      content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM_REF)))
  @ApiResponse(
      responseCode = "409",
      description =
          "OPTIMISTIC_LOCK_CONFLICT: the category was edited since the version sent was read;"
              + " CATEGORY_NAME_DUPLICATED: another category has the name;"
              + " CATEGORY_SLUG_DUPLICATED: another category has the new slug",
      content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM_REF)))
  public AdminCategory update(
      @PathVariable("id") UUID id, @Valid @RequestBody UpdateCategoryRequest request) {
    return service.update(id, request);
  }

  /**
   * Deletes a category, also one with products, which are left without category and otherwise
   * unchanged (AC8): 204, also when the category is already gone (NFR12).
   */
  @DeleteMapping("/{id}")
  @Operation(
      summary = "Delete a category",
      description =
          "Its products, on sale or hidden, are left without category; nothing else of them"
              + " changes but updated_at. Idempotent: 204 also when no category has this id.")
  @ApiResponse(responseCode = "204", description = "Deleted, or already gone")
  @ApiResponse(
      responseCode = "400",
      description = "INVALID_PARAMETER: the id is not a UUID",
      content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM_REF)))
  public ResponseEntity<Void> delete(@PathVariable("id") UUID id) {
    service.delete(id);
    return ResponseEntity.noContent().build();
  }
}
