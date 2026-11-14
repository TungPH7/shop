package com.tungph7.learnpostgres.common.error;

import org.springframework.http.HttpStatus;

/**
 * 404 Not Found — the requested resource does not exist.
 *
 * <p>Used for:
 *
 * <ul>
 *   <li>{@code findById(...)} returning empty.
 *   <li>Lookup by slug / business key with no match.
 * </ul>
 *
 * <p>The detail message <em>is</em> echoed to the client and may contain the id/slug the client
 * sent — it must never leak anything internal.
 */
public class NotFoundException extends BusinessException {

  public NotFoundException(ErrorCode code, String detail) {
    super(code, HttpStatus.NOT_FOUND, detail, null);
  }

  public NotFoundException(ErrorCode code, String detail, Throwable cause) {
    super(code, HttpStatus.NOT_FOUND, detail, cause);
  }
}
