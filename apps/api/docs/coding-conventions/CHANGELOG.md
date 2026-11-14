# Coding Conventions Changelog

Tất cả thay đổi convention được log ở đây, theo [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

Convention version theo SemVer-like:
- **MAJOR**: rule cũ bị đảo ngược/xóa → tạo folder version mới.
- **MINOR**: thêm rule mới không conflict, hoặc làm rõ rule cũ → edit trong version hiện tại.
- **PATCH**: typo, link fix, format → không bump version, ghi chú nhẹ.

---

## [v1.0.0] — 2026-05-21

### Added

Initial release. 13 file rule + 1 README + 1 CHANGELOG.

- `00-introduction.md` — Purpose, scope, RFC 2119 keywords, severity, rule ID scheme
- `01-project-structure.md` — Package by feature + common, file layout
- `02-naming.md` — Package/class/method/field/test/branch/commit naming
- `03-code-style.md` — Spotless + Checkstyle, line length 120, K&R braces
- `04-java-idioms.md` — Records, sealed, pattern matching, virtual threads
- `05-spring-patterns.md` — Constructor DI, @ConfigurationProperties records, profiles
- `06-api-design.md` — REST URL, HTTP semantics, RFC 9457, versioning
- `07-persistence.md` — JPA entity rules, Flyway, @Transactional, projections
- `08-error-handling.md` — Exception hierarchy + GlobalExceptionHandler + ProblemDetail
- `09-observability.md` — SLF4J + MDC, structured JSON logs, metrics
- `10-testing.md` — Test pyramid, JUnit 5, AssertJ, Testcontainers, slice tests
- `11-git-workflow.md` — Conventional Commits, branch naming, PR
- `12-quality-gates.md` — Spotless/Checkstyle/JaCoCo thresholds + Maven Enforcer

### Source

Convention dựa trên tài liệu chính thức của Java 21, Spring Boot 4, PostgreSQL 17 cùng các RFC liên quan (RFC 2119, RFC 7807/9457, Conventional Commits, SemVer).

---

## Template cho version sau

```markdown
## [v1.1.0] — YYYY-MM-DD

### Added
- New rule `XX-NNN` ... (link to file section)

### Changed
- Clarify rule `XX-NNN` ... wording

### Deprecated
- Rule `XX-NNN` deprecated, replaced by `XX-NNN` in v1.1

### Removed
- (chỉ trong MAJOR version — không xảy ra trong MINOR)

### Fixed
- Typo trong `XX.md`

### Source
- Reference: official Java/Spring/Postgres docs, RFC, hoặc blog kỹ thuật uy tín.
- Decision discussion: link to issue/PR
```
