package com.tungph7.learnpostgres.common.error;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import jakarta.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.core.MethodParameter;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.validation.FieldError;
import org.springframework.validation.method.ParameterErrors;
import org.springframework.validation.method.ParameterValidationResult;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
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

  /**
   * The order in which the constraints of one field are reported, by the code of the constraint:
   * the value is missing, then it is of the wrong kind (a fraction, a bad format), then it is too
   * long, too small or too big. Other constraints, such as the class-level rules that compare a
   * field with another, come last, since they only mean something once the field itself is valid.
   */
  private static final List<String> RULE_ORDER =
      List.of(
          "NotNull",
          "NotBlank",
          "NotEmpty",
          "Digits",
          "Pattern",
          "Email",
          "Size",
          "DecimalMin",
          "Min",
          "Positive",
          "PositiveOrZero",
          "DecimalMax",
          "Max",
          "Negative",
          "NegativeOrZero");

  private static final Comparator<FieldError> RULE_PRIORITY =
      Comparator.comparingInt(GlobalExceptionHandler::ruleRank)
          .thenComparing(error -> Objects.requireNonNullElse(error.getCode(), ""));

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
   * /products/{id}}). The body adds only {@code parameter}, as the API Contract of the plan of
   * SHOP-7 writes a parameter error.
   */
  @ExceptionHandler(MethodArgumentTypeMismatchException.class)
  public ResponseEntity<ProblemDetail> handleTypeMismatch(
      MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
    String paramName = ex.getName();
    String expectedType =
        ex.getRequiredType() != null ? ex.getRequiredType().getSimpleName() : "unknown";
    String detail =
        "Parameter '%s' has invalid value '%s' (expected: %s)."
            .formatted(paramName, ex.getValue(), expectedType);

    log.warn("Type mismatch at {}: {}", request.getRequestURI(), detail);

    return invalidParameter(paramName, detail, request);
  }

  /**
   * A handler method whose arguments break their constraints (NFR3). Without this handler the
   * catch-all made it a 500.
   *
   * <ul>
   *   <li>A {@code @RequestParam} or {@code @PathVariable} that breaks a constraint, such as
   *       {@code @Min(0) int offset}: 400 {@code INVALID_PARAMETER} naming the first invalid
   *       parameter, in the order of the method, as the type mismatch above does.
   *   <li>Otherwise, a {@code @Valid} object, such as the request body of a method that also has a
   *       constrained parameter ({@link ParameterErrors}): 400 {@code VALIDATION_FAILED} with its
   *       field errors, as {@link #handleValidation} writes them. The object itself is never in the
   *       response or the log (NFR12).
   *   <li>A return value that breaks a constraint is a bug of the app, not of the request, so it
   *       stays a 500.
   * </ul>
   */
  @ExceptionHandler(HandlerMethodValidationException.class)
  public ResponseEntity<ProblemDetail> handleMethodValidation(
      HandlerMethodValidationException ex, HttpServletRequest request) {
    List<ParameterValidationResult> arguments =
        ex.getParameterValidationResults().stream()
            .filter(result -> result.getMethodParameter().getParameterIndex() >= 0)
            .toList();
    ParameterValidationResult first =
        arguments.stream()
            .filter(result -> !(result instanceof ParameterErrors))
            .min(Comparator.comparingInt(result -> result.getMethodParameter().getParameterIndex()))
            .orElse(null);
    if (first != null) {
      return invalidParameter(first, request);
    }
    if (arguments.isEmpty()) {
      return handleAny(ex, request);
    }
    List<FieldError> fieldErrors =
        arguments.stream()
            .map(ParameterErrors.class::cast)
            .flatMap(errors -> errors.getFieldErrors().stream())
            .toList();
    return validationFailed(fieldErrors, request);
  }

  /**
   * The {@code @Valid} request body breaks its constraints: 400 {@code VALIDATION_FAILED} with one
   * error per invalid field (AC7), see {@link #validationFailed}.
   */
  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ProblemDetail> handleValidation(
      MethodArgumentNotValidException ex, HttpServletRequest request) {
    return validationFailed(ex.getBindingResult().getFieldErrors(), request);
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

  /** The 400 {@code INVALID_PARAMETER} of a parameter that breaks a constraint. */
  private ResponseEntity<ProblemDetail> invalidParameter(
      ParameterValidationResult result, HttpServletRequest request) {
    String paramName = parameterName(result.getMethodParameter());
    String reason =
        result.getResolvableErrors().stream()
            .map(MessageSourceResolvable::getDefaultMessage)
            .filter(message -> message != null && !message.isBlank())
            .findFirst()
            .orElse("is invalid");
    String detail =
        "Parameter '%s' has invalid value '%s' (%s)."
            .formatted(paramName, result.getArgument(), reason);

    log.warn("Invalid parameter at {}: {}", request.getRequestURI(), detail);

    return invalidParameter(paramName, detail, request);
  }

  /**
   * A 400 {@code INVALID_PARAMETER} that adds {@code parameter} and nothing more, as the API
   * Contract writes it.
   */
  private ResponseEntity<ProblemDetail> invalidParameter(
      String paramName, String detail, HttpServletRequest request) {
    ProblemDetail body =
        problemFactory.from(
            ErrorCode.INVALID_PARAMETER,
            HttpStatus.BAD_REQUEST,
            detail,
            request,
            Map.of("parameter", paramName));
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
  }

  /**
   * The 400 {@code VALIDATION_FAILED} of an object whose fields break their constraints: {@code
   * errors} has one {@code field}, {@code rejectedValue} and {@code message} per invalid field, and
   * {@code detail} counts the fields. A field that breaks several constraints shows the one that
   * comes first in {@link #RULE_ORDER}.
   */
  private ResponseEntity<ProblemDetail> validationFailed(
      List<FieldError> fieldErrors, HttpServletRequest request) {
    Map<String, FieldError> firstByField = new LinkedHashMap<>();
    for (FieldError error : fieldErrors) {
      firstByField.merge(
          error.getField(),
          error,
          (kept, other) -> RULE_PRIORITY.compare(other, kept) < 0 ? other : kept);
    }
    List<Map<String, Object>> errors =
        firstByField.values().stream()
            .map(
                fe -> {
                  Map<String, Object> m = new LinkedHashMap<>();
                  m.put("field", fe.getField());
                  m.put("rejectedValue", fe.getRejectedValue());
                  m.put("message", fe.getDefaultMessage());
                  return m;
                })
            .toList();

    log.warn("Validation failed at {}: {} field(s)", request.getRequestURI(), errors.size());

    ProblemDetail body =
        problemFactory.from(
            ErrorCode.VALIDATION_FAILED,
            HttpStatus.BAD_REQUEST,
            "Validation failed for %d field(s).".formatted(errors.size()),
            request,
            Map.of("errors", errors));
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
  }

  private static int ruleRank(FieldError error) {
    int rank = RULE_ORDER.indexOf(error.getCode());
    return rank >= 0 ? rank : RULE_ORDER.size();
  }

  /**
   * The name the client sent a parameter under: the name of its {@code @RequestParam} or {@code
   * PathVariable} when it gives one, else the name of the Java parameter.
   */
  private static String parameterName(MethodParameter parameter) {
    RequestParam requestParam = parameter.getParameterAnnotation(RequestParam.class);
    if (requestParam != null && !requestParam.name().isEmpty()) {
      return requestParam.name();
    }
    PathVariable pathVariable = parameter.getParameterAnnotation(PathVariable.class);
    if (pathVariable != null && !pathVariable.name().isEmpty()) {
      return pathVariable.name();
    }
    return Objects.requireNonNullElse(
        parameter.getParameterName(), "arg" + parameter.getParameterIndex());
  }

  /** Finds the root-cause message — used for logging only, never echoed to the client. */
  private static String rootMessage(Throwable t) {
    Throwable cur = t;
    while (cur.getCause() != null && cur.getCause() != cur) {
      cur = cur.getCause();
    }
    return cur.getMessage() != null ? cur.getMessage() : cur.getClass().getSimpleName();
  }
}
