package com.tungph7.learnpostgres.common.error;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;

/**
 * 400 Bad Request — invalid input.
 *
 * <p>When to use:
 *
 * <ul>
 *   <li>A business rule validation has failed (for example "items weighing &gt; 100kg require a
 *       special code"). Field-level Bean Validation is handled by {@code
 *       MethodArgumentNotValidException} — do <em>not</em> throw this class for that.
 *   <li>An invalid state transition (for example "a paid order cannot have its items edited"). If
 *       the issue is a state conflict, prefer 409 (see {@link ConflictException}) instead.
 * </ul>
 */
public class BadRequestException extends BusinessException {

  public BadRequestException(ErrorCode code, String detail) {
    super(code, HttpStatus.BAD_REQUEST, detail, null);
  }

  public BadRequestException(ErrorCode code, String detail, Throwable cause) {
    super(code, HttpStatus.BAD_REQUEST, detail, cause);
  }

  /**
   * The 400 {@code VALIDATION_FAILED} of one invalid field, found after Bean Validation, such as by
   * the database: the body {@code GlobalExceptionHandler} writes for the field errors of Bean
   * Validation, with one error.
   *
   * @param rejectedValue the value sent, or {@code null} when it is not known
   */
  public static BadRequestException ofField(
      String field, Object rejectedValue, String message, Throwable cause) {
    Map<String, Object> error = new LinkedHashMap<>();
    error.put("field", field);
    error.put("rejectedValue", rejectedValue);
    error.put("message", message);
    BadRequestException e =
        new BadRequestException(
            ErrorCode.VALIDATION_FAILED, "Validation failed for 1 field(s).", cause);
    e.putProperty("errors", List.of(error));
    return e;
  }
}
