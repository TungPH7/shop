# learn-postgresql-api

Spring Boot 4 + PostgreSQL 17 base codebase — bộ khung "enterprise-grade" cho mọi feature về sau.

Mục tiêu của repo:

- Một **base codebase** Java 21 / Spring Boot 4 dùng lại được cho mọi feature về sau (User,
  Auth/JWT, Order, ...).
- Học PostgreSQL có chiều sâu (extensions, schema, migration, JPA, JOIN, transaction, index).
- Lab cho mọi practice cần có khi đi làm: Flyway, MapStruct, Bean Validation, ProblemDetail (RFC
  7807), correlation-id logging, Spring Security baseline, Testcontainers, Spotless + Checkstyle +
  JaCoCo, Docker multi-stage, GitHub Actions CI/CD.

> README này chỉ là entry point. Tài liệu chi tiết nằm ở `docs/coding-conventions/`.

---

## 1. Tech stack

|    Layer    |                                 Tool                                 |
|-------------|----------------------------------------------------------------------|
| Language    | Java 21 (LTS)                                                        |
| Framework   | Spring Boot 4.0.6                                                    |
| Persistence | Spring Data JPA + Hibernate + HikariCP                               |
| Database    | PostgreSQL 17                                                        |
| Migration   | Flyway                                                               |
| Mapping     | MapStruct 1.6                                                        |
| API doc     | springdoc-openapi (Swagger UI)                                       |
| Logging     | Logback + logstash-logback-encoder (JSON), correlation-id            |
| Security    | Spring Security baseline (headers, CORS, CSP, HSTS)                  |
| Test        | JUnit 5 + Testcontainers 2.x (postgres)                              |
| Quality     | Spotless (google-java-format) + Checkstyle + JaCoCo + Maven Enforcer |
| Container   | Multi-stage Dockerfile, layered JAR, non-root user                   |
| CI/CD       | GitHub Actions (`ci.yml` + `release.yml`) + Dependabot               |

---

## 2. Yêu cầu môi trường

- **JDK 21** (LTS) — Maven Enforcer chặn build nếu không phải 21.x.
- **Maven Wrapper** đi kèm repo (`./mvnw`) — không cần cài Maven global.
- **Docker Engine 24+** với BuildKit (default từ 23+).
- Git Bash (Windows) hoặc bash/zsh (Linux/macOS) để chạy script `.sh`.

### Windows dev — bắt buộc cấu hình trước khi clone

Git mặc định trên Windows chuyển line ending sang CRLF khi checkout. Init script
`docker/postgres/init/00-load-env.sh` chạy bên trong container Linux — nếu file bị CRLF, shebang
`#!/bin/bash` trở thành `#!/bin/bash\r` → init fail → role app không được tạo → app báo
`password authentication failed`.

```bash
git config --global core.autocrlf input    # checkout giữ LF, commit normalize về LF
```

Repo đã có `.gitattributes` với `* text=auto eol=lf` để chốt lại — nhưng config trên đảm bảo Git
tôn trọng rule ngay từ lần checkout đầu tiên.

---

## 3. Quick start

```bash
# 1. Clone + tạo file env từ template
cp .env.example .env
# (chỉnh sửa POSTGRES_PASSWORD, POSTGRES_ROOT_PASSWORD nếu cần)

# 2. Khởi động Postgres (lần đầu sẽ chạy init script — xem mục 4)
docker compose up -d postgres

# 3. Set JDK 21 cho shell hiện tại (Git Bash trên Windows)
export JAVA_HOME="/c/Program Files/Java/jdk-21"
export PATH="$JAVA_HOME/bin:$PATH"

# 4. Chạy app với profile dev, load biến môi trường từ .env
./scripts/load-env.sh ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# 5. Smoke test
curl -s http://localhost:8080/actuator/health
# {"status":"UP"}

# 6. Swagger UI
# http://localhost:8080/swagger-ui.html
```

Hoặc chạy full stack (app + DB) trong Docker:

```bash
docker compose up -d --build
docker compose ps          # cả 'learn-postgres' và 'learn-app' phải healthy
curl localhost:8080/actuator/health
```

---

## 4. Postgres init lần đầu

Khi container Postgres khởi động lần đầu (volume `postgres_data` rỗng), script
`docker/postgres/init/00-load-env.sh` chạy tự động bên trong container và làm 4 việc trên
database `${POSTGRES_DB}`:

1. **Tạo app role** `${APP_DB_USER}` (= `POSTGRES_USER` trong `.env`) với password riêng và quyền
   `CONNECT` + `CREATE` trên DB — tách biệt với superuser `postgres`.
2. **Bật 4 extension** mà app sẽ dùng:
   - `uuid-ossp` — sinh UUID phía DB.
   - `pgcrypto` — hash/encrypt (gen_random_uuid, crypt, digest).
   - `citext` — case-insensitive text (email, username).
   - `pg_trgm` — fuzzy search / GIN index trên text.
3. **Tạo schema `app`** owned by app role (search_path mặc định = `app, public`).
   Flyway migration chạy trong schema này (`spring.flyway.schemas: app`).
4. **Default privileges** trên schema `app` — table/sequence tạo sau này tự grant cho app role.

> Init script **chỉ chạy lần đầu**. Muốn re-init: dừng compose, `docker volume rm
> learn-postgres-data` rồi `docker compose up -d` lại. Extension và schema đã được Flyway
> "baseline" (`baseline-on-migrate: true`, `baseline-version: 0`) nên migration `V1__init.sql` chạy
> tiếp ngay trên state đã có sẵn.

---

## 5. Chạy source code

### 5.1. Đảm bảo đúng JDK version

Enforcer plugin sẽ fail build nếu không phải Java 21. Trên Windows + Git Bash:

```bash
export JAVA_HOME="/c/Program Files/Java/jdk-21"
export PATH="$JAVA_HOME/bin:$PATH"

java -version       # phải in "openjdk version 21.x.x"
./mvnw -v
```

Linux/macOS dùng `sdkman` hoặc set `JAVA_HOME` tương đương.

### 5.2. Chạy với `.env` + profile mong muốn

Helper script `scripts/load-env.sh` đọc `.env` rồi `exec` lệnh kế tiếp với biến môi trường đã
load:

```bash
# dev (default) — Postgres ở localhost:5432, log human-readable
./scripts/load-env.sh ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# staging — gần với prod, JSON log
./scripts/load-env.sh ./mvnw spring-boot:run -Dspring-boot.run.profiles=staging

# prod — CSP siết, HSTS preload, log JSON Logstash format
./scripts/load-env.sh ./mvnw spring-boot:run -Dspring-boot.run.profiles=prod

# chạy JAR đã package
./scripts/load-env.sh java -jar target/learn-postgresql-api-*.jar
```

Mặc định `ENV_FILE=.env`. Đổi file env:

```bash
ENV_FILE=.env.staging ./scripts/load-env.sh ./mvnw spring-boot:run
```

> Có 4 profile tách trong `src/main/resources/`: `application.yml` (chung) + `application-dev.yml`
> / `-staging.yml` / `-prod.yml` / `-test.yml` (chỉ dùng cho Testcontainers).

### 5.3. Chạy trong IDE (IntelliJ)

Run config `LearnPostgresqlApiApplication`:

- **Environment variables**: dùng plugin "EnvFile" để load `.env`, hoặc khai báo thủ công.
- **VM options**: `-Dspring.profiles.active=dev`.
- **JDK**: chọn Project SDK = Java 21.

---

## 6. Chạy test

Test stack dùng **Testcontainers** — mỗi `@SpringBootTest` / `@DataJpaTest` tự spin up 1
container Postgres ephemeral (`AbstractContainerBaseTest`). **Cần Docker đang chạy** trên máy
local hoặc CI.

```bash
# Toàn bộ test (unit + slice + integration)
./mvnw test

# Chỉ 1 class
./mvnw test -Dtest=ProductServiceTest

# Test + coverage report
./mvnw verify
# → target/site/jacoco/index.html
```

> Test KHÔNG cần `.env` — Testcontainers tự tạo container Postgres riêng, bind credential qua
> `@ServiceConnection`. Container của `docker-compose` (port 5432) không liên quan tới test.

---

## 7. Quality gates

Build chạy `./mvnw verify` sẽ enforce 4 layer tự động (bind vào phase `validate` hoặc `verify`):

|               Tool                |                      Vai trò                      |       Phase        |                                 Fail khi                                 |
|-----------------------------------|---------------------------------------------------|--------------------|--------------------------------------------------------------------------|
| **Spotless** + google-java-format | Auto-format Java + pom + yaml + markdown          | `validate` (check) | Có file chưa format                                                      |
| **Checkstyle**                    | Naming, javadoc, magic number, line length...     | `validate`         | Vi phạm rule trong `checkstyle.xml`                                      |
| **JaCoCo**                        | Đo coverage từ test                               | `verify` (check)   | Bundle line < 70%, branch < 60%; package service < 85%; controller < 80% |
| **Maven Enforcer**                | Java version, dependency convergence, banned deps | `validate`         | Sai version, conflict, dùng dep cấm (junit 4, log4j 1.x, ...)            |

### 7.1. Format toàn repo trước khi commit

```bash
./mvnw spotless:apply       # tự format Java + pom + yaml + markdown
```

### 7.2. Check nhanh không chạy test

```bash
./mvnw validate             # chỉ Spotless + Checkstyle + Enforcer (vài giây)
```

### 7.3. Skip quality gate (chỉ khi cần)

```bash
./mvnw verify -Dquality.skip=true                       # tắt cả 3 tool quality
./mvnw verify -Dspotless.skip=true -Dcheckstyle.skip=true   # chỉ JaCoCo
./mvnw verify -Djacoco.skip=true                        # chỉ Spotless + Checkstyle
```

CI vẫn chạy đầy đủ — flag này dùng để debug local thôi.

### 7.4. JaCoCo coverage report

Sau `./mvnw verify`:

```
target/site/jacoco/index.html
```

Mở browser xem coverage per package / class. Threshold cấu hình trong `pom.xml`:

- Bundle (toàn project): LINE ≥ 70%, BRANCH ≥ 60%.
- Package `feature.*.service` (critical): LINE ≥ 85%.
- Package `feature.*.controller`: LINE ≥ 80%.
- Class: mỗi class missed line ≤ 30.

DTO record, `@Configuration`, MapStruct generated impl... được exclude rõ ràng — không inflate
coverage giả.

---

## 8. Pre-commit hook (Spotless + Checkstyle staged)

Repo dùng cơ chế `core.hooksPath` (Git 2.9+) — hook script nằm trong `.githooks/`, commit cùng
repo. Mỗi dev sau khi clone chạy **1 lệnh duy nhất**:

```bash
git config core.hooksPath .githooks
git config --get core.hooksPath        # phải in ".githooks"
```

Từ đó, mỗi `git commit`:

1. Lọc file **staged** (Added/Copied/Modified/Renamed).
2. Chạy `spotless:apply` chỉ trên các file staged khớp pattern của Spotless config (Java, pom,
   yaml, markdown). Nếu Spotless sửa gì, hook tự `git add` lại.
3. Chạy `checkstyle:check` trên các file `src/main/java/**.java` staged.

Commit bị block nếu Checkstyle vi phạm. Spotless thì tự fix + re-stage.

```bash
# Bypass tạm thời khi WIP — CI vẫn enforce
git commit --no-verify -m "wip: ..."
```

> Hook chỉ chạy trên file đã staged → commit nhanh (~1-2s), không reformat file dev không touch.
> Whole-project check là việc của `./mvnw verify` trong CI (xem `.github/workflows/ci.yml`).

---

## 9. Cấu trúc project

```
.
├── src/main/java/com/tungph7/learnpostgres/
│   ├── LearnPostgresqlApiApplication.java
│   ├── common/                  # cross-cutting
│   │   ├── config/              # @Configuration beans
│   │   ├── domain/              # BaseEntity + JPA auditing + CitextType
│   │   ├── dto/                 # ApiResponse, PageResponse, ...
│   │   ├── error/               # ProblemDetail (RFC 7807), GlobalExceptionHandler
│   │   ├── logging/             # correlation-id filter, MDC, JSON log
│   │   └── security/            # SecurityConfig, headers, CORS, CSP, HSTS
│   ├── feature/                 # feature module (vertical slice)
│   │   ├── health/              # /api/health
│   │   └── product/             # CRUD demo: controller / service / repo / mapper / dto / domain
│   └── infrastructure/          # gateway/adapter ra ngoài (sau này)
├── src/main/resources/
│   ├── application.yml          # config chung
│   ├── application-{dev,staging,prod,test}.yml
│   ├── db/migration/            # V1__init.sql, V2__app_helpers.sql, V3__create_products_table.sql
│   └── logback-spring.xml
├── src/test/java/.../
│   └── AbstractContainerBaseTest.java   # Testcontainers Postgres parent
├── docker/postgres/init/00-load-env.sh  # extensions + schema (mục 4)
├── scripts/load-env.sh                  # exec lệnh với .env loaded
├── .githooks/pre-commit                 # Spotless + Checkstyle staged
├── .github/workflows/                   # ci.yml, release.yml
├── checkstyle.xml + checkstyle-suppressions.xml
├── docker-compose.yml + Dockerfile + .dockerignore
└── docs/
    └── coding-conventions/v1/   # 13 file convention (naming, code-style, Spring, JPA, ...)
```

---

## 10. Endpoint chính

|        Endpoint        |               Mô tả                |
|------------------------|------------------------------------|
| `GET /actuator/health` | Liveness + readiness               |
| `GET /actuator/info`   | Build info                         |
| `GET /v3/api-docs`     | OpenAPI JSON                       |
| `GET /swagger-ui.html` | Swagger UI                         |
| `/api/products/**`     | CRUD demo (xem `feature/product/`) |

---

## 11. Convention nhanh

- **Migration**: thêm SQL ở `src/main/resources/db/migration/V{n}__name.sql`. Không sửa file cũ
  đã apply (Flyway sẽ fail checksum).
- **Không expose entity**: controller trả DTO, dùng MapStruct mapper.
- **Không bắt `Exception`**: throw error code rõ, để `GlobalExceptionHandler` map sang
  ProblemDetail.
- **Log cần correlation-id**: filter tự bơm vào MDC từ header `X-Correlation-Id`, log JSON pickup
  tự động.
- **Conventional commits** + branch theo prefix (`feat/`, `fix/`, `docs/`, `chore/`).
- **`.env` không commit**, chỉ `.env.example`.

Full convention: `docs/coding-conventions/v1/README.md`.

---

## 12. Đọc thêm

- **Coding conventions**: `docs/coding-conventions/v1/`.

---

## License

Internal / learning project. Image labels (`org.opencontainers.image.licenses`) đề "MIT" —
adjust theo nhu cầu thật khi public.
