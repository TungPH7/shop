package com.tungph7.learnpostgres.common.config;

import java.util.Optional;

import org.springframework.data.domain.AuditorAware;

/**
 * Provides the "who is acting?" identity for JPA Auditing to fill {@code @CreatedBy} /
 * {@code @LastModifiedBy}.
 *
 * <p>Default returns a fixed "system" auditor (no Security context yet). When Spring Security is
 * wired in, replace with something like:
 *
 * <pre>{@code
 * return Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
 *     .filter(Authentication::isAuthenticated)
 *     .map(Authentication::getName)
 *     .or(() -> Optional.of("system")); // fallback for background jobs
 * }</pre>
 *
 * <p>Returns {@link Optional} instead of {@code String} so callers can later return {@code
 * Optional.empty()} (for example on anonymous requests) to leave {@code @CreatedBy} as {@code
 * null}.
 */
class CurrentAuditorProvider implements AuditorAware<String> {

  private static final String SYSTEM_AUDITOR = "system";

  @Override
  public Optional<String> getCurrentAuditor() {
    return Optional.of(SYSTEM_AUDITOR);
  }
}
