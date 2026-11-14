package com.tungph7.learnpostgres.feature.product.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import io.swagger.v3.oas.annotations.media.Schema;

public record UpdatePriceRequest(
    @NotNull @PositiveOrZero @Digits(integer = 10, fraction = 2) @Schema(example = "19.99")
        BigDecimal price) {}
