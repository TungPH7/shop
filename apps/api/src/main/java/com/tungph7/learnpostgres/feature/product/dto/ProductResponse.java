package com.tungph7.learnpostgres.feature.product.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

public record ProductResponse(
    @Schema(example = "0193c1f4-7b9a-7a3c-8d2e-aa1c98dead00") UUID id,
    @Schema(example = "Postgres 17 Up & Running") String name,
    @Schema(example = "pg17-uar") String slug,
    @Schema(example = "29.99") BigDecimal price,
    @Schema(nullable = true) String description,
    @Schema(example = "2026-05-09T03:22:11Z") Instant createdAt) {}
