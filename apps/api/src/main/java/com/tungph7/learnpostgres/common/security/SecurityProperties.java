package com.tungph7.learnpostgres.common.security;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.security")
public record SecurityProperties(Cors cors, Headers headers) {
  public record Cors(
      List<String> allowedOrigins,
      List<String> allowedMethods,
      List<String> allowedHeaders,
      List<String> exposedHeaders,
      boolean allowCredentials,
      long maxAgeSeconds) {}

  public record Headers(String csp, String referrerPolicy, String permissionsPolicy, Hsts hsts) {}

  public record Hsts(long maxAge, boolean includeSubdomains, boolean preload) {}
}
