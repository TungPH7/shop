package com.tungph7.learnpostgres.common.logging;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.logging")
public record LoggingProperties(
    String correlationIdHeader, String correlationIdMdcKey, int maxCorrelationIdLength) {
  private static final int DEFAULT_MAX_CORRELATION_ID_LENGTH = 128;

  public LoggingProperties {
    if (correlationIdHeader == null || correlationIdHeader.isBlank()) {
      correlationIdHeader = "X-Correlation-Id";
    }
    if (correlationIdMdcKey == null || correlationIdMdcKey.isBlank()) {
      correlationIdMdcKey = "correlationId";
    }
    if (maxCorrelationIdLength <= 0) {
      maxCorrelationIdLength = DEFAULT_MAX_CORRELATION_ID_LENGTH;
    }
  }
}
