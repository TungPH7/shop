package com.tungph7.learnpostgres.common.error;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;

@SpringBootTest
@AutoConfigureMockMvc
class ProblemDetailIntegrationTest extends AbstractContainerBaseTest {

  @Autowired MockMvc mockMvc;

  @Test
  void unknown_path_returns_404_with_full_problem_body() throws Exception {
    mockMvc
        .perform(get("/api/typo-not-exist"))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
        .andExpect(jsonPath("$.type").exists())
        .andExpect(jsonPath("$.title").exists())
        .andExpect(jsonPath("$.status").value(404))
        .andExpect(jsonPath("$.detail").exists())
        .andExpect(jsonPath("$.instance").exists())
        .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"))
        .andExpect(jsonPath("$.timestamp").exists())
        .andExpect(jsonPath("$.correlationId").exists());
  }

  @Test
  void wrong_method_returns_405_with_problem_body() throws Exception {
    mockMvc
        .perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                "/api/products"))
        .andExpect(status().isMethodNotAllowed())
        .andExpect(jsonPath("$.code").value("METHOD_NOT_SUPPORTED"));
  }
}
