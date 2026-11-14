package com.tungph7.learnpostgres.feature.health.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.tungph7.learnpostgres.common.dto.ApiResponse;
import com.tungph7.learnpostgres.feature.health.dto.HealthResponse;
import com.tungph7.learnpostgres.feature.health.service.HealthService;

class HealthControllerTest {

  @Test
  void health_returns_ok_wrapper_with_service_response() {
    HealthService service = mock(HealthService.class);
    HealthResponse health =
        HealthResponse.builder()
            .status("UP")
            .application("app")
            .version("1.0.0")
            .profile("dev")
            .javaVersion("21")
            .uptimeSeconds(42L)
            .checkedAt(Instant.now())
            .build();
    when(service.getHealth()).thenReturn(health);

    HealthController controller = new HealthController(service);

    ApiResponse<HealthResponse> resp = controller.health();

    assertThat(resp.success()).isTrue();
    assertThat(resp.data()).isSameAs(health);
  }
}
