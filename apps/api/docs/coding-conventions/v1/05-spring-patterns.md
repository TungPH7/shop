# 05 — Spring Patterns

> **Status:** Active &nbsp;|&nbsp; **Version:** v1.0.0 &nbsp;|&nbsp; **Last updated:** 2026-05-21

Patterns áp dụng cho Spring Boot 4 / Spring Framework 7.

## Quick reference

|      Aspect       |                           Convention                           |
|-------------------|----------------------------------------------------------------|
| DI                | Constructor injection only                                     |
| Lombok DI helper  | `@RequiredArgsConstructor`                                     |
| Config properties | Record + `@Validated` + `@EnableConfigurationProperties`       |
| Profiles          | `local`, `test`, `prod` (default: prod-like)                   |
| Bean stereotype   | `@Service`, `@Repository`, `@RestController`, `@Configuration` |
| Async executor    | `MdcTaskDecorator` propagate MDC                               |
| HTTP client       | `@HttpExchange` interface (Boot 4)                             |
| Test mock bean    | `@MockitoBean` (Boot 4) — KHÔNG `@MockBean`                    |

---

## Rules

|   ID   |  Severity   |                                      Rule                                      |
|--------|-------------|--------------------------------------------------------------------------------|
| SP-001 | 🔴 MUST     | Constructor injection, KHÔNG `@Autowired` field                                |
| SP-002 | 🔴 MUST     | Field `private final` cho mọi dependency                                       |
| SP-003 | 🟡 SHOULD   | `@RequiredArgsConstructor` (Lombok) thay manual constructor                    |
| SP-004 | 🔴 MUST     | `@ConfigurationProperties` dùng record + `@Validated`                          |
| SP-005 | 🔴 MUST NOT | `@Component` trên record (proxy conflict)                                      |
| SP-006 | 🔴 MUST     | Stereotype annotation đúng vai trò: `@Service`/`@Repository`/`@RestController` |
| SP-007 | 🔴 MUST NOT | `@Autowired` trên private method                                               |
| SP-008 | 🟡 SHOULD   | Profile `prod` là default (safe-by-default), explicit `local`/`test` cho dev   |
| SP-009 | 🔴 MUST     | Outbound HTTP dùng `@HttpExchange` interface (project có external call)        |
| SP-010 | 🔴 MUST     | Test mock dùng `@MockitoBean`, KHÔNG `@MockBean` (deprecated)                  |
| SP-011 | 🟡 SHOULD   | Async executor decorate MDC: `MdcTaskDecorator`                                |
| SP-012 | 🔴 MUST NOT | `@Transactional` trên controller (xem 07)                                      |
| SP-013 | 🟡 SHOULD   | `@ConditionalOnProperty` cho feature flag                                      |
| SP-014 | 🔴 MUST NOT | Self-invocation method `@Transactional`/`@Async` (proxy bypass)                |

---

## SP-001 — Constructor injection

> 🔴 MUST — Inject qua constructor. KHÔNG `@Autowired` field.

✅ Right:

```java
@Service
@RequiredArgsConstructor
public class ProductService {
    private final ProductRepository repository;
    private final ProductMapper mapper;
}
```

✅ Equivalent (manual):

```java
@Service
public class ProductService {
    private final ProductRepository repository;
    private final ProductMapper mapper;

    public ProductService(ProductRepository repository, ProductMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }
}
```

❌ Wrong:

```java
@Service
public class ProductService {
    @Autowired
    private ProductRepository repository;    // ❌ mutable, hard to test
}
```

**Lý do**: Final field = immutable + thread-safe; test mock không cần Spring context; fail-fast.

---

## SP-002 — Dependency là `private final`

> 🔴 MUST — Dependency field `private final`.

✅ Right:

```java
private final ProductRepository repository;
```

❌ Wrong:

```java
ProductRepository repository;            // ❌ package-private, không final
public ProductRepository repository;     // ❌ public mutable
```

---

## SP-003 — `@RequiredArgsConstructor`

> 🟡 SHOULD — Dùng Lombok `@RequiredArgsConstructor` cho constructor injection.

✅ Right:

```java
@Service
@RequiredArgsConstructor
public class ProductService {
    private final ProductRepository repository;
    private final ProductMapper mapper;
    private final ApplicationEventPublisher events;
}
```

**Khi NOT dùng Lombok**: Manual constructor cũng OK. Convention team — không enforce hard, miễn final field.

---

## SP-004 — `@ConfigurationProperties` với record

> 🔴 MUST — Config properties dùng record + `@Validated` + `@EnableConfigurationProperties`.

✅ Right:

```java
// Properties
@ConfigurationProperties(prefix = "app.security")
@Validated
public record SecurityProperties(
    @NotBlank String jwtSecret,
    @Positive Duration jwtExpiration,
    @NotNull Cors cors
) {
    public record Cors(
        List<String> allowedOrigins,
        @Positive Duration maxAge
    ) {}
}

// Config
@Configuration
@EnableConfigurationProperties(SecurityProperties.class)
public class SecurityConfig { ... }
```

**Lưu ý**:
- KHÔNG `@Component` trên record (SP-005).
- KHÔNG `Optional<T>` field — Spring bind null không phải `Optional.empty()`.

---

## SP-005 — Không @Component trên record

> 🔴 MUST NOT — Record không annotate `@Component`/`@Service`/`@Repository`.

❌ Wrong:

```java
@Component
@ConfigurationProperties("app")
public record AppProperties(...) {}    // ❌ Spring tạo proxy cho immutable → conflict
```

✅ Right (register qua `@EnableConfigurationProperties`):

```java
@ConfigurationProperties("app")
public record AppProperties(...) {}

@Configuration
@EnableConfigurationProperties(AppProperties.class)
public class AppConfig { }
```

---

## SP-006 — Stereotype đúng vai trò

> 🔴 MUST — Dùng annotation đúng:

|    Annotation     |                     Vai trò                     |
|-------------------|-------------------------------------------------|
| `@Service`        | Business logic class                            |
| `@Repository`     | Data access; cũng tự nhận Spring Data interface |
| `@RestController` | REST endpoint                                   |
| `@Controller`     | MVC view controller                             |
| `@Configuration`  | Bean definition class                           |
| `@Component`      | Generic — chỉ khi không fit annotation khác     |

✅ Right:

```java
@Service
public class ProductService { ... }

@RestController
@RequestMapping("/api/products")
public class ProductController { ... }

@Configuration
public class JpaAuditingConfig { ... }
```

❌ Wrong:

```java
@Component
public class ProductService { ... }      // ❌ dùng @Service cho rõ vai trò
```

---

## SP-007 — Không @Autowired private method

> 🔴 MUST NOT — `@Autowired` trên private method → Spring proxy không reach.

❌ Wrong:

```java
@Service
public class ProductService {
    private ProductRepository repository;

    @Autowired
    private void setRepository(ProductRepository repository) {  // ❌
        this.repository = repository;
    }
}
```

✅ Right — constructor (SP-001).

---

## SP-008 — Profile naming

> 🟡 SHOULD — Profile chuẩn: `local`, `test`, `prod`. Default config = production-safe.

**`application.yml`**: Cấu hình production-like, không secret.
**`application-local.yml`**: Override cho local dev (debug log, embedded URL).
**`application-test.yml`**: Override cho test (Testcontainers, in-memory cache).
**`application-prod.yml`**: Production specific (nếu có; thường dùng env var thay).

```yaml
# application.yml — default (production-safe)
logging:
  level:
    root: INFO

# application-local.yml — dev override
logging:
  level:
    com.tungph7: DEBUG
    org.hibernate.SQL: DEBUG

spring:
  profiles:
    active: local    # Activate khi run từ IDE
```

**Active profile**:
- IDE: `spring.profiles.active=local` trong `application-local.yml` hoặc run config.
- Test: `@ActiveProfiles("test")`.
- Production: env var `SPRING_PROFILES_ACTIVE=prod` (nếu cần override).

---

## SP-009 — Outbound HTTP với @HttpExchange

> 🔴 MUST — Spring Boot 4: outbound HTTP call dùng `@HttpExchange` interface.

✅ Right:

```java
@HttpExchange(url = "${external.payment.url}", accept = "application/json")
public interface PaymentApiClient {

    @PostExchange("/v1/charge")
    ChargeResponse charge(@RequestBody ChargeRequest request);

    @GetExchange("/v1/charges/{id}")
    ChargeResponse get(@PathVariable String id);
}

@SpringBootApplication
@ImportHttpServices(PaymentApiClient.class)
public class Application { }
```

❌ Wrong:

```java
@Service
public class PaymentService {
    private final RestTemplate restTemplate;   // ❌ RestTemplate cũ

    public ChargeResponse charge(ChargeRequest req) {
        return restTemplate.postForObject("/v1/charge", req, ChargeResponse.class);
    }
}
```

---

## SP-010 — @MockitoBean trong test

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
    @MockBean ProductService productService;    // ❌ deprecated trong Boot 4
}
```

→ See: [10-testing.md](./10-testing.md)

---

## SP-011 — MDC propagate qua async

> 🟡 SHOULD — `@Async` / `TaskExecutor` decorate với `MdcTaskDecorator` để propagate MDC.

✅ Right:

```java
@Configuration
@EnableAsync
class AsyncConfig {

    @Bean("taskExecutor")
    Executor taskExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setTaskDecorator(new MdcTaskDecorator());
        executor.initialize();
        return executor;
    }
}

class MdcTaskDecorator implements TaskDecorator {
    @Override
    public Runnable decorate(Runnable task) {
        Map<String, String> mdc = MDC.getCopyOfContextMap();
        return () -> {
            try {
                if (mdc != null) MDC.setContextMap(mdc);
                task.run();
            } finally {
                MDC.clear();
            }
        };
    }
}
```

→ See: [09-observability.md](./09-observability.md)

---

## SP-012 — Không @Transactional trên controller

> 🔴 MUST NOT — `@Transactional` đặt ở service layer, KHÔNG controller.

❌ Wrong:

```java
@RestController
public class ProductController {
    @Transactional   // ❌ TX scope quá rộng (gồm HTTP serialization)
    @PostMapping
    public ProductResponse create(@RequestBody CreateProductRequest req) { ... }
}
```

✅ Right:

```java
@RestController
public class ProductController {
    private final ProductService service;

    @PostMapping
    public ProductResponse create(@Valid @RequestBody CreateProductRequest req) {
        return service.create(req);   // service has @Transactional
    }
}

@Service
public class ProductService {
    @Transactional
    public ProductResponse create(CreateProductRequest req) { ... }
}
```

→ See: [07-persistence.md](./07-persistence.md)

---

## SP-013 — Feature flag qua @ConditionalOnProperty

> 🟡 SHOULD — Toggle feature dùng `@ConditionalOnProperty`.

✅ Right:

```java
@Configuration
@ConditionalOnProperty(prefix = "feature.bulk-import", name = "enabled", havingValue = "true")
class BulkImportConfig {

    @Bean
    BulkImportService bulkImportService() { ... }
}
```

```yaml
feature:
  bulk-import:
    enabled: false   # default off, enable per env
```

---

## SP-014 — Không self-invocation TX/Async

> 🔴 MUST NOT — Gọi `this.methodWithTx()` từ method khác cùng class → proxy bypass, không transaction/async.

❌ Wrong:

```java
@Service
public class ProductService {

    public void process(List<Product> products) {
        for (Product p : products) {
            this.saveAsync(p);   // ❌ proxy bypass, @Async không hoạt động
        }
    }

    @Async
    public void saveAsync(Product p) { ... }
}
```

✅ Right options:

**Option A**: Inject self proxy:

```java
@Service
public class ProductService {
    private final ApplicationContext context;

    public void process(List<Product> products) {
        ProductService self = context.getBean(ProductService.class);
        for (Product p : products) {
            self.saveAsync(p);   // ✅ via proxy
        }
    }

    @Async
    public void saveAsync(Product p) { ... }
}
```

**Option B** (cleaner): Tách thành 2 service:

```java
@Service
public class ProductOrchestrator {
    private final ProductAsyncSaver saver;

    public void process(List<Product> products) {
        products.forEach(saver::saveAsync);   // ✅ cross-class, proxy works
    }
}

@Service
public class ProductAsyncSaver {
    @Async
    public void saveAsync(Product p) { ... }
}
```

---

## See also

- Spring Boot reference: https://docs.spring.io/spring-boot/reference/
- Testing slices: https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html
