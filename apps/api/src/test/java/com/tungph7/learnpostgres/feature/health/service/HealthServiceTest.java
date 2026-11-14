package com.tungph7.learnpostgres.feature.health.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.env.Environment;

import com.tungph7.learnpostgres.feature.health.dto.HealthResponse;

@ExtendWith(MockitoExtension.class)
class HealthServiceTest {

  @Mock Environment environment;

  @Test
  void getHealth_returns_active_profiles_joined() {
    when(environment.getActiveProfiles()).thenReturn(new String[] {"dev", "local"});

    HealthService service = new HealthService(environment, "demo-app", "1.0.0");

    HealthResponse resp = service.getHealth();

    assertThat(resp.getStatus()).isEqualTo("UP");
    assertThat(resp.getApplication()).isEqualTo("demo-app");
    assertThat(resp.getVersion()).isEqualTo("1.0.0");
    assertThat(resp.getProfile()).isEqualTo("dev,local");
    assertThat(resp.getJavaVersion()).isNotBlank();
    assertThat(resp.getUptimeSeconds()).isGreaterThanOrEqualTo(0);
    assertThat(resp.getCheckedAt()).isNotNull();
  }

  @Test
  void getHealth_returns_default_when_no_active_profiles() {
    when(environment.getActiveProfiles()).thenReturn(new String[] {});

    HealthService service = new HealthService(environment, "demo-app", "1.0.0");

    HealthResponse resp = service.getHealth();

    assertThat(resp.getProfile()).isEqualTo("default");
    assertThat(resp.getStatus()).isEqualTo("UP");
  }
}
