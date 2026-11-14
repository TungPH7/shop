package com.tungph7.learnpostgres.feature.product.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;
import com.tungph7.learnpostgres.feature.product.ProductFixtures;
import com.tungph7.learnpostgres.feature.product.dto.CreateProductRequest;
import com.tungph7.learnpostgres.feature.product.repository.ProductRepository;

import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
class ProductIntegrationTest extends AbstractContainerBaseTest {

  @Autowired MockMvc mockMvc;
  @Autowired ObjectMapper json;
  @Autowired ProductRepository repository;

  @AfterEach
  void cleanup() {
    // PG test container — no transactional rollback because SpringBootTest drives MockMvc, not the
    // test thread's transaction. Clear the table explicitly between tests.
    repository.deleteAll();
  }

  // ============================================================
  // Happy path
  // ============================================================

  @Test
  void POST_create_persists_to_database() throws Exception {
    CreateProductRequest req = ProductFixtures.validRequest("Postgres", "pg-uar");

    MvcResult result =
        mockMvc
            .perform(
                post("/api/products")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsBytes(req)))
            .andExpect(status().isCreated())
            .andExpect(header().exists("X-Correlation-Id"))
            .andExpect(jsonPath("$.id").exists())
            .andReturn();

    String location = result.getResponse().getHeader("Location");
    assertThat(location).contains("/api/products/");
    assertThat(repository.findAll()).hasSize(1);
    assertThat(repository.findBySlug("pg-uar")).isPresent();
  }

  @Test
  void GET_list_returns_all_products() throws Exception {
    repository.save(ProductFixtures.persistedEntity("a"));
    repository.save(ProductFixtures.persistedEntity("b"));

    mockMvc
        .perform(get("/api/products"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2));
  }

  // ============================================================
  // Error path — verify the body schema
  // ============================================================

  @Test
  void POST_with_invalid_body_returns_400_problem_with_correlation_id() throws Exception {
    String invalid = "{\"name\":\"\",\"slug\":\"x\",\"price\":1.00}";

    mockMvc
        .perform(post("/api/products").contentType(MediaType.APPLICATION_JSON).content(invalid))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
        .andExpect(jsonPath("$.type").exists())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.status").value(400))
        .andExpect(jsonPath("$.timestamp").exists())
        .andExpect(jsonPath("$.correlationId").exists())
        .andExpect(jsonPath("$.errors[0].field").value("name"));
  }

  @Test
  void GET_byId_unknown_returns_404_problem() throws Exception {
    UUID id = UUID.fromString("00000000-0000-7000-8000-000000000000");

    mockMvc
        .perform(get("/api/products/{id}", id))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("PRODUCT_NOT_FOUND"))
        .andExpect(jsonPath("$.instance").value("/api/products/" + id));
  }

  @Test
  void POST_duplicate_slug_returns_409_problem() throws Exception {
    repository.save(ProductFixtures.persistedEntity("dup"));

    CreateProductRequest req = ProductFixtures.validRequest("Other", "dup");

    mockMvc
        .perform(
            post("/api/products")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(req)))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("PRODUCT_SLUG_DUPLICATED"));
  }

  // ============================================================
  // CorrelationId propagation
  // ============================================================

  @Test
  void server_generates_correlation_id_when_client_omits_header() throws Exception {
    mockMvc
        .perform(get("/api/products"))
        .andExpect(status().isOk())
        .andExpect(header().exists("X-Correlation-Id"))
        .andExpect(
            header()
                .string(
                    "X-Correlation-Id",
                    org.hamcrest.Matchers.matchesRegex(
                        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")));
  }

  @Test
  void server_reuses_correlation_id_from_client_header() throws Exception {
    String upstream = "trace-from-upstream-001";

    mockMvc
        .perform(get("/api/products").header("X-Correlation-Id", upstream))
        .andExpect(status().isOk())
        .andExpect(header().string("X-Correlation-Id", upstream));
  }

  @Test
  void error_response_correlation_id_matches_response_header() throws Exception {
    UUID unknown = UUID.fromString("00000000-0000-7000-8000-000000000000");

    MvcResult result =
        mockMvc
            .perform(
                get("/api/products/{id}", unknown).header("X-Correlation-Id", "trace-error-001"))
            .andExpect(status().isNotFound())
            .andReturn();

    String headerId = result.getResponse().getHeader("X-Correlation-Id");
    String bodyId =
        json.readTree(result.getResponse().getContentAsString()).get("correlationId").asText();
    assertThat(headerId).isEqualTo("trace-error-001");
    assertThat(bodyId).isEqualTo(headerId);
  }

  @Test
  void invalid_correlation_id_is_dropped_and_regenerated() throws Exception {
    mockMvc
        .perform(get("/api/products").header("X-Correlation-Id", "<script>"))
        .andExpect(status().isOk())
        .andExpect(header().string("X-Correlation-Id", org.hamcrest.Matchers.not("<script>")));
  }
}
