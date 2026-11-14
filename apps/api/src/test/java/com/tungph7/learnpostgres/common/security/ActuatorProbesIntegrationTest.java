package com.tungph7.learnpostgres.common.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;

/**
 * The HEALTHCHECK of the Dockerfile calls the liveness probe without credentials, so the probes
 * must be open like /actuator/health; the other actuator endpoints stay closed (SHOP-5).
 */
@SpringBootTest
@AutoConfigureMockMvc
class ActuatorProbesIntegrationTest extends AbstractContainerBaseTest {

  @Autowired MockMvc mockMvc;

  @Test
  void liveness_probe_answers_without_credentials() throws Exception {
    mockMvc
        .perform(get("/actuator/health/liveness"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("UP"));
  }

  @Test
  void readiness_probe_answers_without_credentials() throws Exception {
    mockMvc
        .perform(get("/actuator/health/readiness"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("UP"));
  }

  @Test
  void other_actuator_endpoints_stay_closed() throws Exception {
    mockMvc.perform(get("/actuator/flyway")).andExpect(status().isUnauthorized());
  }
}
