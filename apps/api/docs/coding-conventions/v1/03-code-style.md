# 03 — Code Style

> **Status:** Active &nbsp;|&nbsp; **Version:** v1.0.0 &nbsp;|&nbsp; **Last updated:** 2026-05-21

Format, imports, braces, whitespace. Chủ yếu **delegate cho Spotless + Checkstyle**.

## Source of truth

|   Aspect   |             Tool              |             Config file             |
|------------|-------------------------------|-------------------------------------|
| Format     | Spotless + google-java-format | `pom.xml` (spotless plugin section) |
| Style rule | Checkstyle                    | `checkstyle.xml`                    |
| Suppress   | Checkstyle suppressions       | `checkstyle-suppressions.xml`       |

**Khi conflict với rule trong file này → tool config thắng.**

## Quick reference

|       Aspect        |                  Value                   |
|---------------------|------------------------------------------|
| Indent              | 2 spaces                                 |
| Line length         | 120 chars (project) — Google default 100 |
| Tab character       | Forbidden                                |
| File encoding       | UTF-8                                    |
| Line ending         | LF (`.gitattributes`)                    |
| Trailing whitespace | Forbidden                                |
| File end newline    | Required                                 |
| Brace style         | K&R (opening brace same line)            |
| Wildcard import     | Forbidden                                |
| Method length       | ≤ 80 lines (Checkstyle)                  |
| Parameter count     | ≤ 8 (Checkstyle)                         |

---

## Rules

|   ID   |  Severity   |                                Rule                                 |
|--------|-------------|---------------------------------------------------------------------|
| CS-001 | 🔴 MUST     | Format bằng `./mvnw spotless:apply` trước commit                    |
| CS-002 | 🔴 MUST     | `./mvnw spotless:check` pass trước push (CI block)                  |
| CS-003 | 🔴 MUST     | Indent **2 spaces**, không tab                                      |
| CS-004 | 🔴 MUST     | Line length ≤ **120** chars                                         |
| CS-005 | 🔴 MUST     | KHÔNG wildcard import (`java.util.*`)                               |
| CS-006 | 🔴 MUST     | Import group order: `java, javax, jakarta, org, com, <other>`       |
| CS-007 | 🔴 MUST     | Brace K&R: opening cùng line, mọi block có brace                    |
| CS-008 | 🟡 SHOULD   | Method ≤ 80 lines (Checkstyle enforce)                              |
| CS-009 | 🟡 SHOULD   | Parameter count ≤ 8 — nhiều hơn → record group                      |
| CS-010 | 🔴 MUST NOT | Magic number (trừ `-1, 0, 1, 2, 100, 1000`)                         |
| CS-011 | 🟡 SHOULD   | Annotation type ở line riêng, stacked                               |
| CS-012 | 🟡 SHOULD   | Public class/method có Javadoc                                      |
| CS-013 | 🟢 MAY      | `var` cho local khi type obvious từ RHS                             |
| CS-014 | 🔴 MUST NOT | `System.out.println` trong main code                                |
| CS-015 | 🔴 MUST     | TODO comment có owner: `// TODO(name): description` hoặc link issue |

---

## CS-001 — Spotless apply trước commit

> 🔴 MUST — Chạy `./mvnw spotless:apply` trước `git commit`.

**Setup pre-commit hook (recommended)**:

```bash
# .git/hooks/pre-commit
#!/bin/sh
./mvnw -q spotless:check || {
  echo "❌ Format check failed. Run: ./mvnw spotless:apply"
  exit 1
}
```

```bash
chmod +x .git/hooks/pre-commit
```

---

## CS-002 — CI check spotless

> 🔴 MUST — CI workflow chạy `spotless:check` ở phase `validate`. Fail → block merge.

Project config (`pom.xml`):

```xml
<execution>
    <id>spotless-check</id>
    <goals><goal>check</goal></goals>
    <phase>validate</phase>
</execution>
```

---

## CS-003 — Indent 2 spaces

> 🔴 MUST — 2 spaces. Không tab.

Spotless (google-java-format) enforce — không cần config tay.

---

## CS-004 — Line length 120

> 🔴 MUST — ≤ 120 chars.

✅ Right:

```java
public ResponseEntity<ProductResponse> updatePrice(UUID id, UpdatePriceRequest request, Authentication auth) {
```

Khi vượt → break theo google-java-format style:

```java
public ResponseEntity<ProductResponse> updatePrice(
    UUID id, UpdatePriceRequest request, Authentication auth) {
```

**Project deviates from Google (100)**: Vietnam team với monitor 27"+, IDE split view tốt hơn ở 120.

---

## CS-005 — Không wildcard import

> 🔴 MUST NOT — `import java.util.*;` hoặc `import static org.junit.jupiter.api.Assertions.*;`.

✅ Right:

```java
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
```

❌ Wrong:

```java
import java.util.*;
import static org.assertj.core.api.Assertions.*;
```

**Exception**: AssertJ `assertThat` static import OK toàn project.

---

## CS-006 — Import group order

> 🔴 MUST — Order: `java, javax, jakarta, org, com, <other>`. Blank line giữa group.

✅ Right:

```java
package com.tungph7.learnpostgres.feature.product.service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tungph7.learnpostgres.common.error.NotFoundException;
import com.tungph7.learnpostgres.feature.product.domain.Product;

import lombok.RequiredArgsConstructor;
```

Spotless `<importOrder>` enforce — không sort tay.

---

## CS-007 — Brace K&R

> 🔴 MUST — Opening brace **cùng line**, mọi block có brace.

✅ Right:

```java
if (condition) {
    doSomething();
} else {
    doOther();
}

for (Product p : products) {
    p.process();
}
```

❌ Wrong:

```java
if (condition)
    doSomething();    // ❌ thiếu brace

if (condition)
{                     // ❌ Allman style
    doSomething();
}
```

**Exception**: Empty record/class:

```java
public record EmptyMarker() {}
```

---

## CS-008 — Method ≤ 80 lines

> 🟡 SHOULD — Method body ≤ 80 lines (count non-empty).

Khi vượt → extract method, hoặc tách thành class/strategy.

Checkstyle config:

```xml
<module name="MethodLength">
    <property name="max" value="80"/>
    <property name="countEmpty" value="false"/>
</module>
```

---

## CS-009 — Parameter count ≤ 8

> 🟡 SHOULD — Method/constructor parameter ≤ 8. Nhiều hơn → group thành record.

✅ Right — group:

```java
public Page<Product> search(SearchCriteria criteria, Pageable pageable) { }

public record SearchCriteria(
    @Nullable String category,
    @Nullable BigDecimal minPrice,
    @Nullable BigDecimal maxPrice,
    @Nullable Boolean active,
    @Nullable String tag,
    @Nullable Instant createdAfter
) {}
```

❌ Wrong:

```java
public Page<Product> search(
    String category, BigDecimal minPrice, BigDecimal maxPrice,
    Boolean active, String tag, Instant createdAfter,
    int page, int size, String sortField, String sortDir) { }  // 10 params
```

---

## CS-010 — Không magic number

> 🔴 MUST NOT — Số có meaning trong code phải là named constant.

✅ Right:

```java
private static final int MAX_RETRY_COUNT = 3;
private static final Duration RETRY_DELAY = Duration.ofMinutes(1);

if (attempt > MAX_RETRY_COUNT) { ... }
```

❌ Wrong:

```java
if (attempt > 3) { ... }                  // ❌ 3 là gì?
Thread.sleep(60000);                       // ❌
```

**Allow inline** (Checkstyle config): `-1, 0, 1, 2, 100, 1000`.

Field initializer cho config được phép inline:

```java
private static final int DEFAULT_PAGE_SIZE = 20;  // ✅ named, OK
```

---

## CS-011 — Annotation stacked

> 🟡 SHOULD — Multiple annotation: mỗi annotation line riêng.

✅ Right:

```java
@Override
@Transactional(readOnly = true)
public Product findById(UUID id) { ... }
```

❌ Wrong:

```java
@Override @Transactional(readOnly = true)
public Product findById(UUID id) { ... }
```

**Single annotation inline OK** với short:

```java
@Override public String toString() { return name; }   // OK nếu method 1-liner
```

---

## CS-012 — Javadoc public API

> 🟡 SHOULD — Public class/method có Javadoc khi không obvious từ signature.

✅ Worth Javadoc:

```java
/**
 * Finds a product by its UUID.
 *
 * @param id the product identifier; must not be null
 * @return the product if found
 * @throws NotFoundException if no product matches
 */
public Product findById(UUID id)
```

❌ Skip Javadoc:

```java
// Obvious từ name + type
public String getName()
public boolean isActive()
```

**Internal class/method (package-private)**: skip Javadoc OK.

---

## CS-013 — var khi obvious

> 🟢 MAY — `var` cho local variable khi type rõ từ RHS.

✅ OK:

```java
var products = productRepository.findAll();    // List<Product>
var now = Instant.now();                        // Instant
```

❌ Avoid:

```java
var result = process(input);  // ❌ result là gì?
var x = 0;                    // ❌ int hay long?
```

---

## CS-014 — Không System.out

> 🔴 MUST NOT — `System.out.println`, `System.err.println`, `e.printStackTrace()` trong main code.

Dùng SLF4J:

```java
log.info("Processing {}", id);
log.error("Failed to process {}", id, ex);
```

**Test code** MAY `System.out` cho quick debug, nhưng REMOVE trước commit.

---

## CS-015 — TODO comment có owner

> 🔴 MUST — TODO format: `// TODO(<name>): <description>` hoặc link tới issue.

✅ Right:

```java
// TODO(tungph7): Replace with native query after Hibernate 7.2 upgrade. See #142.
// TODO(#178): Add rate limiting before production rollout.
```

❌ Wrong:

```java
// TODO: fix this   // ❌ ai? bao giờ? gì?
// XXX
// FIXME
```

Checkstyle warn (không error) — không block merge nhưng visible trong code review.

---

## Quy ước comment

|                 Khi                 |                        Style                         |
|-------------------------------------|------------------------------------------------------|
| Giải thích WHY (intent, workaround) | `//` inline hoặc `/* */` block                       |
| Đánh dấu TODO                       | `// TODO(<owner>):`                                  |
| Javadoc                             | `/** */`                                             |
| Spotless toggle off                 | `// spotless:off ... // spotless:on`                 |
| Suppress Checkstyle                 | `// CHECKSTYLE:OFF ... // CHECKSTYLE:ON` (very rare) |

**KHÔNG comment WHAT** — code đã nói. Comment chỉ thêm WHY.

✅ Good:

```java
// Use SECOND pass because page metadata builds from full result set
List<Product> all = findAll();
```

❌ Bad:

```java
// Find all products
List<Product> all = findAll();   // ❌ obvious
```

---

## See also

- Google Java Style: https://google.github.io/styleguide/javaguide.html
- Spotless config: `pom.xml`
- Checkstyle rules: `checkstyle.xml`
