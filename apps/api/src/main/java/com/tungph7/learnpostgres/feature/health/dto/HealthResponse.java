package com.tungph7.learnpostgres.feature.health.dto;

import java.time.Instant;

import lombok.Builder;
import lombok.Getter;

@Builder
@Getter
public class HealthResponse {
  private final String status;
  private final String application;
  private final String version;
  private final String profile;
  private final String javaVersion;
  private final long uptimeSeconds;
  private final Instant checkedAt;
}
