package com.tungph7.learnpostgres.common.security;

import java.io.IOException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.error.ProblemDetailFactory;

import tools.jackson.databind.ObjectMapper;

/**
 * Returns an {@code application/problem+json} body for 401/403 responses, keeping the schema in
 * sync with {@link com.tungph7.learnpostgres.common.error.GlobalExceptionHandler}.
 */
@Component
public class SecurityProblemHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

  private static final Logger log = LoggerFactory.getLogger(SecurityProblemHandler.class);

  private final ProblemDetailFactory problemFactory;
  private final ObjectMapper objectMapper;

  public SecurityProblemHandler(ProblemDetailFactory problemFactory, ObjectMapper objectMapper) {
    this.problemFactory = problemFactory;
    this.objectMapper = objectMapper;
  }

  /** 401 — not authenticated (no token sent or token invalid). */
  @Override
  public void commence(
      HttpServletRequest request, HttpServletResponse response, AuthenticationException ex)
      throws IOException {
    log.warn("Authentication failed at {}: {}", request.getRequestURI(), ex.getMessage());
    ProblemDetail body =
        problemFactory.from(
            ErrorCode.UNAUTHENTICATED,
            HttpStatus.UNAUTHORIZED,
            "Authentication is required.",
            request);
    write(response, HttpStatus.UNAUTHORIZED, body);
  }

  /** 403 — authenticated but lacks the required permission. */
  @Override
  public void handle(
      HttpServletRequest request, HttpServletResponse response, AccessDeniedException ex)
      throws IOException {
    log.warn("Access denied at {}: {}", request.getRequestURI(), ex.getMessage());
    ProblemDetail body =
        problemFactory.from(
            ErrorCode.ACCESS_DENIED,
            HttpStatus.FORBIDDEN,
            "You don't have permission to access this resource.",
            request);
    write(response, HttpStatus.FORBIDDEN, body);
  }

  private void write(HttpServletResponse response, HttpStatus status, ProblemDetail body)
      throws IOException {
    response.setStatus(status.value());
    response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
    objectMapper.writeValue(response.getOutputStream(), body);
  }
}
