# Coding Conventions — v1

> **Status:** Active &nbsp;|&nbsp; **Version:** v1.0.0 &nbsp;|&nbsp; **Last updated:** 2026-05-21

Phiên bản hiện hành áp dụng cho **learn-postgresql-api** — Java 21 + Spring Boot 4 + PostgreSQL.

## Tóm tắt

13 file, đánh số 00–12, mỗi file ~150–300 dòng. **Đọc tuần tự cho onboarding**; **tra cứu theo topic** khi review.

## Index

| #  |                         File                         |                Topic                 | Read time |
|----|------------------------------------------------------|--------------------------------------|-----------|
| 00 | [00-introduction.md](./00-introduction.md)           | Purpose, severity, rule ID, RFC 2119 | 5 min     |
| 01 | [01-project-structure.md](./01-project-structure.md) | Package layout, file organization    | 5 min     |
| 02 | [02-naming.md](./02-naming.md)                       | Naming all elements                  | 5 min     |
| 03 | [03-code-style.md](./03-code-style.md)               | Format, imports, braces              | 4 min     |
| 04 | [04-java-idioms.md](./04-java-idioms.md)             | Records, sealed, pattern, VT         | 8 min     |
| 05 | [05-spring-patterns.md](./05-spring-patterns.md)     | DI, config, beans                    | 7 min     |
| 06 | [06-api-design.md](./06-api-design.md)               | REST + ProblemDetail + versioning    | 8 min     |
| 07 | [07-persistence.md](./07-persistence.md)             | JPA, Flyway, @Transactional          | 7 min     |
| 08 | [08-error-handling.md](./08-error-handling.md)       | Exception strategy                   | 5 min     |
| 09 | [09-observability.md](./09-observability.md)         | Logs + metrics + tracing             | 6 min     |
| 10 | [10-testing.md](./10-testing.md)                     | Test pyramid + Testcontainers        | 7 min     |
| 11 | [11-git-workflow.md](./11-git-workflow.md)           | Commits + branches + PR              | 4 min     |
| 12 | [12-quality-gates.md](./12-quality-gates.md)         | Tooling thresholds                   | 4 min     |

**Total**: ~75 phút đọc một lần. Sau đó tra cứu theo nhu cầu.

## Scope

|             Trong scope              |        Ngoài scope        |
|--------------------------------------|---------------------------|
| Java 21 LTS coding                   | DevOps / K8s / Helm       |
| Spring Boot 4 / Framework 7 patterns | Frontend conventions      |
| PostgreSQL + JPA + Flyway            | Network / firewall config |
| REST API + RFC 9457                  | Database administration   |
| Testing với Testcontainers           | Infrastructure as Code    |
| Conventional Commits + SemVer        | Capacity planning         |

## Thay đổi version

|               Action               |                                     Result                                     |
|------------------------------------|--------------------------------------------------------------------------------|
| Add rule additive (không conflict) | Edit file trong `v1/`, bump v1.0 → v1.1 trong file header + log `CHANGELOG.md` |
| Clarify rule (wording)             | Edit + bump patch (v1.1.0 → v1.1.1)                                            |
| Reverse / remove rule              | Tạo `v2/`, copy v1 + sửa, đánh dấu `v1/` `Status: Superseded by v2`            |

## Liên kết

- **Top-level README**: [../README.md](../README.md) — version pointer + scheme
- **CHANGELOG**: [../CHANGELOG.md](../CHANGELOG.md)
