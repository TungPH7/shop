package com.tungph7.learnpostgres.feature.product.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.tungph7.learnpostgres.common.error.ConflictException;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.error.NotFoundException;
import com.tungph7.learnpostgres.feature.product.domain.Product;
import com.tungph7.learnpostgres.feature.product.dto.CreateProductRequest;
import com.tungph7.learnpostgres.feature.product.mapper.ProductMapper;
import com.tungph7.learnpostgres.feature.product.repository.ProductRepository;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

  @Mock ProductRepository repository;
  @Mock ProductMapper mapper;
  @InjectMocks ProductService service;

  @Test
  void getById_returns_product_when_present() {
    UUID id = UUID.randomUUID();
    Product p = new Product("X", "x", new BigDecimal("1.00"), null);
    when(repository.findById(id)).thenReturn(Optional.of(p));

    Product got = service.getById(id);

    assertThat(got).isSameAs(p);
  }

  @Test
  void getById_throws_NotFoundException_when_absent() {
    UUID id = UUID.randomUUID();
    when(repository.findById(id)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.getById(id))
        .isInstanceOf(NotFoundException.class)
        .hasFieldOrPropertyWithValue("code", ErrorCode.PRODUCT_NOT_FOUND);
  }

  @Test
  void getBySlug_returns_product_when_present() {
    Product p = new Product("X", "x", new BigDecimal("1.00"), null);
    when(repository.findBySlug("x")).thenReturn(Optional.of(p));

    Product got = service.getBySlug("x");

    assertThat(got).isSameAs(p);
  }

  @Test
  void getBySlug_throws_NotFoundException_when_absent() {
    when(repository.findBySlug("missing")).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.getBySlug("missing"))
        .isInstanceOf(NotFoundException.class)
        .hasFieldOrPropertyWithValue("code", ErrorCode.PRODUCT_NOT_FOUND);
  }

  @Test
  void list_returns_repository_findAll() {
    Product p1 = new Product("X", "x", new BigDecimal("1.00"), null);
    Product p2 = new Product("Y", "y", new BigDecimal("2.00"), null);
    when(repository.findAll()).thenReturn(List.of(p1, p2));

    List<Product> got = service.list();

    assertThat(got).hasSize(2).containsExactly(p1, p2);
  }

  @Test
  void create_persists_when_slug_unique() {
    CreateProductRequest req = new CreateProductRequest("X", "x", new BigDecimal("1.00"), null);
    Product entity = new Product("X", "x", new BigDecimal("1.00"), null);

    when(repository.findBySlug("x")).thenReturn(Optional.empty());
    when(mapper.toEntity(req)).thenReturn(entity);
    when(repository.save(entity)).thenReturn(entity);

    Product created = service.create(req);

    assertThat(created).isSameAs(entity);
    assertThat(created.getSlug()).isEqualTo("x");
  }

  @Test
  void create_throws_ConflictException_when_slug_exists() {
    CreateProductRequest req = new CreateProductRequest("X", "x", new BigDecimal("1.00"), null);
    Product existing = new Product("Y", "x", new BigDecimal("2.00"), null);
    when(repository.findBySlug("x")).thenReturn(Optional.of(existing));

    assertThatThrownBy(() -> service.create(req))
        .isInstanceOf(ConflictException.class)
        .hasFieldOrPropertyWithValue("code", ErrorCode.PRODUCT_SLUG_DUPLICATED);
    verify(repository, never()).save(org.mockito.ArgumentMatchers.any());
  }

  @Test
  void updatePrice_updates_price_and_saves() {
    UUID id = UUID.randomUUID();
    Product existing = new Product("X", "x", new BigDecimal("1.00"), null);
    when(repository.findById(id)).thenReturn(Optional.of(existing));
    when(repository.save(existing)).thenReturn(existing);

    Product updated = service.updatePrice(id, new BigDecimal("9.99"));

    assertThat(updated.getPrice()).isEqualByComparingTo("9.99");
  }

  @Test
  void updatePrice_throws_NotFoundException_when_absent() {
    UUID id = UUID.randomUUID();
    when(repository.findById(id)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.updatePrice(id, new BigDecimal("9.99")))
        .isInstanceOf(NotFoundException.class)
        .hasFieldOrPropertyWithValue("code", ErrorCode.PRODUCT_NOT_FOUND);
  }

  @Test
  void bulkUpdatePriceBySlug_returns_count_when_rows_updated() {
    when(repository.bulkUpdatePriceBySlug("x", new BigDecimal("3.00"))).thenReturn(2);

    int updated = service.bulkUpdatePriceBySlug("x", new BigDecimal("3.00"));

    assertThat(updated).isEqualTo(2);
  }

  @Test
  void bulkUpdatePriceBySlug_throws_NotFoundException_when_zero_updated() {
    when(repository.bulkUpdatePriceBySlug("missing", new BigDecimal("3.00"))).thenReturn(0);

    assertThatThrownBy(() -> service.bulkUpdatePriceBySlug("missing", new BigDecimal("3.00")))
        .isInstanceOf(NotFoundException.class)
        .hasFieldOrPropertyWithValue("code", ErrorCode.PRODUCT_NOT_FOUND);
  }

  @Test
  void delete_calls_deleteById_when_exists() {
    UUID id = UUID.randomUUID();
    when(repository.existsById(id)).thenReturn(true);

    service.delete(id);

    verify(repository).deleteById(id);
  }

  @Test
  void delete_throws_NotFoundException_when_absent() {
    UUID id = UUID.randomUUID();
    when(repository.existsById(id)).thenReturn(false);

    assertThatThrownBy(() -> service.delete(id))
        .isInstanceOf(NotFoundException.class)
        .hasFieldOrPropertyWithValue("code", ErrorCode.PRODUCT_NOT_FOUND);
    verify(repository, never()).deleteById(id);
  }
}
