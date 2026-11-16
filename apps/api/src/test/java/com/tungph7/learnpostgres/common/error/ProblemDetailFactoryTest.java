package com.tungph7.learnpostgres.common.error;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;

import jakarta.servlet.http.HttpServletRequest;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

import com.tungph7.learnpostgres.common.logging.LoggingProperties;

/**
 * The {@code timestamp} of a Problem Details body is written as the API Contract of the plan of
 * SHOP-7 writes an instant, the pattern of {@code ApiInstant}: UTC with exactly three digits of
 * milliseconds, as {@code 2026-11-16T02:10:00.000Z} (SHOP-49).
 */
class ProblemDetailFactoryTest {

  private static final String CONTRACT_INSTANT =
      "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z";

  private final ProblemDetailFactory factory =
      new ProblemDetailFactory("about:blank", new LoggingProperties(null, null, 0));

  @Test
  void from_writesTheTimestampWithThreeDigitsOfMillisecondsInUtc() {
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getRequestURI()).thenReturn("/api/admin/products");

    ProblemDetail problem =
        factory.from(ErrorCode.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR, "boom", request);

    assertThat((String) problem.getProperties().get("timestamp")).matches(CONTRACT_INSTANT);
  }

  @Test
  void timestamp_ofAnInstantWithoutFraction_writesThreeZeros() {
    assertThat(ProblemDetailFactory.timestamp(Instant.parse("2026-11-16T02:10:00Z")))
        .isEqualTo("2026-11-16T02:10:00.000Z");
  }

  @Test
  void timestamp_ofAnInstantWithNanoseconds_cutsBelowTheMillisecond() {
    assertThat(ProblemDetailFactory.timestamp(Instant.parse("2026-11-16T02:10:00.123456789Z")))
        .isEqualTo("2026-11-16T02:10:00.123Z");
  }
}
