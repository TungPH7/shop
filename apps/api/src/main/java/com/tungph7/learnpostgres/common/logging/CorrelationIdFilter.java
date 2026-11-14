package com.tungph7.learnpostgres.common.logging;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * The earliest filter in the chain.
 *
 * <ol>
 *   <li>Reads the correlation id from the request header (if the client sent one) or generates a
 *       UUIDv4.
 *   <li>Sanitizes it: only {@code [A-Za-z0-9._-]} characters; truncates to {@code maxLength}.
 *   <li>Sets it on MDC and the response header.
 *   <li>Removes it from MDC in {@code finally} (required — thread pools reuse threads).
 * </ol>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

  /** Allows UUIDs, hex, snake/kebab/dot — enough for correlation ids coming from upstream. */
  private static final Pattern SAFE = Pattern.compile("[A-Za-z0-9._-]+");

  private final LoggingProperties props;

  public CorrelationIdFilter(LoggingProperties props) {
    this.props = props;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String header = props.correlationIdHeader();
    String mdcKey = props.correlationIdMdcKey();

    String incoming = request.getHeader(header);
    String correlationId = sanitize(incoming, props.maxCorrelationIdLength());
    if (correlationId == null) {
      correlationId = UUID.randomUUID().toString();
    }

    MDC.put(mdcKey, correlationId);
    response.setHeader(header, correlationId); // echo it back before the response is committed

    try {
      chain.doFilter(request, response);
    } finally {
      MDC.remove(mdcKey);
    }
  }

  private static String sanitize(String raw, int maxLength) {
    if (raw == null) {
      return null;
    }
    String trimmed = raw.trim();
    if (trimmed.isEmpty()) {
      return null;
    }
    if (trimmed.length() > maxLength) {
      trimmed = trimmed.substring(0, maxLength);
    }
    return SAFE.matcher(trimmed).matches() ? trimmed : null; // no match -> drop and regenerate
  }
}
