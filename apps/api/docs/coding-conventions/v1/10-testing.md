# 10 — Testing

> **Status:** Active &nbsp;|&nbsp; **Version:** v1.0.0 &nbsp;|&nbsp; **Last updated:** 2026-05-21

Test conventions: pyramid, JUnit 5, Testcontainers, AssertJ, slice tests.

## Quick reference

|    Layer    |                Tool                | % of total |  Speed  |
|-------------|------------------------------------|------------|---------|
| Unit        | JUnit 5 + Mockito + AssertJ        | 50–60%     | < 100ms |
| Slice       | `@WebMvcTest`, `@DataJpaTest`      | 20–30%     | 1–5s    |
| Integration | `@SpringBootTest` + Testcontainers | 15–25%     | 10–30s  |
| E2E         | Postman/Playwright                 | 5–10%      | minutes |

---

## Rules

|   ID   |  Severity   |                                         Rule                                         |
|--------|-------------|--------------------------------------------------------------------------------------|
| TS-001 | 🔴 MUST     | JUnit 5 (Jupiter) only. KHÔNG mix JUnit 4                                            |
| TS-002 | 🔴 MUST     | AssertJ cho assertion mới. KHÔNG Hamcrest cho code mới                               |
| TS-003 | 🔴 MUST     | Mockito qua `@ExtendWith(MockitoExtension.class)`, KHÔNG JUnit 4 runner              |
| TS-004 | 🔴 MUST     | Integration test với DB dùng Testcontainers, KHÔNG H2                                |
| TS-005 | 🔴 MUST     | `@MockitoBean` thay `@MockBean` (deprecated trong Spring Boot 4)                     |
| TS-006 | 🔴 MUST     | Slice test khi test 1 layer (`@WebMvcTest`, `@DataJpaTest`), KHÔNG `@SpringBootTest` |
| TS-007 | 🔴 MUST     | Test class suffix: `*Test`, `*WebMvcTest`, `*DataJpaTest`, `*IntegrationTest`        |
| TS-008 | 🟡 SHOULD   | Test method BDD-style: `subject_condition_expected`                                  |
| TS-009 | 🟡 SHOULD   | Fixture trong `*Fixtures.java` static factory                                        |
| TS-010 | 🔴 MUST NOT | `Thread.sleep` để chờ async — dùng Awaitility                                        |
| TS-011 | 🟡 SHOULD   | `@ServiceConnection` cho Testcontainers (Spring Boot 3.1+)                           |
| TS-012 | 🟡 SHOULD   | `AbstractContainerBaseTest` share container giữa test classes                        |
| TS-013 | 🔴 MUST     | JaCoCo coverage gate pass: bundle 70%, service 85%, controller 80%                   |
| TS-014 | 🔴 MUST NOT | Assertion-free test để bump coverage                                                 |
| TS-015 | 🟢 MAY      | Parallel test execution (`junit-platform.properties`)                                |

---

## TS-001 — JUnit 5 only

> 🔴 MUST — JUnit 5 (Jupiter). KHÔNG mix `org.junit.Test` (JUnit 4).

✅ Right:

```java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;

class ProductServiceTest {

    @BeforeEach
    void setUp() { ... }

    @Test
    void findById_whenExists_returnsProduct() { ... }
}
```

❌ Wrong:

```java
import org.junit.Test;                  // ❌ JUnit 4
import org.junit.jupiter.api.Test;       // mix → confusion
```

---

## TS-002 — AssertJ

> 🔴 MUST — AssertJ cho code mới. Legacy Hamcrest test giữ nguyên, không migrate forced.

✅ Right:

```java
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

assertThat(product.name()).isEqualTo("Coffee");
assertThat(products).hasSize(3).extracting(Product::name).contains("Coffee");

assertThatThrownBy(() -> service.findById(unknownId))
    .isInstanceOf(NotFoundException.class)
    .hasMessageContaining("not found");
```

❌ Wrong (Hamcrest cho code mới):

```java
assertThat(product.name(), is(equalTo("Coffee")));
assertThat(products, hasSize(3));
```

**Lý do**: AssertJ fluent, IDE autocomplete, error message clearer.

---

## TS-003 — MockitoExtension

> 🔴 MUST — Mockito qua `@ExtendWith(MockitoExtension.class)`.

✅ Right:

```java
@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock ProductRepository repository;
    @Mock ProductMapper mapper;
    @InjectMocks ProductService service;

    @Test
    void findById_whenExists_returnsProduct() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.of(ProductFixtures.aProduct(id)));

        ProductResponse result = service.findById(id);

        assertThat(result.id()).isEqualTo(id);
        verify(repository).findById(id);
    }
}
```

❌ Wrong:

```java
@RunWith(MockitoJUnitRunner.class)   // ❌ JUnit 4 runner
class ProductServiceTest { ... }
```

---

## TS-004 — Testcontainers cho DB

> 🔴 MUST — Integration test với database dùng Testcontainers PostgreSQL, KHÔNG H2/in-memory.

✅ Right:

```java
@Testcontainers
public abstract class AbstractContainerBaseTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:16-alpine")
            .withReuse(true);
}

@SpringBootTest
class ProductIntegrationTest extends AbstractContainerBaseTest {
    // Container shared, Spring auto-config datasource
}
```

❌ Wrong:

```java
@SpringBootTest
@AutoConfigureTestDatabase(replace = Replace.ANY)   // ❌ H2 fake
class ProductIntegrationTest { ... }
```

**Lý do**: Production = PostgreSQL. H2 không support CITEXT, JSONB, advisory lock, window function — false confidence.

---

## TS-005 — @MockitoBean

> 🔴 MUST — Spring Boot 4: dùng `@MockitoBean` thay `@MockBean` (deprecated).

✅ Right:

```java
@WebMvcTest(ProductController.class)
class ProductControllerWebMvcTest {
    @MockitoBean ProductService productService;
}
```

❌ Wrong:

```java
@WebMvcTest(ProductController.class)
class ProductControllerWebMvcTest {
    @MockBean ProductService productService;   // ❌ deprecated
}
```

---

## TS-006 — Slice test ưu tiên

> 🔴 MUST — Test 1 layer dùng slice annotation, KHÔNG `@SpringBootTest`.

|              Slice              |       Loads        |                  Use case                  |
|---------------------------------|--------------------|--------------------------------------------|
| `@WebMvcTest(Controller.class)` | MVC + 1 controller | Controller logic, HTTP binding, validation |
| `@DataJpaTest`                  | JPA infra          | Repository custom query                    |
| `@JsonTest`                     | Jackson            | Serialization edge case                    |
| `@RestClientTest`               | RestClient         | HTTP client outgoing                       |

✅ Right:

```java
@WebMvcTest(ProductController.class)
@Import(TestSecurityConfig.class)
class ProductControllerWebMvcTest {

    @Autowired MockMvc mockMvc;
    @MockitoBean ProductService service;

    @Test
    void getById_whenNotFound_returns404() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.findById(id)).thenThrow(new NotFoundException("not found"));

        mockMvc.perform(get("/api/products/{id}", id))
            .andExpect(status().isNotFound())
            .andExpect(content().contentType("application/problem+json"));
    }
}
```

❌ Wrong (overkill):

```java
@SpringBootTest   // ❌ full context cho controller test
class ProductControllerTest { ... }
```

---

## TS-007 — Test class suffix

> 🔴 MUST — Suffix theo loại:
> - `*Test` — unit
> - `*WebMvcTest` — controller slice
> - `*DataJpaTest` — repository slice
> - `*IntegrationTest` — full integration

✅ Right:

```
ProductServiceTest.java
ProductControllerWebMvcTest.java
ProductRepositoryDataJpaTest.java
ProductIntegrationTest.java
```

---

## TS-008 — Test method naming

> 🟡 SHOULD — BDD-style `<subject>_<condition>_<expected>`.

✅ Right:

```java
@Test
void findById_whenNotExists_throwsNotFoundException()

@Test
void create_withValidRequest_returns201AndLocationHeader()

@Test
void updatePrice_withNegativeValue_returns400()
```

→ See: [02-naming.md#NM-011](./02-naming.md)

---

## TS-009 — Fixture static factory

> 🟡 SHOULD — Test data lặp lại → `*Fixtures.java` với static factory.

✅ Right:

```java
// feature/product/ProductFixtures.java
public final class ProductFixtures {

    private ProductFixtures() {}

    public static Product aProduct() {
        return aProduct(UUID.randomUUID());
    }

    public static Product aProduct(UUID id) {
        Product p = new Product();
        p.setId(id);
        p.setName("Test Product");
        p.setPrice(new BigDecimal("9.99"));
        p.setActive(true);
        return p;
    }

    public static CreateProductRequest aCreateRequest() {
        return new CreateProductRequest("New Product", new BigDecimal("19.99"));
    }
}
```

**Trong test**:

```java
Product p = ProductFixtures.aProduct();
```

→ Test focus vào behavior, không setup noise.

---

## TS-010 — Không Thread.sleep

> 🔴 MUST NOT — `Thread.sleep` để chờ async result. Dùng Awaitility.

→ See: [04-java-idioms.md#JI-013](./04-java-idioms.md)

---

## TS-011 — @ServiceConnection cho Testcontainers

> 🟡 SHOULD — Spring Boot 3.1+: dùng `@ServiceConnection` để auto-bind container → `spring.datasource.*`.

✅ Right:

```java
@Container
@ServiceConnection
static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");
```

❌ Cũ (verbose):

```java
@DynamicPropertySource
static void postgres(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
}
```

---

## TS-012 — AbstractContainerBaseTest

> 🟡 SHOULD — Share container giữa nhiều test class qua abstract base.

✅ Right:

```java
@Testcontainers
public abstract class AbstractContainerBaseTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:16-alpine")
            .withReuse(true);     // local dev: reuse container giữa run
}

class ProductIntegrationTest extends AbstractContainerBaseTest { ... }
class OrderIntegrationTest extends AbstractContainerBaseTest { ... }
```

**Reuse local dev** (`~/.testcontainers.properties`):

```
testcontainers.reuse.enable=true
```

→ Container không tear down giữa runs, save 10–20s.

---

## TS-013 — Coverage gate

> 🔴 MUST — JaCoCo gate pass:

|      Element       |       Line       | Branch |
|--------------------|------------------|--------|
| Bundle             | 70%              | 60%    |
| Service package    | 85%              | —      |
| Controller package | 80%              | —      |
| Class miss         | < 30 lines/class | —      |

Excluded (justified):
- `*Application.class`
- `*Config.class`
- `*Properties.class` (record)
- `*MapperImpl.class` (MapStruct generated)
- `dto/**` (record)
- Enum value class

→ See: [12-quality-gates.md](./12-quality-gates.md)

---

## TS-014 — Assertion-free test forbidden

> 🔴 MUST NOT — Test gọi method nhưng không assert kết quả.

❌ Wrong:

```java
@Test
void create() {
    service.create(req);   // ❌ chỉ gọi, không verify
}
```

✅ Right:

```java
@Test
void create_returnsProductWithGeneratedId() {
    ProductResponse result = service.create(req);

    assertThat(result.id()).isNotNull();
    assertThat(result.name()).isEqualTo(req.name());
    assertThat(result.price()).isEqualByComparingTo(req.price());
}
```

---

## TS-015 — Parallel execution

> 🟢 MAY — Enable parallel test cho suite > 2 phút.

`src/test/resources/junit-platform.properties`:

```properties
junit.jupiter.execution.parallel.enabled=true
junit.jupiter.execution.parallel.mode.default=concurrent
junit.jupiter.execution.parallel.mode.classes.default=concurrent
junit.jupiter.execution.parallel.config.strategy=dynamic
```

**Caveat**: Integration test với `@DirtiesContext` hoặc shared DB cần `same_thread` mode.

---

## See also

- JUnit 5: https://junit.org/junit5/docs/current/user-guide/
- AssertJ: https://assertj.github.io/doc/
- Testcontainers: https://testcontainers.com/
