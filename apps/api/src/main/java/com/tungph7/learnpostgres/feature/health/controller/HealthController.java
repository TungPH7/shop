package com.tungph7.learnpostgres.feature.health.controller;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tungph7.learnpostgres.common.dto.ApiResponse;
import com.tungph7.learnpostgres.feature.health.dto.HealthResponse;
import com.tungph7.learnpostgres.feature.health.service.HealthService;

@RestController
@RequestMapping(value = "/api/v1/health", produces = MediaType.APPLICATION_JSON_VALUE)
public class HealthController {

  private final HealthService healthService;

  public HealthController(HealthService healthService) {
    this.healthService = healthService;
  }

  @GetMapping
  public ApiResponse<HealthResponse> health() {
    return ApiResponse.ok("Application is running", healthService.getHealth());
  }
}
