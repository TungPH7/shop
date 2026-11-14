package com.tungph7.learnpostgres.feature.product.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.tungph7.learnpostgres.common.domain.BaseEntity;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.error.GlobalExceptionHandler;
import com.tungph7.learnpostgres.common.error.NotFoundException;
import com.tungph7.learnpostgres.common.error.ProblemDetailFactory;
import com.tungph7.learnpostgres.common.logging.LoggingProperties;
import com.tungph7.learnpostgres.common.security.TestSecurityConfig;
import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.dto.CreateProductRequest;
import com.tungph7.learnpostgres.feature.product.mapper.ProductMapper;
import com.tungph7.learnpostgres.feature.product.service.ProductService;

import tools.jackson.databind.ObjectMapper;

@WebMvcTest(ProductController.class)
@Import({TestSecurityConfig.class, GlobalExceptionHandler.class, ProblemDetailFactory.class})
@EnableConfigurationProperties(LoggingProperties.class)
class ProductControllerWebMvcTest {

  @Autowired MockMvc mockMvc;
  @Autowired ObjectMapper json;

  @MockitoBean ProductService service;

  /** The mapper is a MapStruct singleton — bind the real bean for this slice test. */
  @org.springframework.boot.test.context.TestConfiguration
  static class MapperConfig {
    @org.springframework.context.annotation.Bean
    ProductMapper productMapper() {
      return Mappers.getMapper(ProductMapper.class);
    }
  }

  @Test
  void POST_create_returns_201_and_location() throws Exception {
    CreateProductRequest req = new CreateProductRequest("X", "x", new BigDecimal("1.00"), null);
    UUID id = UUID.fromString("0193c1f4-7b9a-7a3c-8d2e-aa1c98dead00");
    Product saved = productWithId(id, "X", "x", new BigDecimal("1.00"));

    when(service.create(any(CreateProductRequest.class))).thenReturn(saved);

    mockMvc
        .perform(
            post("/api/products")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(req)))
        .andExpect(status().isCreated())
        .andExpect(
            header().string("Location", org.hamcrest.Matchers.endsWith("/api/products/" + id)))
        .andExpect(jsonPath("$.slug").value("x"));
  }

  @Test
  void POST_create_returns_400_problem_when_blank_name() throws Exception {
    String body = "{\"name\":\"\",\"slug\":\"x\",\"price\":1.00}";

    mockMvc
        .perform(post("/api/products").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
        .andExpect(jsonPath("$.code").value(ErrorCode.VALIDATION_FAILED.code()))
        .andExpect(jsonPath("$.errors[0].field").value("name"));
  }

  @Test
  void GET_byId_returns_404_problem_when_absent() throws Exception {
    UUID id = UUID.fromString("00000000-0000-7000-8000-000000000000");
    when(service.getById(id))
        .thenThrow(
            new NotFoundException(
                ErrorCode.PRODUCT_NOT_FOUND, "Product %s not found.".formatted(id)));

    mockMvc
        .perform(get("/api/products/{id}", id))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value(ErrorCode.PRODUCT_NOT_FOUND.code()))
        .andExpect(jsonPath("$.correlationId").exists());
  }

  @Test
  void GET_byId_returns_200_when_found() throws Exception {
    UUID id = UUID.fromString("0193c1f4-7b9a-7a3c-8d2e-aa1c98dead00");
    Product p = productWithId(id, "Hello", "hello", new BigDecimal("3.50"));
    when(service.getById(id)).thenReturn(p);

    mockMvc
        .perform(get("/api/products/{id}", id))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.slug").value("hello"))
        .andExpect(jsonPath("$.name").value("Hello"));
  }

  @Test
  void GET_list_returns_array_of_products() throws Exception {
    Product p1 =
        productWithId(
            UUID.fromString("0193c1f4-7b9a-7a3c-8d2e-aa1c98dead01"),
            "A",
            "a",
            new BigDecimal("1.00"));
    Product p2 =
        productWithId(
            UUID.fromString("0193c1f4-7b9a-7a3c-8d2e-aa1c98dead02"),
            "B",
            "b",
            new BigDecimal("2.00"));
    when(service.list()).thenReturn(List.of(p1, p2));

    mockMvc
        .perform(get("/api/products"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].slug").value("a"))
        .andExpect(jsonPath("$[1].slug").value("b"));
  }

  @Test
  void PUT_updatePrice_returns_200_with_updated_response() throws Exception {
    UUID id = UUID.fromString("0193c1f4-7b9a-7a3c-8d2e-aa1c98dead03");
    Product updated = productWithId(id, "X", "x", new BigDecimal("5.55"));
    when(service.updatePrice(eq(id), any(BigDecimal.class))).thenReturn(updated);

    mockMvc
        .perform(
            put("/api/products/{id}/price", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"price\":5.55}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.price").value(5.55));
  }

  @Test
  void PUT_bulkUpdatePrice_returns_count() throws Exception {
    when(service.bulkUpdatePriceBySlug(eq("x"), any(BigDecimal.class))).thenReturn(3);

    mockMvc
        .perform(
            put("/api/products/bulk-price/{slug}", "x")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"price\":7.77}"))
        .andExpect(status().isOk())
        .andExpect(content().string("3"));
  }

  @Test
  void DELETE_returns_204_when_present() throws Exception {
    UUID id = UUID.fromString("0193c1f4-7b9a-7a3c-8d2e-aa1c98dead04");
    doNothing().when(service).delete(id);

    mockMvc.perform(delete("/api/products/{id}", id)).andExpect(status().isNoContent());

    verify(service).delete(id);
  }

  @Test
  void DELETE_returns_404_when_absent() throws Exception {
    UUID id = UUID.fromString("0193c1f4-7b9a-7a3c-8d2e-aa1c98dead05");
    doThrow(
            new NotFoundException(
                ErrorCode.PRODUCT_NOT_FOUND, "Product %s not found.".formatted(id)))
        .when(service)
        .delete(id);

    mockMvc
        .perform(delete("/api/products/{id}", id))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value(ErrorCode.PRODUCT_NOT_FOUND.code()));
  }

  @Test
  void GET_byId_returns_400_when_invalid_uuid() throws Exception {
    mockMvc
        .perform(get("/api/products/{id}", "not-a-uuid"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value(ErrorCode.INVALID_PARAMETER.code()));
  }

  /** Helper: assigns id via reflection (BaseEntity.setId is package-private). */
  private static Product productWithId(UUID id, String name, String slug, BigDecimal price) {
    Product p = new Product(name, slug, price, null);
    try {
      Field f = BaseEntity.class.getDeclaredField("id");
      f.setAccessible(true);
      f.set(p, id);
    } catch (NoSuchFieldException | IllegalAccessException e) {
      throw new RuntimeException(e);
    }
    return p;
  }
}
