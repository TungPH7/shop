# 01 — Project Structure

> **Status:** Active &nbsp;|&nbsp; **Version:** v1.0.0 &nbsp;|&nbsp; **Last updated:** 2026-05-21

Layout package + file organization. Apply cho **mọi feature mới**.

## Quick reference

|   ID   |  Severity   |                                             Rule                                             |
|--------|-------------|----------------------------------------------------------------------------------------------|
| PS-001 | 🔴 MUST     | Top-level package theo **business feature**, không theo technical layer                      |
| PS-002 | 🔴 MUST     | Mỗi feature có sub-package: `controller`, `service`, `repository`, `domain`, `dto`, `mapper` |
| PS-003 | 🔴 MUST     | Cross-cutting concern ở `common/` — không scatter trong feature                              |
| PS-004 | 🟡 SHOULD   | Mỗi package có `package-info.java` với `@NullMarked`                                         |
| PS-005 | 🟡 SHOULD   | Class chỉ dùng trong 1 feature → **package-private** (không `public`)                        |
| PS-006 | 🟡 SHOULD   | Exception type feature-specific → `feature/X/error/`; global → `common/error/`               |
| PS-007 | 🟢 MAY      | Test class mirror cấu trúc main package                                                      |
| PS-008 | 🔴 MUST NOT | KHÔNG có class ở root package (trừ `*Application.java`)                                      |

---

## PS-001 — Package by feature

> 🔴 MUST — Top-level package organize theo business feature.

✅ Right:

```
com.tungph7.learnpostgres
├── LearnPostgresqlApiApplication.java
├── common/
└── feature/
    ├── product/
    ├── order/
    └── health/
```

❌ Wrong (package by layer):

```
com.tungph7.learnpostgres
├── controllers/
│   ├── ProductController.java
│   └── OrderController.java
├── services/
│   ├── ProductService.java
│   └── OrderService.java
└── repositories/
    ├── ProductRepository.java
    └── OrderRepository.java
```

---

## PS-002 — Layered sub-packages trong feature

> 🔴 MUST — Mỗi feature có sub-layer: `controller`, `service`, `repository`, `domain`, `dto`, `mapper`.

✅ Right:

```
feature/product/
├── controller/ProductController.java
├── service/ProductService.java
├── repository/ProductRepository.java
├── domain/Product.java           # JPA entity
├── dto/CreateProductRequest.java # record
├── dto/ProductResponse.java
├── mapper/ProductMapper.java     # MapStruct interface
└── package-info.java
```

❌ Wrong (flat trong feature):

```
feature/product/
├── ProductController.java
├── ProductService.java
├── Product.java
├── ProductRepository.java
└── CreateProductRequest.java
```

**Exception**: Nếu feature rất nhỏ (< 5 classes, ví dụ `feature/health/`), MAY flat. Khi grow ≥ 5 → refactor sub-packages.

---

## PS-003 — Common package cho cross-cutting

> 🔴 MUST — Cross-cutting concern (dùng bởi ≥ 2 features) đặt ở `common/`.

✅ Acceptable trong `common/`:
- `common/config/` — global Spring config (`JpaAuditingConfig`, `OpenApiConfig`)
- `common/domain/` — base entity, shared types (`BaseEntity`, `UuidV7`)
- `common/dto/` — wrapper chung (`ApiResponse`)
- `common/error/` — global exception + handler
- `common/logging/` — MDC, correlation
- `common/security/` — Security config + properties

❌ KHÔNG đặt vào `common/`:
- Entity feature-specific (`Product` → `feature/product/domain/`)
- DTO feature-specific
- Service business-specific

**Quy tắc**: Nếu chỉ 1 feature dùng → KHÔNG `common/`.

---

## PS-004 — package-info.java với @NullMarked

> 🟡 SHOULD — Mỗi sub-package (feature + common) có `package-info.java` với `@NullMarked`.

✅ Right:

```java
// feature/product/package-info.java
@NullMarked
package com.tungph7.learnpostgres.feature.product;

import org.jspecify.annotations.NullMarked;
```

→ Default tất cả type là `@NonNull`. Khi cần nullable, explicit `@Nullable`.

---

## PS-005 — Visibility: package-private default

> 🟡 SHOULD — Class chỉ dùng trong cùng package → package-private, không `public`.

✅ Right:

```java
// feature/product/service/ProductValidator.java
@Component
class ProductValidator { ... }  // package-private, chỉ ProductService trong cùng package gọi

// feature/product/service/ProductService.java
@Service
public class ProductService { ... }  // public — controller cần inject
```

❌ Wrong (over-public):

```java
@Component
public class ProductValidator { ... }  // ❌ public dù không có user ngoài package
```

**Lý do**: Hide implementation detail, refactor safer.

---

## PS-006 — Exception placement

> 🟡 SHOULD — Exception type feature-specific đặt ở `feature/X/error/`. Global ở `common/error/`.

✅ Right:

```
common/error/
├── BusinessException.java         # base
├── NotFoundException.java         # generic
├── ConflictException.java
└── ErrorCode.java

feature/order/error/
├── InsufficientStockException.java  # business cụ thể order
└── OrderStateException.java
```

**Quy tắc**: Nếu exception throw bởi ≥ 2 features → `common/`. Nếu chỉ 1 feature → `feature/X/error/`.

→ See: [08-error-handling.md](./08-error-handling.md)

---

## PS-007 — Test mirror structure

> 🟢 MAY — Test class đặt cùng package path với main class.

✅ Right:

```
src/main/java/com/tungph7/.../feature/product/service/ProductService.java
src/test/java/com/tungph7/.../feature/product/service/ProductServiceTest.java
```

**Integration test** có thể group:

```
src/test/java/com/tungph7/.../feature/product/integration/ProductIntegrationTest.java
src/test/java/com/tungph7/.../feature/product/ProductFixtures.java
```

---

## PS-008 — Root package empty (trừ Application)

> 🔴 MUST NOT — Class business logic không đặt ở root package.

✅ Right:

```
com.tungph7.learnpostgres/
├── LearnPostgresqlApiApplication.java   ← OK
├── common/...
└── feature/...
```

❌ Wrong:

```
com.tungph7.learnpostgres/
├── LearnPostgresqlApiApplication.java
├── Product.java                  ← ❌ business class ở root
├── Utils.java                    ← ❌
```

**Lý do**: `@SpringBootApplication` scan từ root → muốn config rõ scope, mọi business class ở `common/` hoặc `feature/`.

---

## File-level layout

Resources:

```
src/main/resources/
├── application.yml                      # Default config
├── application-local.yml                # Local dev override
├── application-prod.yml                 # Production override
├── application-test.yml                 # Test override
├── logback-spring.xml                   # Logging config
└── db/migration/                        # Flyway scripts
    ├── V1__initial_schema.sql
    ├── V2__add_product_category.sql
    └── R__refresh_views.sql             # Repeatable
```

Test resources:

```
src/test/resources/
├── application-test.yml
└── junit-platform.properties            # Parallel config
```

## Cấu trúc tham chiếu hiện tại

Dự án hiện tuân thủ PS-001 đến PS-003. Còn lại:

|               Rule                |             Trạng thái             |
|-----------------------------------|------------------------------------|
| PS-004 (package-info @NullMarked) | ⚠️ Mới có 1 file ở `common/error/` |
| PS-005 (package-private)          | ⚠️ Đa số `public`, có thể tighten  |
| PS-007 (test mirror)              | ✅                                  |
| PS-008 (root empty)               | ✅                                  |
