package com.tungph7.learnpostgres.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAccessor;

import org.junit.jupiter.api.RepeatedTest;
import org.springframework.data.auditing.DateTimeProvider;

/**
 * The instants of {@code @CreatedDate} and {@code @LastModifiedDate} (SHOP-46): PostgreSQL keeps
 * microseconds, so the entity must hold no finer value, or the product returned by the add and a
 * later read of it could differ by a millisecond.
 */
class JpaAuditingConfigTest {

  private final DateTimeProvider provider = new JpaAuditingConfig().utcDateTimeProvider();

  @RepeatedTest(20)
  void utcDateTimeProvider_givesNowInMicroseconds() {
    Instant before = Instant.now().truncatedTo(ChronoUnit.MICROS);

    TemporalAccessor now = provider.getNow().orElseThrow();

    Instant instant = Instant.from(now);
    assertThat(instant.getNano() % 1_000).isZero();
    assertThat(instant).isAfterOrEqualTo(before);
  }
}
