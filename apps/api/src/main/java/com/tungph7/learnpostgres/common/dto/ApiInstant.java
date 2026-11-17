package com.tungph7.learnpostgres.common.dto;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import com.fasterxml.jackson.annotation.JacksonAnnotationsInside;
import com.fasterxml.jackson.annotation.JsonFormat;

/**
 * An {@link java.time.Instant} written as the API Contract of the plan of SHOP-7 writes {@code
 * Instant}: ISO-8601 in UTC with exactly three digits of milliseconds, as {@code
 * 2026-11-15T03:22:11.123Z}. Without it Jackson leaves out a fraction of zero ({@code …:11Z}) and
 * writes micro or nanoseconds when there are some. Digits below the millisecond are cut.
 */
@Target({ElementType.FIELD, ElementType.METHOD, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
@JacksonAnnotationsInside
@JsonFormat(
    shape = JsonFormat.Shape.STRING,
    pattern = ApiInstant.PATTERN,
    timezone = ApiInstant.TIME_ZONE)
public @interface ApiInstant {

  /** The pattern of {@link java.time.format.DateTimeFormatter}. */
  String PATTERN = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'";

  /** The instants are written in UTC. */
  String TIME_ZONE = "UTC";
}
