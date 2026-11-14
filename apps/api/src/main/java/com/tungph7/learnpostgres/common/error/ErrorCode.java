package com.tungph7.learnpostgres.common.error;

import org.springframework.http.HttpStatus;

/**
 * Catalog of system error codes — the single source of truth.
 *
 * <p>Each entry carries:
 *
 * <ul>
 *   <li>{@code code} (machine-readable, written into the response body's {@code code} field).
 *   <li>{@code defaultStatus} (HTTP status) — a throwing exception may override it, but the default
 *       should match.
 *   <li>{@code defaultTitle} (human-readable, written into the response body's {@code title}
 *       field).
 * </ul>
 *
 * <p>Naming convention: {@code <DOMAIN>_<SITUATION>}, e.g. {@code PRODUCT_NOT_FOUND} (4xx), {@code
 * PRODUCT_SLUG_DUPLICATED} (4xx), {@code VALIDATION_FAILED} (generic 4xx), {@code INTERNAL_ERROR}
 * (5xx fallback).
 *
 * <p>When adding a new entry, ask: "is there an existing ErrorCode that already fits?" Avoid
 * fine-grained explosions — the frontend switches on this enum, and every extra entry adds
 * maintenance cost.
 */
public enum ErrorCode {

  // ==== 400 BAD REQUEST ============================================
  VALIDATION_FAILED(HttpStatus.BAD_REQUEST, "Validation failed"),
  MALFORMED_REQUEST(HttpStatus.BAD_REQUEST, "Malformed request body"),
  INVALID_PARAMETER(HttpStatus.BAD_REQUEST, "Invalid request parameter"),
  UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "Authentication required"),
  ACCESS_DENIED(HttpStatus.FORBIDDEN, "Access denied"),

  // ==== 404 NOT FOUND ==============================================
  PRODUCT_NOT_FOUND(HttpStatus.NOT_FOUND, "Product not found"),
  RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "Resource not found"),

  // ==== 405 METHOD NOT ALLOWED =====================================
  METHOD_NOT_SUPPORTED(HttpStatus.METHOD_NOT_ALLOWED, "HTTP method not supported"),

  // ==== 409 CONFLICT ===============================================
  PRODUCT_SLUG_DUPLICATED(HttpStatus.CONFLICT, "Product slug already exists"),
  OPTIMISTIC_LOCK_CONFLICT(HttpStatus.CONFLICT, "Resource was modified by another transaction"),
  DATA_INTEGRITY_VIOLATION(HttpStatus.CONFLICT, "Data integrity violation"),

  // ==== 415 UNSUPPORTED MEDIA TYPE =================================
  UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported media type"),

  // ==== 500 INTERNAL SERVER ERROR ==================================
  INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected server error");

  private final HttpStatus defaultStatus;
  private final String defaultTitle;

  ErrorCode(HttpStatus defaultStatus, String defaultTitle) {
    this.defaultStatus = defaultStatus;
    this.defaultTitle = defaultTitle;
  }

  public HttpStatus defaultStatus() {
    return defaultStatus;
  }

  public String defaultTitle() {
    return defaultTitle;
  }

  /**
   * Returns the {@code code} as a {@link String} for JSON serialization. (Spring serializes enums
   * via {@code name()} by default, but exposing a dedicated method makes call sites at the response
   * builder easier to read.)
   */
  public String code() {
    return name();
  }
}
