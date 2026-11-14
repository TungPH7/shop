# 02 — Naming Conventions

> **Status:** Active &nbsp;|&nbsp; **Version:** v1.0.0 &nbsp;|&nbsp; **Last updated:** 2026-05-21

Naming cho package, class, method, field, file, test, branch, commit.

## Quick reference

|              Element              |          Convention           |                 Example                 |
|-----------------------------------|-------------------------------|-----------------------------------------|
| Package                           | `lowercase`, không underscore | `feature.product.service`               |
| Class / Record / Enum / Interface | `UpperCamelCase`              | `ProductService`, `OrderStatus`         |
| Annotation                        | `UpperCamelCase`              | `@JsonProperty`                         |
| Method                            | `lowerCamelCase`, verb        | `findById`, `isActive`                  |
| Constant (`static final`)         | `UPPER_SNAKE_CASE`            | `MAX_RETRY_COUNT`                       |
| Field (non-constant)              | `lowerCamelCase`              | `productRepository`                     |
| Parameter                         | `lowerCamelCase`              | `productId`                             |
| Local variable                    | `lowerCamelCase`              | `result`                                |
| Type parameter                    | Single letter hoặc `XxxT`     | `T`, `K`, `RequestT`                    |
| File                              | Same as top-level class       | `ProductService.java`                   |
| Test method                       | `subject_condition_expected`  | `findById_whenNotExists_throws404`      |
| Branch                            | `<type>/<kebab>`              | `feature/bulk-import`, `fix/null-price` |
| Commit                            | Conventional Commits          | `feat(product): add bulk import`        |

---

## Rules

|   ID   |  Severity   |                                       Rule                                        |
|--------|-------------|-----------------------------------------------------------------------------------|
| NM-001 | 🔴 MUST     | Package name **lowercase**, single-word per segment, không underscore             |
| NM-002 | 🔴 MUST     | Class/Record/Enum **UpperCamelCase** noun hoặc noun phrase                        |
| NM-003 | 🔴 MUST     | Method **lowerCamelCase**, bắt đầu bằng verb                                      |
| NM-004 | 🔴 MUST     | Constant `static final` deeply immutable → **UPPER_SNAKE_CASE**                   |
| NM-005 | 🟢 MAY      | `log` field (SLF4J/Lombok) lowercase được phép                                    |
| NM-006 | 🟡 SHOULD   | Boolean field/method prefix `is`/`has`/`can`/`should`                             |
| NM-007 | 🔴 MUST     | Interface không prefix `I` (no `IProductRepository`)                              |
| NM-008 | 🟡 SHOULD   | Abstract class **MAY** prefix `Abstract` khi base cho framework                   |
| NM-009 | 🔴 MUST NOT | Class/method name dùng abbreviation không phổ biến                                |
| NM-010 | 🟡 SHOULD   | Test class suffix `Test` (unit), `IT` hoặc `IntegrationTest` (integration)        |
| NM-011 | 🟡 SHOULD   | Test method dùng BDD-style: `<subject>_<condition>_<expected>`                    |
| NM-012 | 🔴 MUST     | Branch prefix: `feature/`, `fix/`, `refactor/`, `docs/`, `chore/`                 |
| NM-013 | 🔴 MUST     | Commit theo Conventional Commits — see [11-git-workflow.md](./11-git-workflow.md) |
| NM-014 | 🔴 MUST     | DTO record suffix theo intent: `Request`, `Response`, `Summary`, `Detail`         |
| NM-015 | 🟡 SHOULD   | Exception class suffix `Exception`                                                |
| NM-016 | 🟡 SHOULD   | Config bean class suffix `Config` hoặc `Configuration`                            |

---

## NM-001 — Package naming

> 🔴 MUST — Package **lowercase**, không underscore, không CamelCase.

✅ Right:

```java
com.tungph7.learnpostgres.feature.product.service
com.tungph7.learnpostgres.common.error
```

❌ Wrong:

```java
com.tungph7.learnPostgres.feature.Product.Service     // ❌ CamelCase
com.tungph7.learn_postgres.feature_product.service    // ❌ underscore
```

---

## NM-002 — Class naming

> 🔴 MUST — Class/Record/Enum/Interface **UpperCamelCase**, là noun.

✅ Right:

```java
public class ProductService { }
public record CreateProductRequest(...) { }
public enum OrderStatus { ... }
public interface PaymentGateway { }
```

❌ Wrong:

```java
public class productService { }       // ❌ camelCase
public class Product_Service { }      // ❌ underscore
public class ProductSrv { }           // ❌ abbreviation
public class Productservice { }       // ❌ flat case
```

---

## NM-003 — Method naming

> 🔴 MUST — Method **lowerCamelCase**, bắt đầu bằng verb.

✅ Right:

```java
Product findById(UUID id)
void deactivate(UUID id)
boolean isActive()
List<Product> searchByCategory(String category)
```

❌ Wrong:

```java
Product GetById(UUID id)        // ❌ PascalCase
Product product_by_id(UUID id)  // ❌ snake_case
Product productById(UUID id)    // ❌ không bắt đầu verb
```

**Exception**: Test method có thể dùng `_` (NM-011).

---

## NM-004 — Constant naming

> 🔴 MUST — `static final` value deeply immutable → **UPPER_SNAKE_CASE**.

✅ Right:

```java
private static final int MAX_RETRY_COUNT = 3;
private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(30);
private static final String API_VERSION_HEADER = "X-API-Version";
```

❌ Wrong:

```java
private static final int maxRetryCount = 3;       // ❌ camelCase
private static final List<String> ALLOWED_TYPES;  // ❌ mutable List → không phải constant
```

**Quy tắc deeply immutable**: primitive, String, enum value, immutable collection (`List.of`, `Set.of`), record không reference mutable.

---

## NM-005 — Logger field exception

> 🟢 MAY — Logger field tên `log` (SLF4J/Lombok convention) được phép lowercase.

✅ Right:

```java
@Slf4j
class ProductService {
    public void create(...) {
        log.info("Creating product {}", id);
    }
}

// Manual equivalent
private static final Logger log = LoggerFactory.getLogger(ProductService.class);
```

→ Checkstyle config đã allow exception này.

---

## NM-006 — Boolean naming

> 🟡 SHOULD — Boolean field/method prefix với `is`, `has`, `can`, `should`, `was`.

✅ Right:

```java
boolean isActive
boolean hasStock
boolean canRefund
boolean shouldRetry
boolean wasProcessed
```

❌ Wrong:

```java
boolean active        // ❌ noun-like
boolean status        // ❌ vague
boolean flag          // ❌ meaningless
```

**Lưu ý JPA entity**: Field `boolean active` OK ở DB column, nhưng getter sinh ra `isActive()`. Lombok @Getter handle đúng.

---

## NM-007 — Interface không prefix I

> 🔴 MUST NOT — Interface KHÔNG có prefix `I`.

✅ Right:

```java
public interface PaymentGateway { }
public interface ProductRepository extends JpaRepository<...> { }
```

❌ Wrong:

```java
public interface IPaymentGateway { }    // ❌ Hungarian notation
public interface IProductRepository { } // ❌
```

**Lý do**: Java convention từ Sun/Oracle là không prefix. Hungarian notation thuộc C#/COM.

---

## NM-008 — Abstract class prefix

> 🟡 SHOULD — Abstract class base cho framework hoặc inheritance hierarchy **MAY** prefix `Abstract`.

✅ Right:

```java
public abstract class AbstractContainerBaseTest { ... }
public abstract class BaseEntity { ... }   // hoặc "Base" prefix
```

❌ Anti-pattern:

```java
public abstract class ProductService { ... }  // ❌ tên không hint abstract
```

**Quy tắc thực dụng**: Prefix `Abstract` chỉ khi base class có > 1 concrete subclass dự kiến. Một-shot template method → không prefix.

---

## NM-009 — Tránh abbreviation lạ

> 🔴 MUST NOT — Abbreviation không phổ biến trong domain.

✅ Phổ biến (OK):
- `id`, `url`, `uri`, `http`, `json`, `xml`, `sql`, `dto`, `db`, `api`

❌ Tránh:
- `prodSrv` (productService), `cstmr` (customer), `mgr` (manager), `mgmt`

**Lưu ý CamelCase với acronym**: Theo Google Style — acronym ≥ 3 ký tự xử lý như word.

✅ Right:

```java
class HttpRequest { }      // không HTTPRequest
class XmlParser { }        // không XMLParser
String userId;             // không userID
String httpUrl;            // không HTTPURL
```

---

## NM-010 — Test class suffix

> 🟡 SHOULD — Test class suffix theo loại:
> - `*Test` — unit test
> - `*WebMvcTest` — controller slice
> - `*DataJpaTest` — repository slice
> - `*IntegrationTest` (hoặc `*IT`) — full integration

✅ Right:

```java
ProductServiceTest.java                  // unit
ProductControllerWebMvcTest.java         // slice
ProductRepositoryDataJpaTest.java        // slice
ProductIntegrationTest.java              // integration
```

**Lưu ý CI**: Maven Surefire chạy `*Test` mặc định, Failsafe chạy `*IT`. Convention project hiện dùng `*IntegrationTest` cho integration — đúng cũng OK nếu pom config đúng.

---

## NM-011 — Test method naming

> 🟡 SHOULD — Test method BDD-style: `<subject>_<condition>_<expected>`.

✅ Right:

```java
@Test
void findById_whenNotExists_throwsNotFoundException()

@Test
void create_withValidRequest_returns201AndLocationHeader()

@Test
void updatePrice_withNegativeValue_returns400()
```

❌ Wrong:

```java
@Test
void test1()                    // ❌ meaningless

@Test
void testFindById()             // ❌ không cho biết condition + expected

@Test
void shouldFind()               // ❌ thiếu subject + condition
```

**Alternative**: `@DisplayName` cho human-readable, kết hợp với method name technical:

```java
@Test
@DisplayName("Returns 404 ProblemDetail when product doesn't exist")
void findById_whenNotExists_throwsNotFoundException() { ... }
```

---

## NM-012 — Branch naming

> 🔴 MUST — Branch theo format `<type>/<kebab-description>`.

✅ Right:

```
feature/bulk-import
feature/api-versioning
fix/null-price-handler
refactor/extract-validator
docs/coding-conventions
chore/upgrade-spring-boot-4.0.7
ci/cache-maven-deps
```

❌ Wrong:

```
my-feature                 // ❌ thiếu type
feature_bulk_import        // ❌ underscore
FeatureBulkImport          // ❌ CamelCase
tungph7/work               // ❌ author prefix
```

**Types allow** (giống commit type):
`feature`, `fix`, `refactor`, `docs`, `chore`, `test`, `ci`, `build`, `perf`, `style`.

---

## NM-013 — Commit message

→ See [11-git-workflow.md](./11-git-workflow.md)

---

## NM-014 — DTO record suffix

> 🔴 MUST — Record dùng làm DTO suffix theo intent.

|    Suffix    |            Use case             |
|--------------|---------------------------------|
| `Request`    | Input từ client (POST/PUT body) |
| `Response`   | Output trả client               |
| `Summary`    | Compact view (list endpoint)    |
| `Detail`     | Full view (single endpoint)     |
| `Command`    | Internal command (CQRS-lite)    |
| `Event`      | Domain event                    |
| `Projection` | JPA constructor expression      |

✅ Right:

```java
public record CreateProductRequest(...) {}
public record ProductResponse(...) {}
public record ProductSummary(UUID id, String name) {}   // for list view
public record ProductDetail(UUID id, String name, ...) {}  // for single view
```

❌ Wrong:

```java
public record ProductDto(...) {}       // ❌ DTO vague
public record Product(...) {}          // ❌ trùng entity name
public record ProductData(...) {}      // ❌ Data vague
```

---

## NM-015 — Exception class suffix

> 🟡 SHOULD — Exception class suffix `Exception`.

✅ Right:

```java
class NotFoundException extends BusinessException { }
class InsufficientStockException extends BusinessException { }
class PaymentFailedException extends BusinessException { }
```

❌ Wrong:

```java
class NotFoundError extends RuntimeException { }   // ❌ "Error" reserved cho JVM error
class ProductNotFound extends Exception { }         // ❌ thiếu suffix
```

---

## NM-016 — Config bean class suffix

> 🟡 SHOULD — Class `@Configuration` suffix `Config` hoặc `Configuration`.

✅ Right:

```java
@Configuration
class JpaAuditingConfig { }

@Configuration
@EnableConfigurationProperties(SecurityProperties.class)
class SecurityConfig { }
```

`@ConfigurationProperties` record suffix `Properties`:

```java
@ConfigurationProperties("app.security")
public record SecurityProperties(...) {}
```

---

## See also

- Google Java Style Guide: https://google.github.io/styleguide/javaguide.html#s5-naming
