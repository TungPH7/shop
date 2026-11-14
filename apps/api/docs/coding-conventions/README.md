# Coding Conventions

> Tài liệu rule chính thức của dự án **learn-postgresql-api**. Mỗi rule có ID có thể grep, severity rõ ràng, ví dụ Right vs Wrong.

**Current version:** [v1](./v1/) — Active

---

## Cách dùng

- **Viết code**: đọc `v1/00-introduction.md` (5 phút), sau đó tra cứu theo topic.
- **Code review**: cite rule ID (`NM-003`, `API-007`) trong comment để dev tra ngược.
- **Onboarding**: đọc tuần tự `v1/00` → `v1/12` (~45 phút).

## Cấu trúc

```
docs/coding-conventions/
├── README.md          (này) — index, version pointer
├── CHANGELOG.md       — log thay đổi giữa các version
└── v1/                — version hiện tại
    ├── README.md
    ├── 00-introduction.md
    ├── 01-project-structure.md
    ├── 02-naming.md
    ├── 03-code-style.md
    ├── 04-java-idioms.md
    ├── 05-spring-patterns.md
    ├── 06-api-design.md
    ├── 07-persistence.md
    ├── 08-error-handling.md
    ├── 09-observability.md
    ├── 10-testing.md
    ├── 11-git-workflow.md
    └── 12-quality-gates.md
```

## Cơ chế evolution (Versioning)

Theo SemVer-like cho convention:

- **Patch** trong cùng version (v1.0 → v1.1): thêm rule mới không conflict, làm rõ rule cũ. Edit trực tiếp file trong `v1/`, bump version trong header file + ghi vào `CHANGELOG.md`.
- **Major** (v1 → v2): rule cũ bị **đảo ngược** hoặc **xóa**, gây conflict code base. Tạo folder `v2/` mới, copy v1 + sửa, đánh dấu `v1/` là `Status: Superseded by v2`.
- **`v1/` không xóa** sau khi v2 ra — PR cũ vẫn link được rule mà nó tuân theo lúc merge.

### Quy trình propose convention change

1. Mở issue / PR đề xuất thay đổi với rationale.
2. Discuss + cite evidence (tài liệu chính thức Java/Spring/PostgreSQL, RFC, blog kỹ thuật uy tín).
3. Nếu approved:
   - Additive → edit file trong version hiện tại + bump patch version.
   - Breaking → tạo version mới (v2/, v3/, ...).
4. Update `CHANGELOG.md` với date + summary.
5. Update pointer `Current version` trong README này.

## Severity convention

|   Severity    |     Meaning      |               Action khi vi phạm               |
|---------------|------------------|------------------------------------------------|
| 🔴 **MUST**   | Bắt buộc         | Block merge, fix ngay                          |
| 🟡 **SHOULD** | Khuyến nghị mạnh | Comment trong PR, fix trừ khi có justification |
| 🟢 **MAY**    | Optional/style   | Không block                                    |

## Rule ID scheme

Prefix theo topic file:

| Prefix |       Topic       |           File            |
|--------|-------------------|---------------------------|
| `PS-`  | Project Structure | `01-project-structure.md` |
| `NM-`  | Naming            | `02-naming.md`            |
| `CS-`  | Code Style        | `03-code-style.md`        |
| `JI-`  | Java Idioms       | `04-java-idioms.md`       |
| `SP-`  | Spring Patterns   | `05-spring-patterns.md`   |
| `API-` | API Design        | `06-api-design.md`        |
| `PE-`  | Persistence       | `07-persistence.md`       |
| `EH-`  | Error Handling    | `08-error-handling.md`    |
| `OB-`  | Observability     | `09-observability.md`     |
| `TS-`  | Testing           | `10-testing.md`           |
| `GW-`  | Git Workflow      | `11-git-workflow.md`      |
| `QG-`  | Quality Gates     | `12-quality-gates.md`     |

ID format: `<PREFIX>-<3-digit number>`, ví dụ `NM-001`, `API-007`. Số không nhất thiết liên tiếp — đảo ID = đảo meaning (gây nhầm trong PR cũ).
