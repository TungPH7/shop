package com.tungph7.learnpostgres.common.error;

import org.springframework.http.HttpStatus;

/**
 * 409 Conflict — the request is valid but conflicts with the current state of the resource.
 *
 * <p>Used for:
 *
 * <ul>
 *   <li>UNIQUE violation (e.g. duplicated slug).
 *   <li>Optimistic lock conflict (version mismatch).
 *   <li>Business rule conflict (e.g. a shipped order cannot be cancelled).
 * </ul>
 *
 * <p>Differs from 422 Unprocessable Entity:
 *
 * <ul>
 *   <li>409 = state issue (fixable by retry or refresh).
 *   <li>422 = semantic invalid (input that does not make sense — e.g. a birthdate in the future).
 * </ul>
 *
 * <p>This project does not use 422; it prefers 400 for semantic problems and 409 for state.
 */
public class ConflictException extends BusinessException {

  public ConflictException(ErrorCode code, String detail) {
    super(code, HttpStatus.CONFLICT, detail, null);
  }

  public ConflictException(ErrorCode code, String detail, Throwable cause) {
    super(code, HttpStatus.CONFLICT, detail, cause);
  }
}
