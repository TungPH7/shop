package com.tungph7.learnpostgres.common.security;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Slim security chain for tests — {@code @EnableWebSecurity} is required so the {@code
 * HttpSecurity} bean is registered inside a {@code @WebMvcTest} slice (the main app relies on
 * Spring Boot's {@code WebSecurityEnablerConfiguration} auto-config, which does not run in a slice
 * test).
 */
@TestConfiguration
@EnableWebSecurity
public class TestSecurityConfig {

  @Bean
  SecurityFilterChain testSecurityFilterChain(HttpSecurity http) throws Exception {
    return http.csrf(AbstractHttpConfigurer::disable)
        .authorizeHttpRequests(a -> a.anyRequest().permitAll())
        .build();
  }
}
