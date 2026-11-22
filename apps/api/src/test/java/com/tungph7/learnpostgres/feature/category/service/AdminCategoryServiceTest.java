package com.tungph7.learnpostgres.feature.category.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import jakarta.persistence.EntityManager;

import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

import com.tungph7.learnpostgres.common.error.BusinessException;
import com.tungph7.learnpostgres.common.error.ConflictException;
import com.tungph7.learnpostgres.common.error.ErrorCode;
import com.tungph7.learnpostgres.common.logging.CorrelationContext;
import com.tungph7.learnpostgres.feature.category.domain.Category;
import com.tungph7.learnpostgres.feature.category.dto.CreateCategoryRequest;
import com.tungph7.learnpostgres.feature.category.repository.CategoryQueryRepository;
import com.tungph7.learnpostgres.feature.category.repository.CategoryRepository;

/**
 * What {@link AdminCategoryService} does when the database refuses an insert, which the integration
 * tests cannot make happen on purpose: a generated slug taken at every try, every suffix taken, and
 * a constraint other than the slug.
 */
class AdminCategoryServiceTest {

  private CategoryRepository repository;
  private AdminCategoryService service;

  @BeforeEach
  void setUp() {
    repository = mock(CategoryRepository.class);
    CorrelationContext correlation = mock(CorrelationContext.class);
    when(correlation.currentId()).thenReturn(Optional.empty());
    service =
        new AdminCategoryService(
            repository,
            mock(CategoryQueryRepository.class),
            correlation,
            mock(EntityManager.class));
  }

  @Test
  void create_whenTheGeneratedSlugIsTakenAtEveryTry_stopsAfterThreeRetriesWith409Slug() {
    when(repository.saveAndFlush(any(Category.class)))
        .thenThrow(violation("categories_slug_unique"));

    assertThatThrownBy(() -> service.create(new CreateCategoryRequest("Áo", null, null)))
        .isInstanceOf(ConflictException.class)
        .extracting(e -> ((BusinessException) e).getCode())
        .isEqualTo(ErrorCode.CATEGORY_SLUG_DUPLICATED);

    verify(repository, times(1 + AdminCategoryService.MAX_SLUG_RETRIES))
        .saveAndFlush(any(Category.class));
  }

  @Test
  void create_whenTheNameIsTakenAtTheInsert_returns409NameWithoutRetry() {
    when(repository.saveAndFlush(any(Category.class)))
        .thenThrow(violation("categories_name_unique"));

    assertThatThrownBy(() -> service.create(new CreateCategoryRequest("Áo", null, null)))
        .extracting(e -> ((BusinessException) e).getCode())
        .isEqualTo(ErrorCode.CATEGORY_NAME_DUPLICATED);

    verify(repository, times(1)).saveAndFlush(any(Category.class));
  }

  @Test
  void create_withATypedSlug_whenTheNameIsTakenAtTheInsert_returns409Name() {
    when(repository.saveAndFlush(any(Category.class)))
        .thenThrow(violation("categories_name_unique"));

    assertThatThrownBy(() -> service.create(new CreateCategoryRequest("Áo", "ao", null)))
        .extracting(e -> ((BusinessException) e).getCode())
        .isEqualTo(ErrorCode.CATEGORY_NAME_DUPLICATED);
  }

  @Test
  void create_whenAnotherConstraintFails_passesTheErrorOn() {
    DataIntegrityViolationException other = violation("categories_slug_format");
    when(repository.saveAndFlush(any(Category.class))).thenThrow(other);

    assertThatThrownBy(() -> service.create(new CreateCategoryRequest("Áo", null, null)))
        .isSameAs(other);
    assertThatThrownBy(() -> service.create(new CreateCategoryRequest("Áo", "ao", null)))
        .isSameAs(other);
  }

  @Test
  void create_withoutSlug_whenEveryNumberUpToTheLimitIsTaken_returns409SlugAndSavesNothing() {
    List<String> taken = new ArrayList<>(List.of("ao"));
    for (int number = 2; number <= AdminCategoryService.MAX_SLUG_NUMBER; number++) {
      taken.add("ao-" + number);
    }
    when(repository.findSlugsAmong(any(String[].class))).thenReturn(taken);

    assertThatThrownBy(() -> service.create(new CreateCategoryRequest("Áo", null, null)))
        .extracting(e -> ((BusinessException) e).getCode())
        .isEqualTo(ErrorCode.CATEGORY_SLUG_DUPLICATED);

    verify(repository, never()).saveAndFlush(any());
  }

  @Test
  void create_withoutSlug_asksForTheBaseAndItsNumberedSlugsInOneQuery() {
    when(repository.findSlugsAmong(any(String[].class))).thenReturn(List.of("ao", "ao-2"));
    when(repository.saveAndFlush(any(Category.class)))
        .thenAnswer(
            call -> {
              Category category = call.getArgument(0);
              ReflectionTestUtils.setField(category, "version", 0L);
              return category;
            });

    service.create(new CreateCategoryRequest("Áo", null, null));

    ArgumentCaptor<String[]> asked = ArgumentCaptor.forClass(String[].class);
    verify(repository, times(1)).findSlugsAmong(asked.capture());
    assertThat(asked.getValue()).hasSize(AdminCategoryService.MAX_SLUG_NUMBER);
    assertThat(asked.getValue()[0]).isEqualTo("ao");
    ArgumentCaptor<Category> saved = ArgumentCaptor.forClass(Category.class);
    verify(repository).saveAndFlush(saved.capture());
    assertThat(saved.getValue().getSlug()).isEqualTo("ao-3");
    verify(repository, never()).existsBySlug(anyString());
  }

  private static DataIntegrityViolationException violation(String constraint) {
    return new DataIntegrityViolationException(
        "could not execute statement",
        new ConstraintViolationException(
            "could not execute statement", new SQLException("duplicate"), constraint));
  }
}
