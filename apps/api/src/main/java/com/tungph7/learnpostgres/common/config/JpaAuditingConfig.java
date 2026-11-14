package com.tungph7.learnpostgres.common.config;

import java.time.Instant;
import java.util.Optional;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.auditing.DateTimeProvider;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * Enables JPA Auditing across the whole project.
 *
 * <p>Three pieces:
 *
 * <ol>
 *   <li>{@code @EnableJpaAuditing} — registers {@code AuditingEntityListener} into the JPA
 *       lifecycle.
 *   <li>{@code auditorProvider} — supplies the "who acted" value for {@code @CreatedBy} /
 *       {@code @LastModifiedBy}. Currently hardcoded to "system"; swap in a SecurityContext-aware
 *       implementation once authentication is wired up.
 *   <li>{@code utcDateTimeProvider} — supplies {@code Instant.now()} (UTC) for {@code @CreatedDate}
 *       / {@code @LastModifiedDate}, independent of the system timezone.
 * </ol>
 *
 * <p>Bean names are referenced explicitly in {@code @EnableJpaAuditing} so Spring does not pick a
 * different bean of the same type (e.g. some other {@code DateTimeProvider} added later).
 */
@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorProvider", dateTimeProviderRef = "utcDateTimeProvider")
public class JpaAuditingConfig {

  /**
   * Supplies the fill value for {@code @CreatedBy} / {@code @LastModifiedBy}. Currently fixed to
   * "system"; replace with an implementation that reads {@code SecurityContextHolder} once
   * authentication is wired in.
   */
  @Bean
  AuditorAware<String> auditorProvider() {
    return new CurrentAuditorProvider();
  }

  /**
   * Supplies the fill value for {@code @CreatedDate} / {@code @LastModifiedDate}.
   *
   * <p>Returns {@code Instant.now()} — pure UTC, matches Postgres {@code timestamptz}. Avoids
   * {@code LocalDateTime.now()} (system timezone) to remove ambiguity when the container runs in a
   * timezone other than the developer's machine.
   */
  @Bean
  DateTimeProvider utcDateTimeProvider() {
    return () -> Optional.of(Instant.now());
  }
}
