package com.tungph7.learnpostgres.common.error;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Global exception handler for the REST API.
 *
 * <p>Covers:
 *
 * <ol>
 *   <li>{@link BusinessException} and its subclasses (custom 4xx/5xx).
 *   <li>Common Spring framework exceptions.
 *   <li>JPA / Hibernate exceptions (optimistic lock, data integrity).
 *   <li>Catch-all {@link Exception} → 500 with no internal leakage.
 * </ol>
 *
 * <p>Logging policy:
 *
 * <ul>
 *   <li>4xx: WARN, no stacktrace.
 *   <li>5xx: ERROR, with stacktrace.
 * </ul>
 *
 * <p>The response body is always {@code application/problem+json} (Spring sets this automatically
 * when a {@link ProblemDetail} is returned).
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  private final ProblemDetailFactory problemFactory;

  public GlobalExceptionHandler(ProblemDetailFactory problemFactory) {
    this.problemFactory = problemFactory;
  }

  // =================================================================
  // 1. Business exceptions (mostly 4xx; 5xx is rare)
  // =================================================================

  @ExceptionHandler(BusinessException.class)
  public ResponseEntity<ProblemDetail> handleBusiness(
      BusinessException ex, HttpServletRequest request) {
    if (ex.getStatus().is5xxServerError()) {
      log.error(
          "Business 5xx [{}] at {}: {}", ex.getCode(), request.getRequestURI(), ex.getDetail(), ex);
    } else {
      log.warn(
          "Business {} [{}] at {}: {}",
          ex.getStatus().value(),
          ex.getCode(),
          request.getRequestURI(),
          ex.getDetail());
    }
    ProblemDetail body = problemFactory.from(ex, request);
    return ResponseEntity.status(ex.getStatus()).body(body);
  }

  // =================================================================
  // 2. Spring framework exceptions
  // =================================================================

  /**
   * The JSON body cannot be parsed (bad syntax, wrong type, missing required). Typically caused by
   * the client sending {@code price: "abc"} instead of a number.
   */
  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ProblemDetail> handleNotReadable(
      HttpMessageNotReadableException ex, HttpServletRequest request) {
    log.warn("Malformed request body at {}: {}", request.getRequestURI(), rootMessage(ex));
    // Do NOT echo ex.getMessage() — Jackson messages sometimes leak internal field names.
    ProblemDetail body =
        problemFactory.from(
            ErrorCode.MALFORMED_REQUEST,
            HttpStatus.BAD_REQUEST,
            "Request body could not be read. Check JSON syntax and field types.",
            request);
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
  }

  /**
   * {@code @PathVariable} / {@code @RequestParam} of the wrong type (e.g. an invalid UUID at {@code
   * /products/{id}}).
   */
  @ExceptionHandler(MethodArgumentTypeMismatchException.class)
  public ResponseEntity<ProblemDetail> handleTypeMismatch(
      MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
    String paramName = ex.getName();
    Object rejectedValue = ex.getValue();
    String expectedType =
        ex.getRequiredType() != null ? ex.getRequiredType().getSimpleName() : "unknown";
    String detail =
        "Parameter '%s' has invalid value '%s' (expected: %s)."
            .formatted(paramName, rejectedValue, expectedType);

    log.warn("Type mismatch at {}: {}", request.getRequestURI(), detail);

    Map<String, Object> extra = new LinkedHashMap<>();
    extra.put("parameter", paramName);
    extra.put("rejectedValue", rejectedValue);
    extra.put("expectedType", expectedType);

    ProblemDetail body =
        problemFactory.from(
            ErrorCode.INVALID_PARAMETER, HttpStatus.BAD_REQUEST, detail, request, extra);
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
  }

  /**
   * Bean Validation failure. Wired in advance of the per-endpoint {@code @Valid} usage so
   * validation can plug in without changes here.
   */
  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ProblemDetail> handleValidation(
      MethodArgumentNotValidException ex, HttpServletRequest request) {
    List<Map<String, Object>> fieldErrors =
        ex.getBindingResult().getFieldErrors().stream()
            .map(
                fe -> {
                  Map<String, Object> m = new LinkedHashMap<>();
                  m.put("field", fe.getField());
                  m.put("rejectedValue", fe.getRejectedValue());
                  m.put("message", fe.getDefaultMessage());
                  return m;
                })
            .toList();

    log.warn(
        "Validation failed at {}: {} field error(s)", request.getRequestURI(), fieldErrors.size());

    Map<String, Object> extra = Map.of("errors", fieldErrors);
    ProblemDetail body =
        problemFactory.from(
            ErrorCode.VALIDATION_FAILED,
            HttpStatus.BAD_REQUEST,
            "Validation failed for %d field(s).".formatted(fieldErrors.size()),
            request,
            extra);
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
  }

  /**
   * No handler method supports this HTTP method (e.g. {@code PATCH /api/products} when the
   * controller only declares POST/GET/PUT/DELETE).
   */
  @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
  public ResponseEntity<ProblemDetail> handleMethodNotSupported(
      HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {
    String supported =
        ex.getSupportedHttpMethods() != null ? ex.getSupportedHttpMethods().toString() : "[]";
    String detail = "Method %s not supported. Supported: %s.".formatted(ex.getMethod(), supported);

    log.warn("Method not supported at {}: {}", request.getRequestURI(), detail);

    ProblemDetail body =
        problemFactory.from(
            ErrorCode.METHOD_NOT_SUPPORTED, HttpStatus.METHOD_NOT_ALLOWED, detail, request);
    return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
        .header("Allow", supported.replaceAll("[\\[\\]]", ""))
        .body(body);
  }

  /**
   * Path matches no handler.
   *
   * <ul>
   *   <li>Spring 6.1+ throws {@link NoResourceFoundException} (when {@code add-mappings=false}).
   *   <li>Older Spring (or {@code throw-exception-if-no-handler-found=true}) throws {@link
   *       NoHandlerFoundException}.
   * </ul>
   *
   * <p>Both are caught so the handler works regardless of configuration.
   */
  @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
  public ResponseEntity<ProblemDetail> handleNoResource(Exception ex, HttpServletRequest request) {
    log.warn("No handler at {}: {}", request.getRequestURI(), ex.getMessage());
    ProblemDetail body =
        problemFactory.from(
            ErrorCode.RESOURCE_NOT_FOUND,
            HttpStatus.NOT_FOUND,
            "No resource at %s.".formatted(request.getRequestURI()),
            request);
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
  }

  // =================================================================
  // 3. JPA / Hibernate exceptions
  // =================================================================

  /** Optimistic lock conflict — the entity was modified by another transaction. Mapped to 409. */
  @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
  public ResponseEntity<ProblemDetail> handleOptimisticLock(
      ObjectOptimisticLockingFailureException ex, HttpServletRequest request) {
    log.warn(
        "Optimistic lock conflict at {}: entity={} id={}",
        request.getRequestURI(),
        ex.getPersistentClassName(),
        ex.getIdentifier());
    ProblemDetail body =
        problemFactory.from(
            ErrorCode.OPTIMISTIC_LOCK_CONFLICT,
            HttpStatus.CONFLICT,
            "Resource was modified by another transaction. " + "Please reload and retry.",
            request);
    return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
  }

  /**
   * UNIQUE / FK / NOT NULL constraint violations, etc. Attempts to detect specific cases (UNIQUE on
   * slug → 409 with a dedicated code; anything else → generic 409).
   *
   * <p>Do NOT echo {@code ex.getMessage()} — Postgres error messages contain SQL fragments and
   * internal constraint names.
   */
  @ExceptionHandler(DataIntegrityViolationException.class)
  public ResponseEntity<ProblemDetail> handleDataIntegrity(
      DataIntegrityViolationException ex, HttpServletRequest request) {
    String rootMsg = rootMessage(ex).toLowerCase(Locale.ROOT);

    // Branch on the constraint name when it is identifiable.
    ErrorCode code;
    String detail;
    if (rootMsg.contains("products_slug_unique")
        || (rootMsg.contains("unique") && rootMsg.contains("slug"))) {
      code = ErrorCode.PRODUCT_SLUG_DUPLICATED;
      detail = "Product slug already exists.";
    } else {
      code = ErrorCode.DATA_INTEGRITY_VIOLATION;
      detail = "Data integrity violation.";
    }

    log.warn(
        "Data integrity violation at {}: code={} root={}", request.getRequestURI(), code, rootMsg);

    ProblemDetail body = problemFactory.from(code, HttpStatus.CONFLICT, detail, request);
    return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
  }

  // =================================================================
  // 4. Catch-all
  // =================================================================

  /**
   * Any other exception is treated as an app bug — returns a generic 500 with no internal leakage.
   * Always logs the full stacktrace plus the correlation-id so the team can locate the log entry.
   */
  @ExceptionHandler(Exception.class)
  public ResponseEntity<ProblemDetail> handleAny(Exception ex, HttpServletRequest request) {
    log.error("Unhandled exception at {}", request.getRequestURI(), ex);
    ProblemDetail body =
        problemFactory.from(
            ErrorCode.INTERNAL_ERROR,
            HttpStatus.INTERNAL_SERVER_ERROR,
            "An unexpected error occurred. Please contact support with the correlationId.",
            request);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
  }

  // =================================================================
  // Helpers
  // =================================================================

  /** Finds the root-cause message — used for logging only, never echoed to the client. */
  private static String rootMessage(Throwable t) {
    Throwable cur = t;
    while (cur.getCause() != null && cur.getCause() != cur) {
      cur = cur.getCause();
    }
    return cur.getMessage() != null ? cur.getMessage() : cur.getClass().getSimpleName();
  }
}
