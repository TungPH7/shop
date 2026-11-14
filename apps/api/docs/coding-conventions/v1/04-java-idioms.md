# 04 — Java 21 Idioms

> **Status:** Active &nbsp;|&nbsp; **Version:** v1.0.0 &nbsp;|&nbsp; **Last updated:** 2026-05-21

Modern Java features áp dụng cho dự án: records, sealed, pattern matching, virtual threads, text blocks.

## Quick reference

|         Feature         |      When to use       |               Status                |
|-------------------------|------------------------|-------------------------------------|
| Record                  | DTO, value object      | 🔴 MUST cho DTO                     |
| Sealed class            | Closed type hierarchy  | 🟡 SHOULD khi domain event/result   |
| Pattern matching switch | Multi-type dispatch    | 🟡 SHOULD thay if-else `instanceof` |
| Virtual threads         | Web request handling   | 🟢 MAY khi đã load test             |
| Text block              | Multi-line string      | 🔴 MUST thay concat                 |
| Switch expression       | Switch produce value   | 🔴 MUST thay switch statement       |
| Optional                | Return type only       | 🔴 MUST NOT field/param             |
| `var`                   | Local với type obvious | 🟢 MAY                              |

---

## Rules

|   ID   |  Severity   |                                 Rule                                  |
|--------|-------------|-----------------------------------------------------------------------|
| JI-001 | 🔴 MUST     | DTO dùng `record`, KHÔNG class + Lombok                               |
| JI-002 | 🟡 SHOULD   | Compact constructor cho normalization/validation in record            |
| JI-003 | 🔴 MUST NOT | `record` làm JPA `@Entity`                                            |
| JI-004 | 🟡 SHOULD   | Sealed interface/class cho closed hierarchy (state, event, result)    |
| JI-005 | 🟡 SHOULD   | Pattern matching `switch` thay `if-else` với `instanceof` chain       |
| JI-006 | 🔴 MUST     | Text block cho multi-line string (SQL, JSON, HTML)                    |
| JI-007 | 🔴 MUST     | Switch expression khi switch produce value                            |
| JI-008 | 🔴 MUST     | `Optional<T>` chỉ return type, KHÔNG field/param/property             |
| JI-009 | 🟢 MAY      | `var` cho local khi type rõ                                           |
| JI-010 | 🟢 MAY      | Sequenced Collections API (`getFirst`, `getLast`) khi need access end |
| JI-011 | 🟡 SHOULD   | Virtual thread enable cho web request — verify load test trước        |
| JI-012 | 🔴 MUST NOT | `synchronized` block ôm I/O khi enable VT (gây pin)                   |
| JI-013 | 🔴 MUST NOT | `Thread.sleep` thay `Awaitility` hoặc `CompletableFuture`             |

---

## JI-001 — Record cho DTO

> 🔴 MUST — DTO/request/response dùng `record`. Class + Lombok deprecated cho DTO.

✅ Right:

```java
public record CreateProductRequest(
    @NotBlank @Size(max = 200) String name,
    @NotNull @Positive BigDecimal price
) {}

public record ProductResponse(
    UUID id,
    String name,
    BigDecimal price,
    Instant createdAt
) {}
```

❌ Wrong:

```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ProductResponse {
    private UUID id;
    private String name;
    private BigDecimal price;
}
```

**Lý do**: Native, immutable, không annotation processor.

---

## JI-002 — Compact constructor

> 🟡 SHOULD — Khi record cần normalize/validate ngoài Bean Validation.

✅ Right:

```java
public record CreateProductRequest(
    @NotBlank @Size(max = 200) String name,
    @NotNull @Positive BigDecimal price
) {
    public CreateProductRequest {
        // Compact constructor chạy SAU Bean Validation
        name = name.trim();                      // normalize
        if (name.isEmpty()) {                    // additional validation
            throw new IllegalArgumentException("Name cannot be blank after trim");
        }
    }
}
```

**Lưu ý**: Compact constructor KHÔNG có `this.x = x` — Java tự gán. Chỉ assign khi normalize.

---

## JI-003 — Record không là Entity

> 🔴 MUST NOT — `record` không annotate `@Entity`.

❌ Wrong:

```java
@Entity
public record Product(@Id UUID id, String name) {}   // ❌ Hibernate không support
```

✅ Right — Entity là class:

```java
@Entity
@Table(name = "products")
@Getter @Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Product extends BaseEntity {
    @Id private UUID id;
    private String name;
}
```

**Lý do**: Hibernate cần no-arg constructor + setter cho proxy + dirty checking. Record không có.

→ See: [07-persistence.md](./07-persistence.md)

---

## JI-004 — Sealed cho closed hierarchy

> 🟡 SHOULD — Domain event/result/state có closed set of subtypes → sealed.

✅ Right:

```java
public sealed interface OrderEvent
    permits OrderEvent.Created, OrderEvent.Paid, OrderEvent.Cancelled {

    record Created(UUID orderId, Instant at) implements OrderEvent {}
    record Paid(UUID orderId, BigDecimal amount, Instant at) implements OrderEvent {}
    record Cancelled(UUID orderId, String reason, Instant at) implements OrderEvent {}
}
```

→ Compiler enforce exhaustive switch:

```java
String describe(OrderEvent event) {
    return switch (event) {
        case OrderEvent.Created c -> "Created at " + c.at();
        case OrderEvent.Paid p -> "Paid " + p.amount();
        case OrderEvent.Cancelled c -> "Cancelled: " + c.reason();
        // KHÔNG cần default, compiler kiểm tra exhaustive
    };
}
```

❌ Khi KHÔNG dùng sealed:
- Library API mở (user extend từ ngoài).
- Plugin architecture cho phép dynamic add subtype.

---

## JI-005 — Pattern matching switch

> 🟡 SHOULD — Multi-type dispatch dùng `switch` pattern thay `if-else` + `instanceof`.

✅ Right:

```java
String format(Object obj) {
    return switch (obj) {
        case null -> "null";
        case Integer i -> "int: " + i;
        case String s when s.length() > 10 -> "long: " + s.substring(0, 10) + "...";
        case String s -> "string: " + s;
        default -> "unknown";
    };
}
```

❌ Wrong (verbose):

```java
String format(Object obj) {
    if (obj == null) return "null";
    if (obj instanceof Integer i) return "int: " + i;
    if (obj instanceof String s) {
        if (s.length() > 10) return "long: " + s.substring(0, 10) + "...";
        return "string: " + s;
    }
    return "unknown";
}
```

**Record patterns** cho deconstruct:

```java
double area(Shape shape) {
    return switch (shape) {
        case Circle(double r) -> Math.PI * r * r;
        case Rectangle(double w, double h) -> w * h;
    };
}
```

---

## JI-006 — Text block cho multi-line string

> 🔴 MUST — SQL/JSON/HTML multi-line dùng text block, KHÔNG concat.

✅ Right:

```java
String sql = """
    SELECT p.id, p.name, p.price
    FROM products p
    WHERE p.active = true
      AND p.price > :minPrice
    ORDER BY p.created_at DESC
    """;
```

❌ Wrong:

```java
String sql = "SELECT p.id, p.name, p.price " +
             "FROM products p " +
             "WHERE p.active = true " +
             "  AND p.price > :minPrice " +
             "ORDER BY p.created_at DESC";
```

**Lưu ý indent**: Closing `"""` quyết định "incidental whitespace" — compiler tự strip indent.

---

## JI-007 — Switch expression

> 🔴 MUST — Switch produce value dùng expression (`->`), không statement (`:` + `break`).

✅ Right:

```java
int days = switch (month) {
    case JANUARY, MARCH, MAY, JULY, AUGUST, OCTOBER, DECEMBER -> 31;
    case APRIL, JUNE, SEPTEMBER, NOVEMBER -> 30;
    case FEBRUARY -> Year.isLeap(year) ? 29 : 28;
};
```

❌ Wrong:

```java
int days;
switch (month) {
    case JANUARY:
    case MARCH:
        days = 31;
        break;                    // ❌ dễ quên
    // ...
}
```

**Block expression** với `yield`:

```java
int result = switch (status) {
    case ACTIVE -> {
        log.info("Processing active");
        yield calculateActive();
    }
    case INACTIVE -> 0;
};
```

---

## JI-008 — Optional chỉ return type

> 🔴 MUST — `Optional<T>` **chỉ** làm return type. **MUST NOT** field, param, property.

✅ Right:

```java
public Optional<Product> findById(UUID id) { ... }
```

❌ Wrong:

```java
class Service {
    private Optional<Cache> cache;                          // ❌ field
}

void search(Optional<String> filter) { }                    // ❌ param

@ConfigurationProperties("app")
record AppProperties(Optional<String> name) {}              // ❌ Spring bind null không phải empty
```

**Thay thế**:
- Field nullable → `@Nullable` annotation.
- Param nullable → `@Nullable` hoặc overload.

---

## JI-009 — var khi obvious

> 🟢 MAY — `var` cho local variable nếu type rõ từ RHS.

→ Detail: [03-code-style.md#CS-013](./03-code-style.md)

---

## JI-010 — Sequenced Collections

> 🟢 MAY — Dùng `getFirst()`, `getLast()`, `reversed()` cho List/LinkedHashMap khi cần access end.

✅ Right:

```java
List<String> list = List.of("a", "b", "c");
String first = list.getFirst();    // "a"
String last = list.getLast();      // "c"
List<String> rev = list.reversed();
```

vs. cũ:

```java
String first = list.get(0);
String last = list.get(list.size() - 1);
```

---

## JI-011 — Virtual threads (cẩn thận)

> 🟡 SHOULD — Enable `spring.threads.virtual.enabled=true` cho web request — **sau khi load test verify**.

**Checklist trước enable production**:
1. Run load test với `-Djdk.tracePinnedThreads=full`. Verify không có `synchronized` ôm I/O.
2. Tune HikariCP pool theo workload (VT cho phép thousands concurrent → pool có thể exhaust).
3. Audit ThreadLocal usage (VT spawn nhiều → ThreadLocal cost).
4. Monitor metrics: thread count, pinning count, latency p99.

**Config**:

```yaml
spring:
  threads:
    virtual:
      enabled: true
  datasource:
    hikari:
      maximum-pool-size: 50    # tăng từ default 10
```

---

## JI-012 — Synchronized không ôm I/O khi enable VT

> 🔴 MUST NOT — Khi VT enabled, `synchronized` ôm blocking I/O gây thread pinning → carrier thread starvation.

❌ Wrong:

```java
synchronized (lock) {
    // I/O — VT bị pin → carrier thread block
    restClient.get().retrieve().body(String.class);
}
```

✅ Right (ReentrantLock không pin VT):

```java
private final ReentrantLock lock = new ReentrantLock();

lock.lock();
try {
    restClient.get().retrieve().body(String.class);
} finally {
    lock.unlock();
}
```

**Phát hiện**: Chạy với `-Djdk.tracePinnedThreads=full` → JVM log warning khi VT bị pin.

---

## JI-013 — Không Thread.sleep trong test

> 🔴 MUST NOT — Test code dùng `Thread.sleep` để chờ async result. Dùng `Awaitility` hoặc `CompletableFuture.get(timeout)`.

❌ Wrong:

```java
@Test
void testAsyncProcessing() {
    service.processAsync(id);
    Thread.sleep(2000);   // ❌ flaky
    assertThat(repository.findById(id)).isPresent();
}
```

✅ Right:

```java
@Test
void testAsyncProcessing() {
    service.processAsync(id);

    await().atMost(5, SECONDS)
        .untilAsserted(() -> assertThat(repository.findById(id)).isPresent());
}
```

```xml
<dependency>
    <groupId>org.awaitility</groupId>
    <artifactId>awaitility</artifactId>
    <scope>test</scope>
</dependency>
```

---

## See also

- JEP 444 — Virtual Threads: https://openjdk.org/jeps/444
- JEP 441 — Pattern Matching for switch: https://openjdk.org/jeps/441
