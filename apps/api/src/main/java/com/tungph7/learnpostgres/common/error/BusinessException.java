package com.tungph7.learnpostgres.common.error;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;

/**
 * Abstract base for all business exceptions.
 *
 * <p>Subclasses: {@link NotFoundException} (404), {@link ConflictException} (409), {@link
 * BadRequestException} (400) — extend with more as needed (for example a 403 forbidden exception).
 *
 * <p>Carries:
 *
 * <ul>
 *   <li>{@code code} ({@link ErrorCode}) — machine-readable identifier.
 *   <li>{@code status} ({@link HttpStatus}) — defaults to {@code code.defaultStatus()}; may be
 *       overridden in rare cases.
 *   <li>{@code detail} — human-readable message that <em>is</em> echoed in the response (safe for
 *       4xx errors).
 *   <li>{@code properties} — arbitrary extension members (for example {@code {"field": "slug",
 *       "rejectedValue": "..."}}).
 * </ul>
 *
 * <p>Extends {@link RuntimeException} — checked exceptions would only add noise here because Spring
 * catches all of these through {@code @ExceptionHandler}.
 */
public abstract class BusinessException extends RuntimeException {

  private final ErrorCode code;
  private final HttpStatus status;
  private final Map<String, Object> properties;

  protected BusinessException(ErrorCode code, String detail) {
    this(code, code.defaultStatus(), detail, null);
  }

  protected BusinessException(ErrorCode code, String detail, Throwable cause) {
    this(code, code.defaultStatus(), detail, cause);
  }

  protected BusinessException(ErrorCode code, HttpStatus status, String detail, Throwable cause) {
    super(detail, cause);
    this.code = code;
    this.status = status;
    this.properties = new HashMap<>();
  }

  /**
   * Adds an extra property that will be copied into ProblemDetail extension members. For example:
   * {@code putProperty("rejectedSlug", "abc-123")}.
   */
  public BusinessException putProperty(String key, Object value) {
    properties.put(key, value);
    return this;
  }

  public ErrorCode getCode() {
    return code;
  }

  public HttpStatus getStatus() {
    return status;
  }

  public String getDetail() {
    return getMessage();
  }

  public Map<String, Object> getProperties() {
    return Collections.unmodifiableMap(properties);
  }
}
