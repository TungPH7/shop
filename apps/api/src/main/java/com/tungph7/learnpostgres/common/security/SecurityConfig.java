package com.tungph7.learnpostgres.common.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.CrossOriginOpenerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {

  @Bean
  public SecurityFilterChain securityFilterChain(
      HttpSecurity http, SecurityProperties props, SecurityProblemHandler problemHandler)
      throws Exception {
    SecurityProperties.Headers h = props.headers();
    return http.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .csrf(AbstractHttpConfigurer::disable)
        .cors(Customizer.withDefaults())
        .formLogin(AbstractHttpConfigurer::disable)
        .httpBasic(AbstractHttpConfigurer::disable)
        .logout(AbstractHttpConfigurer::disable)
        .authorizeHttpRequests(
            auth ->
                auth
                    // === Probe & monitoring ===
                    // Probes too: the Docker HEALTHCHECK calls liveness unauthenticated (SHOP-5).
                    .requestMatchers(
                        "/actuator/health",
                        "/actuator/health/liveness",
                        "/actuator/health/readiness",
                        "/actuator/info")
                    .permitAll()

                    // === API documentation ===
                    .requestMatchers(
                        "/v3/api-docs/**",
                        "/v3/api-docs.yaml",
                        "/swagger-ui/**",
                        "/swagger-ui.html")
                    .permitAll()

                    // === Spring error dispatch (bypass auth to avoid recursion) ===
                    .requestMatchers("/error")
                    .permitAll()

                    // === Future: auth endpoints once JWT is wired in ===
                    // .requestMatchers("/api/auth/**").permitAll()

                    // === Business API ===
                    // Switch to .authenticated() once JWT auth is in place.
                    .requestMatchers("/api/**")
                    .permitAll()

                    // === Catch-all ===
                    .anyRequest()
                    .denyAll()) // safe default: deny anything that did not match
        // 401/403 -> problem+json
        .exceptionHandling(
            eh -> eh.authenticationEntryPoint(problemHandler).accessDeniedHandler(problemHandler))
        .headers(
            headers ->
                headers
                    .contentTypeOptions(Customizer.withDefaults())
                    .frameOptions(f -> f.deny())
                    .httpStrictTransportSecurity(
                        hsts ->
                            hsts.includeSubDomains(h.hsts().includeSubdomains())
                                .preload(h.hsts().preload())
                                .maxAgeInSeconds(h.hsts().maxAge()))
                    .referrerPolicy(rp -> rp.policy(parseReferrerPolicy(h.referrerPolicy())))
                    .permissionsPolicyHeader(pp -> pp.policy(h.permissionsPolicy()))
                    .contentSecurityPolicy(csp -> csp.policyDirectives(h.csp()))
                    .crossOriginOpenerPolicy(
                        coop ->
                            coop.policy(
                                CrossOriginOpenerPolicyHeaderWriter.CrossOriginOpenerPolicy
                                    .SAME_ORIGIN)))
        .build();
  }

  @Bean
  public CorsConfigurationSource corsConfigurationSource(SecurityProperties props) {
    SecurityProperties.Cors c = props.cors();
    CorsConfiguration cfg = new CorsConfiguration();
    cfg.setAllowedOrigins(c.allowedOrigins());
    cfg.setAllowedMethods(c.allowedMethods());
    cfg.setAllowedHeaders(c.allowedHeaders());
    cfg.setExposedHeaders(c.exposedHeaders());
    cfg.setAllowCredentials(c.allowCredentials());
    cfg.setMaxAge(c.maxAgeSeconds());

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", cfg);
    return source;
  }

  private static ReferrerPolicyHeaderWriter.ReferrerPolicy parseReferrerPolicy(String raw) {
    if (raw == null || raw.isBlank()) {
      return ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER;
    }
    String normalized = raw.trim().toLowerCase().replace('_', '-');
    for (var p : ReferrerPolicyHeaderWriter.ReferrerPolicy.values()) {
      if (p.getPolicy().equalsIgnoreCase(normalized)) {
        return p;
      }
    }
    throw new IllegalArgumentException("Unknown referrer-policy: " + raw);
  }
}
