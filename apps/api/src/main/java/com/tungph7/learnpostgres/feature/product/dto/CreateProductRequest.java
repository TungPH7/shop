package com.tungph7.learnpostgres.feature.product.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import io.swagger.v3.oas.annotations.media.Schema;

public record CreateProductRequest(
    @NotBlank @Size(max = 255) @Schema(example = "Postgres 17 Up & Running") String name,
    @NotBlank
        @Size(max = 100)
        @Pattern(
            regexp = "^[a-z0-9-]+$",
            message = "must be lowercase alphanumeric with hyphens only")
        @Schema(
            example = "pg17-uar",
            description = "URL-friendly identifier, case-insensitive, unique")
        String slug,
    @NotNull @PositiveOrZero @Digits(integer = 10, fraction = 2) @Schema(example = "29.99")
        BigDecimal price,
    @Size(max = 4000) @Schema(example = "Reference book for PostgreSQL 17", nullable = true)
        String description) {}
