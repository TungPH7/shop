package com.tungph7.learnpostgres.common.error;

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
}
