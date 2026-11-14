# 09 — Observability

> **Status:** Active &nbsp;|&nbsp; **Version:** v1.0.0 &nbsp;|&nbsp; **Last updated:** 2026-05-21

Logging + metrics + tracing. Spring Boot 4 stack.

## Quick reference

|   Pillar    |                      Tool                      |
|-------------|------------------------------------------------|
| Logs        | SLF4J facade + Logback + Logstash JSON encoder |
| Correlation | MDC + `X-Correlation-Id` header                |
| Metrics     | Micrometer + Prometheus endpoint               |
| Tracing     | OpenTelemetry starter (khi multi-service)      |

---

## Rules

|   ID   |  Severity   |                             Rule                             |
|--------|-------------|--------------------------------------------------------------|
| OB-001 | 🔴 MUST     | Dùng SLF4J API. KHÔNG `System.out`, JUL, Log4j direct        |
| OB-002 | 🔴 MUST     | Parameterized log message với `{}`, KHÔNG concat `+`         |
| OB-003 | 🔴 MUST     | Exception là last param, KHÔNG format placeholder            |
| OB-004 | 🔴 MUST     | Production: JSON structured log (Logstash encoder)           |
| OB-005 | 🔴 MUST     | `MDC.put` phải có `MDC.remove` trong `finally`               |
| OB-006 | 🔴 MUST     | Request có `X-Correlation-Id` → MDC propagate suốt request   |
| OB-007 | 🔴 MUST NOT | Log password, token, secret, PII không mask                  |
| OB-008 | 🟡 SHOULD   | Log level đúng nature: TRACE/DEBUG/INFO/WARN/ERROR           |
| OB-009 | 🟡 SHOULD   | Expose `/actuator/prometheus` cho metrics scraping           |
| OB-010 | 🟡 SHOULD   | Production: K8s liveness + readiness probe                   |
| OB-011 | 🟢 MAY      | OpenTelemetry starter cho distributed tracing (khi cần)      |
| OB-012 | 🟡 SHOULD   | Hot path: check `log.isDebugEnabled()` trước expensive build |

---

## OB-001 — SLF4J API

> 🔴 MUST — Dùng SLF4J. KHÔNG `System.out`, `System.err`, JUL, Log4j 1.x, Log4j 2 direct.

✅ Right:

```java
@Slf4j
class ProductService {
    public void create(...) {
        log.info("Creating product {}", id);
    }
}

// Manual (equivalent)
private static final Logger log = LoggerFactory.getLogger(ProductService.class);
```

❌ Wrong:

```java
System.out.println("Creating product " + id);              // ❌
java.util.logging.Logger.getLogger(...).info(...);          // ❌ JUL
e.printStackTrace();                                        // ❌
```

---

## OB-002 — Parameterized message

> 🔴 MUST — `{}` placeholder, KHÔNG `+` concatenation.

✅ Right:

```java
log.debug("Found product id={} name={}", id, name);
log.error("Failed to process order {}", orderId, ex);
```

❌ Wrong:

```java
log.debug("Found product id=" + id + " name=" + name);    // ❌
log.error("Failed: " + ex.getMessage());                   // ❌ lose stack trace
```

**Lý do**:
- Lazy formatting: chỉ build string nếu level enabled.
- NPE-safe: `+ null` cho `"null"` String; `{}` với null cho `"null"` trong format.
- Structured: JSON encoder serialize args riêng.

---

## OB-003 — Exception last param

> 🔴 MUST — Log exception: pass last param không `{}` placeholder.

✅ Right:

```java
log.error("Failed to process order {}", orderId, ex);   // ✅ ex là last, không có {} cho ex
```

❌ Wrong:

```java
log.error("Failed: {} {}", orderId, ex);                // ❌ ex format thành string, mất stack
log.error("Failed " + ex.getMessage());                 // ❌
log.error("Failed", ex.getMessage());                   // ❌ mất stack trace
```

---

## OB-004 — JSON log production

> 🔴 MUST — Production profile: JSON structured log qua Logstash encoder.

`logback-spring.xml`:

```xml
<configuration>
    <!-- Production / non-local: JSON -->
    <springProfile name="!local">
        <appender name="JSON" class="ch.qos.logback.core.ConsoleAppender">
            <encoder class="net.logstash.logback.encoder.LogstashEncoder">
                <includeMdcKeyName>traceId</includeMdcKeyName>
                <includeMdcKeyName>spanId</includeMdcKeyName>
                <includeMdcKeyName>correlationId</includeMdcKeyName>
                <includeMdcKeyName>userId</includeMdcKeyName>
                <customFields>
                    {"service":"learn-postgresql-api","env":"${SPRING_PROFILES_ACTIVE:-prod}"}
                </customFields>
            </encoder>
        </appender>
        <root level="INFO"><appender-ref ref="JSON"/></root>
    </springProfile>

    <!-- Local: human-readable -->
    <springProfile name="local">
        <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
            <encoder>
                <pattern>%d{HH:mm:ss.SSS} %-5level [%X{correlationId:-}] %logger{36} - %msg%n</pattern>
            </encoder>
        </appender>
        <root level="DEBUG"><appender-ref ref="CONSOLE"/></root>
    </springProfile>
</configuration>
```

Output JSON example:

```json
{
  "@timestamp": "2026-05-21T10:30:00.123Z",
  "level": "INFO",
  "logger": "c.t.l.feature.product.service.ProductService",
  "thread": "http-nio-8080-exec-3",
  "message": "Product 7a3e... created",
  "service": "learn-postgresql-api",
  "env": "prod",
  "correlationId": "req-7a3e9b2c",
  "traceId": "abc123def456"
}
```

---

## OB-005 — MDC cleanup finally

> 🔴 MUST — `MDC.put` luôn match với `MDC.remove` trong `finally`. Thread pool reuse → leak context.

✅ Right:

```java
public void process(String userId) {
    MDC.put("userId", userId);
    try {
        doWork();
    } finally {
        MDC.remove("userId");   // ✅
    }
}
```

✅ Better — try-with-resources pattern:

```java
try (MDC.MDCCloseable ignored = MDC.putCloseable("userId", userId)) {
    doWork();
}   // auto-remove
```

❌ Wrong:

```java
MDC.put("userId", userId);
doWork();
MDC.remove("userId");   // ❌ nếu doWork throw, MDC không clean → thread next reuse có "userId" cũ
```

---

## OB-006 — Correlation ID per request

> 🔴 MUST — Servlet filter set `correlationId` vào MDC từ header `X-Correlation-Id` (hoặc generate).

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Correlation-Id";
    private static final String MDC_KEY = "correlationId";

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String correlationId = Optional.ofNullable(req.getHeader(HEADER))
            .filter(s -> !s.isBlank())
            .orElseGet(() -> UUID.randomUUID().toString());

        MDC.put(MDC_KEY, correlationId);
        res.setHeader(HEADER, correlationId);

        try {
            chain.doFilter(req, res);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }
}
```

Project có pattern này — xem `CorrelationIdFilter.java`.

---

## OB-007 — Không log sensitive data

> 🔴 MUST NOT — Log password, token, API key, PII (full email, full credit card, SSN) không mask.

❌ Wrong:

```java
log.info("User {} logged in with password {}", username, password);   // ❌
log.debug("Token: {}", jwtToken);                                       // ❌
log.info("Charging card {} for {}", fullCardNumber, amount);            // ❌
```

✅ Right:

```java
log.info("User {} logged in", username);
log.info("Charging card ending {}", maskCard(cardNumber));   // "****1234"
log.info("Sending to {}", maskEmail(email));                  // "us***@example.com"
```

**Logback masking pattern** (additional defense):

```xml
<pattern>%replace(%message){'(password|token|secret)=\S+', '$1=***'}</pattern>
```

---

## OB-008 — Log level đúng

> 🟡 SHOULD — Level theo nature:

| Level |         Use case         |                     Ví dụ                      |
|-------|--------------------------|------------------------------------------------|
| TRACE | Hot path detail          | `log.trace("Cache hit key={}", key)`           |
| DEBUG | Diagnostic, off in prod  | `log.debug("Querying with filter={}", filter)` |
| INFO  | Business event           | `log.info("Order {} created", orderId)`        |
| WARN  | Handled abnormal         | `log.warn("Retry {} for {}", attempt, op)`     |
| ERROR | Failure cần intervention | `log.error("Failed to charge", ex)`            |

Production config:

```yaml
logging:
  level:
    root: INFO
    com.tungph7: INFO
    org.hibernate.SQL: WARN     # OFF in production normally
```

❌ Anti-pattern:
- ERROR cho expected 404 → noise alerting.
- INFO cho mọi method entry → log volume explode.
- DEBUG bật production → performance + storage cost.

---

## OB-009 — Prometheus endpoint

> 🟡 SHOULD — Expose `/actuator/prometheus` cho scraping.

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus,metrics
  metrics:
    tags:
      service: ${spring.application.name}
      env: ${SPRING_PROFILES_ACTIVE:dev}
```

**Standard metrics** auto-exposed:
- `http_server_requests_seconds` (method, uri, status, exception)
- `jvm_memory_*`, `jvm_threads_*`
- `process_uptime_seconds`
- `hikaricp_connections_*`

**Custom metric**:

```java
@Service
@RequiredArgsConstructor
public class ProductService {
    private final MeterRegistry meterRegistry;

    public Product create(CreateProductRequest req) {
        meterRegistry.counter("products.created", "category", req.category()).increment();
        return ...;
    }
}
```

---

## OB-010 — K8s probes

> 🟡 SHOULD — Production K8s: configure `liveness` + `readiness` group.

```yaml
management:
  endpoint:
    health:
      probes:
        enabled: true
      group:
        liveness:
          include: livenessState
        readiness:
          include: readinessState,db
```

→ `/actuator/health/liveness` cho K8s liveness probe.
→ `/actuator/health/readiness` cho K8s readiness probe (include DB check).

---

## OB-011 — OpenTelemetry tracing

> 🟢 MAY — Distributed tracing khi có ≥ 2 services. Dùng Spring Boot 4 OpenTelemetry starter.

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-opentelemetry</artifactId>
</dependency>
```

```yaml
management:
  opentelemetry:
    resource-attributes:
      service.name: ${spring.application.name}
      service.version: ${app.version:dev}
  tracing:
    sampling:
      probability: 1.0     # production: 0.1 hoặc tail-based
  otlp:
    tracing:
      endpoint: http://otel-collector:4318/v1/traces
```

**Manual span**:

```java
@Observed(name = "product.find_by_id")
public Product findById(UUID id) { ... }
```

→ Auto-instrumentation cover HTTP server, RestClient, JDBC, JPA.

---

## OB-012 — Check level trước expensive arg

> 🟡 SHOULD — Hot path: check level enabled trước build expensive arg.

✅ Right:

```java
if (log.isDebugEnabled()) {
    log.debug("Cache state: {}", buildCacheStateMap());   // ✅ expensive method chỉ chạy khi debug on
}
```

✅ Better (SLF4J 2.0+ fluent):

```java
log.atDebug().setMessage("Cache state: {}").addArgument(this::buildCacheStateMap).log();
```

❌ Wrong:

```java
log.debug("Cache state: {}", buildCacheStateMap());   // ❌ build always, dù debug off
```

---

## See also

- Logback docs: https://logback.qos.ch/manual/
- Logstash encoder: https://github.com/logfellow/logstash-logback-encoder
- Micrometer: https://micrometer.io/docs/
