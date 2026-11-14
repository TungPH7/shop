package com.tungph7.learnpostgres.feature.health.service;

import java.lang.management.ManagementFactory;
import java.time.Instant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import com.tungph7.learnpostgres.feature.health.dto.HealthResponse;

@Service
public class HealthService {

  private final Environment environment;
  private final String applicationName;
  private final String applicationVersion;

  public HealthService(
      Environment environment,
      @Value("${spring.application.name}") String applicationName,
      @Value("${info.app.version}") String applicationVersion) {
    this.environment = environment;
    this.applicationName = applicationName;
    this.applicationVersion = applicationVersion;
  }

  public HealthResponse getHealth() {
    long uptimeMillis = ManagementFactory.getRuntimeMXBean().getUptime();
    String[] activeProfiles = environment.getActiveProfiles();

    return HealthResponse.builder()
        .status("UP")
        .application(applicationName)
        .version(applicationVersion)
        .profile(activeProfiles.length > 0 ? String.join(",", activeProfiles) : "default")
        .javaVersion(System.getProperty("java.version"))
        .uptimeSeconds(uptimeMillis / 1000)
        .checkedAt(Instant.now())
        .build();
  }
}
