package com.tungph7.learnpostgres.common.logging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesRegex;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;

import tools.jackson.databind.ObjectMapper;

/**
 * {@link CorrelationIdFilter} in the whole application: it keeps a valid id the client sent,
 * generates a UUID when there is none, puts the same id in the body of an error, and drops an id
 * with unsafe characters. Each test reads the admin product list, which only reads, so the tests
 * leave no data behind.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CorrelationIdFilterIntegrationTest extends AbstractContainerBaseTest {

  private static final String HEADER = "X-Correlation-Id";
  private static final String URL = "/api/admin/products";
  private static final String UUID_PATTERN =
      "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

  @Autowired MockMvc mockMvc;
  @Autowired ObjectMapper json;

  @Test
  void request_withAValidId_getsTheSameIdBack() throws Exception {
    String upstream = "trace-from-upstream-001";

    mockMvc
        .perform(get(URL).header(HEADER, upstream))
        .andExpect(status().isOk())
        .andExpect(header().string(HEADER, upstream));
  }

  @Test
  void request_withoutAnId_getsAGeneratedUuid() throws Exception {
    mockMvc
        .perform(get(URL))
        .andExpect(status().isOk())
        .andExpect(header().string(HEADER, matchesRegex(UUID_PATTERN)));
  }

  @Test
  void errorResponse_hasTheIdOfItsHeaderInItsBody() throws Exception {
    MvcResult result =
        mockMvc
            .perform(get(URL).param("limit", "0").header(HEADER, "trace-error-001"))
            .andExpect(status().isBadRequest())
            .andReturn();

    String headerId = result.getResponse().getHeader(HEADER);
    String bodyId =
        json.readTree(result.getResponse().getContentAsString()).get("correlationId").asString();
    assertThat(headerId).isEqualTo("trace-error-001");
    assertThat(bodyId).isEqualTo(headerId);
  }

  @Test
  void request_withAnUnsafeId_getsAGeneratedUuidInstead() throws Exception {
    mockMvc
        .perform(get(URL).header(HEADER, "<script>"))
        .andExpect(status().isOk())
        .andExpect(header().string(HEADER, not("<script>")))
        .andExpect(header().string(HEADER, matchesRegex(UUID_PATTERN)));
  }
}
