# 08 — Error Handling

> **Status:** Active &nbsp;|&nbsp; **Version:** v1.0.0 &nbsp;|&nbsp; **Last updated:** 2026-05-21

Exception strategy + global handler + RFC 9457 ProblemDetail.

## Quick reference

|         Aspect         |                   Convention                   |
|------------------------|------------------------------------------------|
| Exception base         | `BusinessException` extends `RuntimeException` |
| Specific exception     | Extend `BusinessException` + `ErrorCode`       |
| Global handler         | `@RestControllerAdvice`                        |
| Error response         | RFC 9457 `application/problem+json`            |
| Error code             | Enum `ErrorCode` (project có)                  |
| Stack trace leak       | ❌ Never                                        |
| Catch `Exception` rộng | ❌ Chỉ trong global handler                     |

---

## Rules

|   ID   |  Severity   |                              Rule                               |
|--------|-------------|-----------------------------------------------------------------|
| EH-001 | 🔴 MUST     | Custom exception extends `BusinessException` (RuntimeException) |
| EH-002 | 🔴 MUST     | Mỗi exception có `ErrorCode` enum value                         |
| EH-003 | 🔴 MUST     | Global `@RestControllerAdvice` handle exception → ProblemDetail |
| EH-004 | 🔴 MUST     | Response `Content-Type: application/problem+json` cho error     |
| EH-005 | 🔴 MUST NOT | Catch `Exception` rộng trừ global handler                       |
| EH-006 | 🔴 MUST NOT | Swallow exception (empty catch block)                           |
| EH-007 | 🔴 MUST     | Rethrow giữ context: include cause + meaningful message         |
| EH-008 | 🔴 MUST NOT | Stack trace leak ra client                                      |
| EH-009 | 🟡 SHOULD   | Log ERROR cho unexpected, WARN cho expected (4xx)               |
| EH-010 | 🔴 MUST NOT | Exception cho control flow (`try { parse(s) }` để check)        |
| EH-011 | 🟡 SHOULD   | Validation error: array `errors[]` với field-level detail       |
| EH-012 | 🟡 SHOULD   | `traceId` trong ProblemDetail extension field                   |

---

## EH-001 — Exception hierarchy

> 🔴 MUST — Custom exception extends `BusinessException`.

✅ Right:

```java
// common/error/BusinessException.java
public class BusinessException extends RuntimeException {
    private final ErrorCode errorCode;
    private final HttpStatus status;

    public BusinessException(ErrorCode code, HttpStatus status, String message) {
        super(message);
        this.errorCode = code;
        this.status = status;
    }

    public BusinessException(ErrorCode code, HttpStatus status, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = code;
        this.status = status;
    }
    // getters
}

// common/error/NotFoundException.java
public class NotFoundException extends BusinessException {
    public NotFoundException(String message) {
        super(ErrorCode.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND, message);
    }
}

// feature/order/error/InsufficientStockException.java
public class InsufficientStockException extends BusinessException {
    public InsufficientStockException(UUID productId, int requested, int available) {
        super(ErrorCode.INSUFFICIENT_STOCK, HttpStatus.CONFLICT,
            String.format("Insufficient stock for product %s: requested %d, available %d",
                productId, requested, available));
    }
}
```

---

## EH-002 — ErrorCode enum

> 🔴 MUST — Mỗi exception type map tới enum value `ErrorCode`.

```java
// common/error/ErrorCode.java
public enum ErrorCode {
    // 400
    VALIDATION_FAILED,
    INVALID_REQUEST,

    // 401
    UNAUTHORIZED,

    // 403
    FORBIDDEN,

    // 404
    RESOURCE_NOT_FOUND,

    // 409
    DUPLICATE_RESOURCE,
    OPTIMISTIC_LOCK_FAILURE,
    INSUFFICIENT_STOCK,

    // 500
    INTERNAL_ERROR;
}
```

**Lý do**: Client switch theo `errorCode` (machine-readable), không parse `detail` (i18n + format change).

---

## EH-003 — @RestControllerAdvice

> 🔴 MUST — 1 class `@RestControllerAdvice` xử lý tất cả exception → ProblemDetail.

```java
@RestControllerAdvice
@RequiredArgsConstructor
@Slf4j
public class GlobalExceptionHandler {

    private final ProblemDetailFactory factory;

    @ExceptionHandler(BusinessException.class)
    ProblemDetail handleBusiness(BusinessException ex, HttpServletRequest req) {
        log.warn("Business exception: {}", ex.getMessage());
        return factory.create(ex.getStatus(), ex.getMessage(), req)
            .withErrorCode(ex.getErrorCode());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        List<FieldErrorDetail> errors = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> new FieldErrorDetail(e.getField(), e.getDefaultMessage()))
            .toList();
        return factory.create(HttpStatus.BAD_REQUEST, "Validation failed", req)
            .withErrorCode(ErrorCode.VALIDATION_FAILED)
            .withProperty("errors", errors);
    }

    @ExceptionHandler(Exception.class)   // Last resort
    ProblemDetail handleGeneric(Exception ex, HttpServletRequest req) {
        log.error("Unexpected error", ex);
        return factory.create(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error", req)
            .withErrorCode(ErrorCode.INTERNAL_ERROR);
        // KHÔNG expose ex.getMessage() — có thể leak internal info
    }
}
```

Project có structure này — xem `GlobalExceptionHandler.java`, `ProblemDetailFactory.java`.

---

## EH-004 — Content-Type problem+json

> 🔴 MUST — Error response header `Content-Type: application/problem+json`.

Spring Boot 4 với `ProblemDetail` tự handle. Verify:

```http
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
```

❌ Wrong:

```http
Content-Type: application/json   // ❌ phải problem+json cho error
```

---

## EH-005 — Không catch Exception rộng

> 🔴 MUST NOT — `catch (Exception e)` trong service/controller layer.

❌ Wrong:

```java
public Product create(CreateProductRequest req) {
    try {
        // ...
    } catch (Exception e) {   // ❌ rộng quá
        log.error("Failed", e);
        return null;
    }
}
```

✅ Right — catch specific:

```java
public Product create(CreateProductRequest req) {
    try {
        return doCreate(req);
    } catch (DataIntegrityViolationException e) {
        throw new ConflictException("Product name already exists: " + req.name(), e);
    }
    // Exception khác bubble up → global handler
}
```

**Exception**: Global `@RestControllerAdvice` được phép catch `Exception` (EH-003).

---

## EH-006 — Không swallow exception

> 🔴 MUST NOT — Empty catch block.

❌ Wrong:

```java
try {
    doSomething();
} catch (Exception e) {
    // empty — ❌ silently lose info
}
```

✅ Right — minimal: log + rethrow hoặc explicit "intentional":

```java
try {
    cache.refresh();
} catch (CacheException e) {
    log.warn("Cache refresh failed, continuing with stale data", e);
    // Intentional swallow — cache là optional
}
```

Project Checkstyle có `EmptyBlock` với `option=text` — empty catch phải có comment.

---

## EH-007 — Rethrow giữ context

> 🔴 MUST — Rethrow exception phải include cause + meaningful message.

✅ Right:

```java
catch (IOException e) {
    throw new ProductImportException(
        "Failed to read CSV for product " + id, e);   // ✅ cause + context
}
```

❌ Wrong:

```java
catch (IOException e) {
    throw new RuntimeException(e);                    // ❌ mất context
}

catch (IOException e) {
    throw new ProductImportException(e.getMessage()); // ❌ mất stack trace
}
```

---

## EH-008 — Stack trace không leak

> 🔴 MUST NOT — Stack trace, internal exception message, SQL fragment leak ra response.

❌ Wrong:

```json
{
  "status": 500,
  "detail": "org.postgresql.util.PSQLException: ERROR: duplicate key value violates unique constraint \"products_name_key\""
}
```

✅ Right:

```json
{
  "status": 409,
  "title": "Conflict",
  "detail": "Product name already exists",
  "errorCode": "DUPLICATE_RESOURCE"
}
```

**Generic 500 handler**: KHÔNG dùng `ex.getMessage()` ra response, dùng generic message + log full exception server-side.

---

## EH-009 — Log level đúng

> 🟡 SHOULD — Level theo nature:

|          Exception          |    Log level    |            Lý do            |
|-----------------------------|-----------------|-----------------------------|
| `NotFoundException` (404)   | DEBUG hoặc WARN | Expected, không cần alert   |
| `BadRequestException` (400) | WARN            | User error, alert nếu spike |
| `BusinessException` (4xx)   | WARN            | Expected business condition |
| `Exception` generic (500)   | ERROR           | Unexpected, cần investigate |
| External service timeout    | ERROR           | Cần monitoring              |

```java
@ExceptionHandler(NotFoundException.class)
ProblemDetail handleNotFound(NotFoundException ex, HttpServletRequest req) {
    log.debug("Resource not found: {}", ex.getMessage());   // DEBUG ok
    return factory.create(HttpStatus.NOT_FOUND, ex.getMessage(), req)...;
}

@ExceptionHandler(Exception.class)
ProblemDetail handleGeneric(Exception ex, HttpServletRequest req) {
    log.error("Unexpected error", ex);                       // ERROR + full stack
    return factory.create(HttpStatus.INTERNAL_SERVER_ERROR, ...)...;
}
```

---

## EH-010 — Không exception cho control flow

> 🔴 MUST NOT — Dùng `try-catch` để kiểm tra điều kiện.

❌ Wrong:

```java
boolean isInteger(String s) {
    try {
        Integer.parseInt(s);
        return true;
    } catch (NumberFormatException e) {   // ❌ exception cho check
        return false;
    }
}
```

✅ Right:

```java
boolean isInteger(String s) {
    return s != null && s.chars().allMatch(c -> Character.isDigit(c) || c == '-');
}
```

**Lý do**: Exception expensive (build stack trace). Dùng cho exceptional condition, không cho normal flow.

---

## EH-011 — Validation error chi tiết

> 🟡 SHOULD — Validation error trả array `errors[]` với field-level detail.

```json
{
  "type": ".../errors/validation-failed",
  "title": "Validation Failed",
  "status": 400,
  "detail": "Request contains invalid fields",
  "errorCode": "VALIDATION_FAILED",
  "errors": [
    {"field": "price", "message": "must be positive", "rejectedValue": -5},
    {"field": "name", "message": "must not be blank", "rejectedValue": ""}
  ]
}
```

Record:

```java
public record FieldErrorDetail(String field, String message, Object rejectedValue) {}
```

---

## EH-012 — traceId trong ProblemDetail

> 🟡 SHOULD — Include `traceId` (từ MDC) trong ProblemDetail extension field — dễ correlate logs.

```java
public ProblemDetail create(HttpStatus status, String detail, HttpServletRequest req) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
    pd.setInstance(URI.create(req.getRequestURI()));
    pd.setProperty("timestamp", Instant.now().toString());

    String traceId = MDC.get("traceId");
    if (traceId != null) {
        pd.setProperty("traceId", traceId);
    }
    return pd;
}
```

---

## See also

- RFC 9457: https://www.rfc-editor.org/rfc/rfc9457.html
- Spring Framework error responses: https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html
