# 07 — Persistence

> **Status:** Active &nbsp;|&nbsp; **Version:** v1.0.0 &nbsp;|&nbsp; **Last updated:** 2026-05-21

JPA + PostgreSQL + Flyway conventions.

## Quick reference

|         Aspect         |                         Convention                          |
|------------------------|-------------------------------------------------------------|
| ORM                    | Hibernate (Spring Data JPA)                                 |
| Connection pool        | HikariCP (auto)                                             |
| Migration              | Flyway `V*__*.sql` + `R__*.sql`                             |
| Entity ID              | UUIDv7 (project có generator)                               |
| Entity equals/hashCode | ID-based, **KHÔNG** field-based                             |
| Lazy/Eager             | LAZY default, EAGER chỉ khi cần thực sự                     |
| Transaction            | `@Transactional(readOnly=true)` cho read, default cho write |
| `ddl-auto`             | `validate` ở production                                     |
| DTO projection         | Record + constructor expression                             |
| N+1 fix                | `@EntityGraph` hoặc `JOIN FETCH`                            |

---

## Rules

|   ID   |  Severity   |                                            Rule                                            |
|--------|-------------|--------------------------------------------------------------------------------------------|
| PE-001 | 🔴 MUST     | Entity là `class` extend `BaseEntity`, KHÔNG `record`                                      |
| PE-002 | 🔴 MUST     | Entity có no-arg constructor `protected` (Lombok `@NoArgsConstructor(access = PROTECTED)`) |
| PE-003 | 🔴 MUST     | `equals/hashCode` ID-based, hashCode constant (không depend on id)                         |
| PE-004 | 🔴 MUST NOT | Lombok `@Data` hoặc `@EqualsAndHashCode` default trên entity                               |
| PE-005 | 🔴 MUST NOT | Lombok `@ToString` include collection field                                                |
| PE-006 | 🔴 MUST     | Service method có `@Transactional` explicit (read-only hoặc write)                         |
| PE-007 | 🔴 MUST     | Read-only method: `@Transactional(readOnly = true)`                                        |
| PE-008 | 🔴 MUST     | Production: `spring.jpa.hibernate.ddl-auto=validate`                                       |
| PE-009 | 🔴 MUST     | Schema change qua Flyway, KHÔNG `ddl-auto=update`                                          |
| PE-010 | 🔴 MUST     | Flyway migration immutable sau apply (không edit checksum)                                 |
| PE-011 | 🔴 MUST     | Flyway naming: `V<n>__<desc>.sql` hoặc `R__<desc>.sql`                                     |
| PE-012 | 🟡 SHOULD   | Query read-only nhiều record dùng DTO projection (record + constructor expression)         |
| PE-013 | 🟡 SHOULD   | Quan hệ collection fix N+1 bằng `@EntityGraph`/`JOIN FETCH`                                |
| PE-014 | 🟡 SHOULD   | Optimistic lock: `@Version Long version`                                                   |
| PE-015 | 🔴 MUST NOT | Open Session in View (OSIV) bật ở production                                               |
| PE-016 | 🟡 SHOULD   | Production HikariCP có `leak-detection-threshold`                                          |

---

## PE-001 — Entity là class

> 🔴 MUST — `@Entity` class extend `BaseEntity`. KHÔNG record.

✅ Right:

```java
@Entity
@Table(name = "products")
@Getter @Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@ToString(of = {"id", "name"})       // KHÔNG include collection
public class Product extends BaseEntity {

    @Id
    @GeneratedValue(generator = "uuidv7")
    @GenericGenerator(name = "uuidv7", strategy = "...")
    private UUID id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal price;

    @Column(nullable = false)
    private boolean active;

    @Version
    private Long version;
}
```

❌ Wrong:

```java
@Entity
public record Product(@Id UUID id, String name) {}   // ❌ JPA không support
```

---

## PE-002 — No-arg constructor protected

> 🔴 MUST — Entity có no-arg constructor, access `protected` (JPA cần, không expose).

✅ Right:

```java
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Product { ... }
```

Hoặc manual:

```java
protected Product() {}
```

---

## PE-003 — equals/hashCode ID-based

> 🔴 MUST — `equals` so sánh ID, `hashCode` là constant.

✅ Right:

```java
@Override
public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof Product other)) return false;
    return id != null && id.equals(other.id);
}

@Override
public int hashCode() {
    return getClass().hashCode();   // Constant — không depend on id
}
```

**Lý do**:
- ID null trước persist, có giá trị sau persist. Field-based hash thay đổi → mất khỏi Set.
- Hibernate proxy may have different runtime class — `instanceof` thay `getClass()` so sánh.

---

## PE-004 — Không @Data/@EqualsAndHashCode trên entity

> 🔴 MUST NOT — Lombok `@Data`, `@EqualsAndHashCode` default sinh field-based equals.

❌ Wrong:

```java
@Entity
@Data    // ❌ sinh equals dùng tất cả field, include lazy collection
public class Product { ... }
```

✅ Right: manual equals/hashCode (PE-003), hoặc Lombok với `onlyExplicitlyIncluded`:

```java
@Entity
@Getter @Setter
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Product {
    @EqualsAndHashCode.Include
    @Id
    private UUID id;
    // other fields
}
```

---

## PE-005 — @ToString không include collection

> 🔴 MUST NOT — `@ToString` include `@OneToMany` collection → lazy initialization mỗi lần log.

❌ Wrong:

```java
@Entity
@ToString    // ❌ include tất cả field, gồm items collection
public class Order {
    @OneToMany List<OrderItem> items;
}
```

✅ Right:

```java
@ToString(of = {"id", "status"})   // chỉ scalar field
public class Order { ... }
```

---

## PE-006 — Service method có @Transactional

> 🔴 MUST — Service method touching DB phải có `@Transactional` explicit.

✅ Right:

```java
@Service
@RequiredArgsConstructor
public class ProductService {

    @Transactional(readOnly = true)
    public Product findById(UUID id) { ... }

    @Transactional
    public Product create(CreateProductRequest req) { ... }
}
```

❌ Wrong:

```java
@Service
public class ProductService {

    public Product findById(UUID id) {   // ❌ no @Transactional
        return repository.findById(id).orElseThrow(...);
    }
}
```

**Lưu ý**: Spring Data interface có `@Transactional` default ở method level. Service wrap thêm để explicit boundary.

---

## PE-007 — readOnly = true cho read

> 🔴 MUST — Read-only method dùng `@Transactional(readOnly = true)`.

**Lợi ích**:
- Hibernate skip dirty checking.
- Driver hint DB tối ưu (PostgreSQL recognize).
- Spring guard accidental write.

✅ Right:

```java
@Transactional(readOnly = true)
public Page<Product> search(SearchCriteria criteria, Pageable pageable) { ... }
```

---

## PE-008 — ddl-auto=validate production

> 🔴 MUST — `spring.jpa.hibernate.ddl-auto=validate` ở production. Verify schema match entity, không tự thay đổi.

```yaml
# application.yml (or application-prod.yml)
spring:
  jpa:
    hibernate:
      ddl-auto: validate
```

❌ MUST NOT trong production:
- `create`, `create-drop` — drop data!
- `update` — Hibernate đoán schema change, gây surprise.

**Dev profile** MAY dùng `validate` (vẫn an toàn) hoặc `none` cho fresh test.

---

## PE-009 — Schema qua Flyway

> 🔴 MUST — Schema change qua Flyway migration. KHÔNG sửa schema thủ công hoặc qua `ddl-auto=update`.

```yaml
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true
    validate-migration-naming: true
```

---

## PE-010 — Migration immutable

> 🔴 MUST NOT — Edit migration đã apply (Flyway checksum mismatch → fail startup).

Khi muốn "rollback" hoặc fix: **tạo migration mới** (forward-only):

✅ Right:

```
V1__create_products.sql        # Đã apply
V2__add_price_column.sql       # Đã apply
V3__fix_price_precision.sql    # Migration mới fix V2
```

❌ Wrong: Sửa nội dung `V2__add_price_column.sql`.

---

## PE-011 — Flyway naming

> 🔴 MUST — Format: `V<version>__<description>.sql` hoặc `R__<description>.sql`.

Version có thể:
- Sequential: `V1`, `V2`, `V3`
- Date-based: `V20260521093015` (timestamp, tránh conflict khi parallel)

✅ Right:

```
V1__initial_schema.sql
V2__add_product_category.sql
V3__add_index_active_products.sql
V20260521093015__add_audit_columns.sql   # date-based OK nếu team agree
R__refresh_materialized_views.sql        # repeatable
```

❌ Wrong:

```
V1_initial.sql          # ❌ thiếu __
v1__initial.sql         # ❌ phải uppercase V
V1__initial.SQL         # ❌ extension lowercase
1__initial.sql          # ❌ thiếu prefix V
```

**Description**: `snake_case`, verb-first nếu DDL action: `add_`, `drop_`, `create_`, `alter_`.

---

## PE-012 — DTO projection cho read

> 🟡 SHOULD — Query read nhiều record không cần entity state → DTO projection.

✅ Right (record + constructor expression):

```java
public record ProductSummary(UUID id, String name, BigDecimal price) {}

public interface ProductRepository extends JpaRepository<Product, UUID> {

    @Query("""
        SELECT new com.tungph7.learnpostgres.feature.product.dto.ProductSummary(
            p.id, p.name, p.price
        )
        FROM Product p WHERE p.active = true
        """)
    List<ProductSummary> findActiveSummaries();
}
```

✅ Interface projection (simpler):

```java
public interface ProductSummary {
    UUID getId();
    String getName();
    BigDecimal getPrice();
}

List<ProductSummary> findByActiveTrue();
```

**Lợi ích**: SELECT ít column → giảm load DB + network. Skip Hibernate dirty check.

---

## PE-013 — Fix N+1

> 🟡 SHOULD — Query có collection relation dùng `@EntityGraph` hoặc `JOIN FETCH`.

✅ Right — `@EntityGraph`:

```java
@EntityGraph(attributePaths = {"items", "customer"})
@Query("SELECT o FROM Order o WHERE o.status = :status")
List<Order> findByStatusWithItems(@Param("status") OrderStatus status);
```

✅ Right — `JOIN FETCH`:

```java
@Query("""
    SELECT DISTINCT o FROM Order o
    LEFT JOIN FETCH o.items
    LEFT JOIN FETCH o.customer
    WHERE o.status = :status
    """)
List<Order> findByStatusWithItems(@Param("status") OrderStatus status);
```

**Detection trong dev**:

```yaml
# application-local.yml
spring:
  jpa:
    properties:
      hibernate:
        generate_statistics: true
logging:
  level:
    org.hibernate.SQL: DEBUG
    org.hibernate.orm.jdbc.bind: TRACE
```

---

## PE-014 — Optimistic locking

> 🟡 SHOULD — Entity bị update concurrent có `@Version`.

```java
@Version
private Long version;
```

Khi 2 transaction update cùng row, transaction thứ 2 throw `OptimisticLockingFailureException` → controller catch trả `409 Conflict`.

---

## PE-015 — OSIV off production

> 🔴 MUST NOT — `spring.jpa.open-in-view=true` ở production. Lazy load vô tình trong serialization layer.

```yaml
spring:
  jpa:
    open-in-view: false   # ✅ disable
```

**Workflow đúng**: Service fetch đủ data (eager hoặc projection), trả DTO. Controller chỉ map DTO → response.

---

## PE-016 — HikariCP leak detection

> 🟡 SHOULD — `leak-detection-threshold: 60000` log warning khi connection không return.

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
      leak-detection-threshold: 60000   # ✅ catch leak sớm
```

---

## See also

- Flyway docs: https://documentation.red-gate.com/fd/
- Hibernate 7 docs: https://docs.jboss.org/hibernate/orm/7.1/
