# 06 — API Design

> **Status:** Active &nbsp;|&nbsp; **Version:** v1.0.0 &nbsp;|&nbsp; **Last updated:** 2026-05-21

REST API conventions: URL, HTTP semantics, error format (RFC 9457), versioning, pagination.

## Quick reference

|    Aspect    |                    Convention                     |
|--------------|---------------------------------------------------|
| URL prefix   | `/api/...`                                        |
| URL noun     | Plural, kebab-case: `/api/order-items`            |
| Verb in URL  | ❌ Forbidden (use HTTP method)                     |
| Status code  | Strict HTTP semantics                             |
| Error format | RFC 9457 `application/problem+json`               |
| Pagination   | Spring `Pageable` + wrap thành `PagedResponse<T>` |
| Versioning   | Header `X-API-Version` (Spring Boot 4 native)     |
| OpenAPI      | springdoc-openapi 3.1                             |
| Auth         | JWT Bearer (stateless)                            |

---

## Rules

|   ID    |  Severity   |                                 Rule                                  |
|---------|-------------|-----------------------------------------------------------------------|
| API-001 | 🔴 MUST     | URL prefix `/api/`, noun **plural**, kebab-case                       |
| API-002 | 🔴 MUST NOT | Verb trong URL (`/getProduct`, `/createOrder`)                        |
| API-003 | 🔴 MUST     | Status code đúng semantics (xem bảng dưới)                            |
| API-004 | 🔴 MUST     | POST tạo resource trả `201 Created` + `Location` header               |
| API-005 | 🔴 MUST     | Error response dùng RFC 9457 `application/problem+json`               |
| API-006 | 🔴 MUST     | DTO request có `@Valid` validation                                    |
| API-007 | 🟡 SHOULD   | `Page<T>` wrap thành `PagedResponse<T>` (không leak Spring)           |
| API-008 | 🟡 SHOULD   | API versioning header `X-API-Version` khi có ≥ 2 version              |
| API-009 | 🔴 MUST     | OpenAPI annotation cho endpoint public (`@Operation`, `@ApiResponse`) |
| API-010 | 🟡 SHOULD   | Idempotency-Key cho POST tạo resource critical (payment, transfer)    |
| API-011 | 🟢 MAY      | HATEOAS — chỉ adopt full hoặc skip, không half                        |
| API-012 | 🔴 MUST     | `Authorization: Bearer <token>` cho protected endpoint                |
| API-013 | 🔴 MUST NOT | Status 200 với body `{"success": false}` (vi phạm HTTP)               |
| API-014 | 🟡 SHOULD   | Deprecation API: header `Deprecation` + `Sunset`                      |

---

## API-001 — URL convention

> 🔴 MUST — `/api/` prefix, noun plural, kebab-case multi-word.

✅ Right:

```
GET    /api/products
GET    /api/products/{id}
POST   /api/products
PUT    /api/products/{id}
PATCH  /api/products/{id}/price
DELETE /api/products/{id}

GET    /api/orders/{orderId}/items         # Nested resource
POST   /api/orders/{id}/cancel             # Action (state transition)
GET    /api/order-items                    # kebab-case multi-word
```

❌ Wrong:

```
GET  /api/product                          # ❌ singular
GET  /api/orderItems                       # ❌ camelCase
GET  /api/get_product                      # ❌ snake_case
GET  /api/getProductById/{id}              # ❌ verb in URL
POST /api/createOrder                      # ❌ verb in URL
```

---

## API-002 — Verb đặt ở HTTP method

> 🔴 MUST NOT — URL chứa verb. Action thuộc HTTP method.

✅ Right: `POST /api/orders/{id}/cancel` (action sub-resource OK khi state transition)

❌ Wrong: `POST /api/orders/cancel/{id}`, `GET /api/getOrder/{id}`

---

## API-003 — HTTP status code

> 🔴 MUST — Status code match operation semantics.

|            Status             |                            Use case                             |
|-------------------------------|-----------------------------------------------------------------|
| **200 OK**                    | GET, PUT update (có body), POST action (không tạo resource)     |
| **201 Created**               | POST tạo resource. MUST có `Location` header                    |
| **204 No Content**            | DELETE thành công, PUT/PATCH không body response                |
| **400 Bad Request**           | Validation fail body/params                                     |
| **401 Unauthorized**          | Missing/invalid auth                                            |
| **403 Forbidden**             | Authenticated nhưng không quyền                                 |
| **404 Not Found**             | Resource không tồn tại                                          |
| **409 Conflict**              | Duplicate key, optimistic lock, state conflict                  |
| **422 Unprocessable**         | Syntactically valid nhưng business rule fail (rare; thường 400) |
| **429 Too Many Requests**     | Rate limit                                                      |
| **500 Internal Server Error** | Unexpected — luôn investigate                                   |
| **502/503**                   | Downstream service fail                                         |

---

## API-004 — POST 201 + Location

> 🔴 MUST — POST tạo resource: `201 Created` + `Location` header.

✅ Right:

```java
@PostMapping
public ResponseEntity<ProductResponse> create(@Valid @RequestBody CreateProductRequest req) {
    ProductResponse created = service.create(req);
    return ResponseEntity
        .created(URI.create("/api/products/" + created.id()))
        .body(created);
}
```

❌ Wrong:

```java
@PostMapping
public ProductResponse create(@Valid @RequestBody CreateProductRequest req) {
    return service.create(req);   // ❌ default 200, không Location
}
```

---

## API-005 — Error format RFC 9457

> 🔴 MUST — Error response dùng `application/problem+json` theo RFC 9457.

Schema chuẩn:

```json
{
  "type": "https://api.example.com/errors/resource-not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Product with id 7a3e... not found",
  "instance": "/api/products/7a3e...",
  "errorCode": "RESOURCE_NOT_FOUND",
  "timestamp": "2026-05-21T10:30:00Z",
  "traceId": "abc123def456"
}
```

Extension field convention:
- `errorCode` — enum cho client switch.
- `timestamp` — ISO-8601 UTC.
- `traceId` — từ MDC, dễ correlate logs.
- `errors[]` — array field-level errors (validation):

```json
{
  "type": ".../errors/validation-failed",
  "title": "Validation Failed",
  "status": 400,
  "errorCode": "VALIDATION_FAILED",
  "errors": [
    {"field": "price", "message": "must be positive"},
    {"field": "name", "message": "must not be blank"}
  ]
}
```

→ See: [08-error-handling.md](./08-error-handling.md)

---

## API-006 — Validation với @Valid

> 🔴 MUST — Request DTO có `@Valid` + Jakarta Bean Validation annotation.

✅ Right:

```java
public record CreateProductRequest(
    @NotBlank @Size(max = 200) String name,
    @NotNull @Positive BigDecimal price,
    @Email String contactEmail
) {}

@PostMapping
public ResponseEntity<ProductResponse> create(@Valid @RequestBody CreateProductRequest req) { ... }
```

---

## API-007 — Pagination wrap

> 🟡 SHOULD — Endpoint list/search wrap `Page<T>` thành `PagedResponse<T>` tránh leak Spring internal.

✅ Right:

```java
public record PagedResponse<T>(
    List<T> content,
    PageMetadata page
) {
    public record PageMetadata(int number, int size, long totalElements, int totalPages) {}

    public static <T> PagedResponse<T> from(Page<T> p) {
        return new PagedResponse<>(
            p.getContent(),
            new PageMetadata(p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages())
        );
    }
}

// Controller
@GetMapping
public PagedResponse<ProductResponse> list(
    @PageableDefault(size = 20) Pageable pageable
) {
    return PagedResponse.from(service.search(pageable));
}
```

❌ Wrong:

```java
@GetMapping
public Page<ProductResponse> list(Pageable pageable) {  // ❌ leak Hibernate field
    return service.search(pageable);
}
```

**Query param convention**:

```
GET /api/products?page=0&size=20&sort=createdAt,desc&sort=name,asc
```

---

## API-008 — Versioning header

> 🟡 SHOULD — Khi có ≥ 2 version, header strategy.

```yaml
# application.yml
spring:
  mvc:
    apiversion:
      enabled: true
      use:
        header: X-API-Version
      default: "1.0"
```

Controller:

```java
@GetMapping(value = "/products", version = "1.0")
public List<ProductResponseV1> listV1() { ... }

@GetMapping(value = "/products", version = "2.0+")
public List<ProductResponseV2> listV2() { ... }
```

Client:

```http
GET /api/products HTTP/1.1
X-API-Version: 2.0
```

**Khi cần URL path versioning** (public API B2C): `/api/v1/products`, `/api/v2/products`. Document trong ADR lý do.

---

## API-009 — OpenAPI annotation

> 🔴 MUST — Endpoint public có `@Operation`, `@ApiResponse` cho documentation.

✅ Right:

```java
@RestController
@RequestMapping("/api/products")
@Tag(name = "Products", description = "Product catalog operations")
public class ProductController {

    @Operation(summary = "Create a new product")
    @ApiResponse(responseCode = "201", description = "Created")
    @ApiResponse(responseCode = "400", description = "Validation failed",
        content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "409", description = "Duplicate product name",
        content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping
    public ResponseEntity<ProductResponse> create(@Valid @RequestBody CreateProductRequest req) { ... }
}
```

Project có `ProblemDetailOpenApiCustomizer` đăng ký ProblemDetail schema globally — không cần lặp lại schema.

---

## API-010 — Idempotency-Key

> 🟡 SHOULD — POST critical (payment, transfer, order) hỗ trợ `Idempotency-Key` header.

```http
POST /api/orders
Idempotency-Key: 7a3e9b2c-...
```

Server lưu kết quả (Redis 24h), replay nếu key seen again.

**Project học**: chưa cần ngay. Document để sau.

---

## API-011 — HATEOAS optional

> 🟢 MAY — Spring HATEOAS chỉ adopt nếu team commit hypermedia-driven. KHÔNG half-adopt.

Pragmatic: skip HATEOAS, plain JSON đủ dùng cho 90% case.

---

## API-012 — JWT Bearer

> 🔴 MUST — Protected endpoint dùng `Authorization: Bearer <token>` stateless.

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://idp.example.com
          audiences: my-api
```

```java
@Configuration
@EnableWebSecurity
class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/v3/api-docs/**", "/swagger-ui/**").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))
            .build();
    }
}
```

---

## API-013 — Không 200 với success=false

> 🔴 MUST NOT — Trả `200 OK` với body `{"success": false, "error": "..."}` — vi phạm HTTP semantics.

✅ Right: dùng status code + ProblemDetail (API-005).

❌ Wrong:

```json
HTTP/1.1 200 OK
{ "success": false, "error": "Product not found" }
```

---

## API-014 — Deprecation header

> 🟡 SHOULD — Khi deprecate endpoint, header `Deprecation` + `Sunset`.

```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: Mon, 31 Dec 2026 23:59:59 GMT
Link: </api/v2/products>; rel="successor-version"
```

Deprecation period tối thiểu 6 tháng cho public API.

---

## See also

- RFC 9457: https://www.rfc-editor.org/rfc/rfc9457.html
- Spring Framework Error Responses: https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html
