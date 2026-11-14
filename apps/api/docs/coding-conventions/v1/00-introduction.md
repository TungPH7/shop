# 00 — Introduction

> **Status:** Active &nbsp;|&nbsp; **Version:** v1.0.0 &nbsp;|&nbsp; **Last updated:** 2026-05-21

## Mục đích

Standard rule team áp dụng cho **mọi PR vào main**. Mục tiêu:

1. **Predictable**: code mọi nơi có shape giống nhau, đọc nhanh.
2. **Reviewable**: comment PR có thể cite rule ID (`NM-003`) thay vì tranh luận taste.
3. **Toolable**: rule enforceable qua Spotless/Checkstyle/JaCoCo trước khi push.

## Severity — RFC 2119 keywords

|            Severity            |           Meaning           |   Enforcement    |        Khi vi phạm         |
|--------------------------------|-----------------------------|------------------|----------------------------|
| 🔴 **MUST** / **MUST NOT**     | Bắt buộc, không có ngoại lệ | CI gate / linter | Block merge                |
| 🟡 **SHOULD** / **SHOULD NOT** | Khuyến nghị mạnh            | Code review      | Comment + justify hoặc fix |
| 🟢 **MAY**                     | Optional, style choice      | —                | Không block                |

Khi rule **SHOULD** có ngoại lệ chính đáng, comment trong code (`// Justify: ...`) hoặc trong PR description.

## Rule ID scheme

Format: `<PREFIX>-<3-digit number>`.

```
NM-001  →  Naming, rule 001
API-007 →  API Design, rule 007
PE-012  →  Persistence, rule 012
```

ID **không tái sử dụng** sau khi deprecated. Khi remove/reverse, ID đó tagged "Removed in v2.0" thay vì gán nghĩa mới.

## Prefix map

| Prefix |       Topic       |
|--------|-------------------|
| `PS-`  | Project Structure |
| `NM-`  | Naming            |
| `CS-`  | Code Style        |
| `JI-`  | Java Idioms       |
| `SP-`  | Spring Patterns   |
| `API-` | API Design        |
| `PE-`  | Persistence       |
| `EH-`  | Error Handling    |
| `OB-`  | Observability     |
| `TS-`  | Testing           |
| `GW-`  | Git Workflow      |
| `QG-`  | Quality Gates     |

## Cách đọc 1 rule

Mỗi rule có structure:

```markdown
### NM-003 — Test method naming

> 🟡 SHOULD — Test method dùng BDD-style: `subject_condition_expected`.

✅ Right:
\```java
void findById_whenNotExists_throwsNotFoundException()
\```

❌ Wrong:
\```java
void test1()
void testFindById()
\```
```

3 thành phần:
1. **Rule statement** (1 câu) với severity + ID.
2. **Right** + **Wrong** code example.
3. Note nhỏ giải thích rationale (nếu cần).

## Khi rule conflict

Ưu tiên giảm dần:

1. **Tool config** (Spotless, Checkstyle, JaCoCo) — đã chạy thì đúng theo nó.
2. **MUST rule** trong file convention này.
3. **SHOULD rule**.
4. **Existing code pattern** trong cùng feature.
5. **Personal taste** — không là yếu tố.

Nếu conflict giữa convention và tool config → ưu tiên tool (vì tool block merge), open issue update convention.

## Khi gặp tình huống không có rule

1. Tìm pattern tương tự trong code base (`feature/product/...`) — copy structure.
2. Tham khảo tài liệu chính thức (Java/Spring/PostgreSQL) hoặc RFC liên quan.
3. Nếu thật sự mới: làm theo cách rõ ràng nhất, comment trong PR. Sau merge: open issue "add convention for X".

## Liên kết

- **RFC 2119**: https://www.rfc-editor.org/rfc/rfc2119
