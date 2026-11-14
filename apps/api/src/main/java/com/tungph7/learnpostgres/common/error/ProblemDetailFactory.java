package com.tungph7.learnpostgres.common.error;

import java.net.URI;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import jakarta.servlet.http.HttpServletRequest;

import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.stereotype.Component;

import com.tungph7.learnpostgres.common.logging.LoggingProperties;

/**
 * Builds a uniform {@link ProblemDetail} (RFC 7807) response.
 *
 * <p>Every {@code @ExceptionHandler} flows through this factory so every response body shares the
 * same schema:
 *
 * <ul>
 *   <li>The 5 standard RFC 7807 fields (type, title, status, detail, instance).
 *   <li>Four extensions: {@code code}, {@code timestamp}, {@code correlationId}, plus arbitrary
 *       properties.
 * </ul>
 *
 * <p>{@code type} is built from {@code app.errors.base-url} + {@link ErrorCode#code()}. When the
 * base URL is {@code "about:blank"} (for example in unit tests), it falls back to {@link
 * #ABOUT_BLANK}.
 *
 * <p>{@code correlationId} is read from MDC using the key configured in {@link LoggingProperties}
 * ({@code app.logging.correlation-id-mdc-key}). When called outside a request thread (scheduled
 * task, async pool) the value falls back to {@code "no-correlation-id"}.
 */
@Component
public class ProblemDetailFactory {

  private static final URI ABOUT_BLANK = URI.create("about:blank");

  /** Used when MDC has no value (out-of-request, e.g. async pool or scheduler). */
  private static final String NO_CORRELATION = "no-correlation-id";

  // Base URL of error docs, injected from application.yml (`app.errors.base-url`).
  // Defaults to "about:blank" so tests / local development run without extra config.
  private final URI errorBaseUri;

  // Injected to resolve the MDC key dynamically.
  private final LoggingProperties loggingProps;

  public ProblemDetailFactory(
      @Value("${app.errors.base-url:about:blank}") String baseUrl, LoggingProperties loggingProps) {
    this.errorBaseUri = "about:blank".equals(baseUrl) ? ABOUT_BLANK : URI.create(baseUrl);
    this.loggingProps = loggingProps;
  }

  /** Build from a {@link BusinessException} (4xx and business 5xx). */
  public ProblemDetail from(BusinessException ex, HttpServletRequest request) {
    ProblemDetail pd =
        newProblemDetail(
            ex.getStatus(), ex.getCode().defaultTitle(), ex.getDetail(), request, ex.getCode());
    pd.setProperty("code", ex.getCode().code());
    ex.getProperties().forEach(pd::setProperty);
    return pd;
  }

  /**
   * Build with an explicit code and status — used for framework exceptions that do not extend
   * {@link BusinessException} (for example {@code HttpMessageNotReadableException}).
   */
  public ProblemDetail from(
      ErrorCode code, HttpStatus status, String detail, HttpServletRequest request) {
    ProblemDetail pd = newProblemDetail(status, code.defaultTitle(), detail, request, code);
    pd.setProperty("code", code.code());
    return pd;
  }

  /** Build with extra extension properties (e.g. field errors for 400 validation responses). */
  public ProblemDetail from(
      ErrorCode code,
      HttpStatus status,
      String detail,
      HttpServletRequest request,
      Map<String, Object> extraProperties) {
    ProblemDetail pd = from(code, status, detail, request);
    if (extraProperties != null) {
      extraProperties.forEach(pd::setProperty);
    }
    return pd;
  }

  // -----------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------

  private ProblemDetail newProblemDetail(
      HttpStatus status, String title, String detail, HttpServletRequest request, ErrorCode code) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
    pd.setType(typeUriFor(code));
    pd.setTitle(title);
    pd.setInstance(URI.create(request.getRequestURI()));
    pd.setProperty("timestamp", Instant.now().toString());
    pd.setProperty("correlationId", currentCorrelationId());
    return pd;
  }

  // Builds the documentation URI for a given ErrorCode.
  //   base-url = "about:blank"            -> ABOUT_BLANK (keep legacy behavior).
  //   base-url = "https://docs.../errors" -> "https://docs.../errors/PRODUCT_NOT_FOUND".
  private URI typeUriFor(ErrorCode code) {
    if (ABOUT_BLANK.equals(errorBaseUri)) {
      return ABOUT_BLANK;
    }
    return URI.create(errorBaseUri + "/" + code.code());
  }

  /**
   * Reads the correlation id from MDC using the configured key.
   *
   * <ul>
   *   <li>Inside a request thread: the correlation-id filter has already populated MDC, so this
   *       returns the real id.
   *   <li>Outside a request thread (scheduler, async pool): MDC is empty, so the fallback string is
   *       returned.
   * </ul>
   */
  private String currentCorrelationId() {
    return Optional.ofNullable(MDC.get(loggingProps.correlationIdMdcKey())).orElse(NO_CORRELATION);
  }
}
