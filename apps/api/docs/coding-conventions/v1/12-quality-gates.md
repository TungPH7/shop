# 12 — Quality Gates

> **Status:** Active &nbsp;|&nbsp; **Version:** v1.0.0 &nbsp;|&nbsp; **Last updated:** 2026-05-21

Tooling thresholds enforce trước merge. Single source of truth: `pom.xml`.

## Quick reference

|             Tool             |   Phase    |       Block merge?       |
|------------------------------|------------|--------------------------|
| Spotless                     | `validate` | ✅ Yes                    |
| Checkstyle                   | `validate` | ✅ Yes                    |
| Maven Enforcer               | `validate` | ✅ Yes                    |
| Compiler (ErrorProne future) | `compile`  | ✅ Yes (warning as error) |
| JaCoCo gate                  | `verify`   | ✅ Yes                    |
| SpotBugs (future)            | `verify`   | ✅ Yes when enabled       |
| OWASP Dep Check (future)     | `verify`   | ✅ if CVSS ≥ 7            |
| SonarCloud (future)          | CI         | ⚠️ Quality Gate status   |

---

## Rules

|   ID   | Severity  |                               Rule                                |
|--------|-----------|-------------------------------------------------------------------|
| QG-001 | 🔴 MUST   | `./mvnw spotless:check` pass                                      |
| QG-002 | 🔴 MUST   | `./mvnw checkstyle:check` pass                                    |
| QG-003 | 🔴 MUST   | `./mvnw enforcer:enforce` pass                                    |
| QG-004 | 🔴 MUST   | JaCoCo gate pass — bundle/service/controller                      |
| QG-005 | 🔴 MUST   | `./mvnw verify` pass trước push                                   |
| QG-006 | 🔴 MUST   | CI pipeline chạy `validate → test → verify` trong fast-fail order |
| QG-007 | 🟡 SHOULD | Pre-commit hook chạy `spotless:check`                             |
| QG-008 | 🟡 SHOULD | OWASP Dep Check trong CI weekly (CVSS ≥ 7 block)                  |
| QG-009 | 🟢 MAY    | SpotBugs + FindSecBugs khi codebase grow                          |
| QG-010 | 🟢 MAY    | ErrorProne + NullAway sau khi JSpecify stable                     |

---

## Threshold reference

### Spotless (formatter)

|          Aspect          |                  Setting                  |
|--------------------------|-------------------------------------------|
| Formatter                | google-java-format 1.22.0                 |
| Style                    | GOOGLE                                    |
| Reflow long strings      | true                                      |
| Import order             | `java, javax, jakarta, org, com, <other>` |
| Remove unused imports    | yes                                       |
| Trim trailing whitespace | yes                                       |
| End with newline         | yes                                       |

### Checkstyle (style)

|          Rule          |           Threshold            |
|------------------------|--------------------------------|
| `LineLength`           | 120                            |
| `MethodLength`         | 80 (countEmpty=false)          |
| `ParameterNumber`      | 8                              |
| `MagicNumber` allow    | `-1, 0, 1, 2, 100, 1000`       |
| `AvoidStarImport`      | always                         |
| `NeedBraces`           | always                         |
| `EmptyBlock`           | text required                  |
| `VisibilityModifier`   | allow protected + public final |
| `MissingSwitchDefault` | warning                        |
| `TodoComment`          | warning                        |

### Maven Enforcer (build hygiene)

|            Rule            |                                     Setting                                      |
|----------------------------|----------------------------------------------------------------------------------|
| `requireJavaVersion`       | `[21,22)`                                                                        |
| `requireMavenVersion`      | `[3.9,)`                                                                         |
| `dependencyConvergence`    | enabled                                                                          |
| `requireUpperBoundDeps`    | enabled                                                                          |
| `bannedDependencies`       | `junit:junit`, `log4j:log4j`, `slf4j-log4j12`, `HikariCP-java6/7`, `mockito-all` |
| `reactorModuleConvergence` | enabled                                                                          |

### JaCoCo (coverage)

|         Element         |    Line    | Branch |
|-------------------------|------------|--------|
| Bundle (overall)        | ≥ 70%      | ≥ 60%  |
| `**.service` package    | ≥ 85%      | —      |
| `**.controller` package | ≥ 80%      | —      |
| Class miss (line)       | ≤ 30 lines | —      |

**Excluded** (justified):
- `*Application.class` — only `@SpringBootApplication`
- `*MapperImpl.class` — MapStruct generated
- `*Config.class` — only wire bean
- `*Properties.class` — record config
- `dto/**` — record DTOs
- Enum value classes

---

## QG-001 — Spotless check

> 🔴 MUST — Pass trước merge.

```bash
./mvnw spotless:check          # CI uses this
./mvnw spotless:apply           # Local format
```

Fail → block merge. Run `spotless:apply` để fix.

---

## QG-002 — Checkstyle check

> 🔴 MUST — Pass trước merge.

```bash
./mvnw checkstyle:check
```

Config: `checkstyle.xml` + `checkstyle-suppressions.xml`.

Failure: violation severity `error` (Checkstyle config) → block. Warning level (TODO, MissingSwitchDefault) → không block.

---

## QG-003 — Maven Enforcer

> 🔴 MUST — Build hygiene pass.

```bash
./mvnw enforcer:enforce
```

Bị enforce:
- Java 21 LTS.
- Maven 3.9+.
- Dependency convergence (no version conflict).
- Banned deps absent (JUnit 4, Log4j 1.x).

---

## QG-004 — JaCoCo coverage gate

> 🔴 MUST — Coverage threshold pass.

```bash
./mvnw verify    # Bao gồm jacoco:check
```

Khi fail:
- Check coverage report: `target/site/jacoco/index.html`.
- Add test cho file/method còn miss.
- Hoặc justify exclude trong `pom.xml` <excludes> (cần discussion + ADR).

---

## QG-005 — verify trước push

> 🔴 MUST — `./mvnw verify` pass local trước `git push`.

```bash
./mvnw clean verify
```

Bao gồm:
1. `validate` — Spotless + Checkstyle + Enforcer.
2. `compile` — Compile.
3. `test` — Unit + slice tests.
4. `verify` — Integration tests + JaCoCo gate.

---

## QG-006 — CI fast-fail order

> 🔴 MUST — CI pipeline ordered:

```yaml
# Conceptual structure
jobs:
  format:           # 1. Fast — < 1 min
    - ./mvnw spotless:check checkstyle:check enforcer:enforce

  test:             # 2. Medium — < 5 min
    needs: format
    - ./mvnw test -DskipITs

  integration:      # 3. Slow — < 15 min
    needs: test
    - ./mvnw verify    # Includes JaCoCo + Testcontainers

  quality:          # 4. Async (optional)
    needs: integration
    - sonar:sonar (when enabled)
    - dep-check (when enabled)
```

**Lý do fast-fail**: Format fail trong < 1 phút — dev nhận feedback sớm thay vì chờ 15 phút integration test xong mới biết miss space.

---

## QG-007 — Pre-commit hook

> 🟡 SHOULD — Setup `.git/hooks/pre-commit`:

```bash
#!/bin/sh
./mvnw -q spotless:check || {
  echo "❌ Format check failed. Run: ./mvnw spotless:apply"
  exit 1
}
```

```bash
chmod +x .git/hooks/pre-commit
```

**Alternative**: `pre-commit` framework Python với multi-tool support.

---

## QG-008 — OWASP Dep Check (planned)

> 🟡 SHOULD — Add khi project có Spring Security setup credentials.

```xml
<plugin>
    <groupId>org.owasp</groupId>
    <artifactId>dependency-check-maven</artifactId>
    <version>10.0.4</version>
    <configuration>
        <failBuildOnCVSS>7</failBuildOnCVSS>
        <suppressionFiles>
            <suppressionFile>owasp-suppressions.xml</suppressionFile>
        </suppressionFiles>
    </configuration>
    <executions>
        <execution>
            <phase>verify</phase>
            <goals><goal>check</goal></goals>
        </execution>
    </executions>
</plugin>
```

Run weekly trong CI:

```yaml
schedule:
  - cron: '0 0 * * 0'   # Sunday 00:00 UTC
```

---

## QG-009 — SpotBugs (planned)

> 🟢 MAY — Khi codebase grow > 50 classes.

```xml
<plugin>
    <groupId>com.github.spotbugs</groupId>
    <artifactId>spotbugs-maven-plugin</artifactId>
    <version>4.8.6.4</version>
    <configuration>
        <effort>Max</effort>
        <threshold>Medium</threshold>
        <failOnError>true</failOnError>
        <plugins>
            <plugin>
                <groupId>com.h3xstream.findsecbugs</groupId>
                <artifactId>findsecbugs-plugin</artifactId>
                <version>1.13.0</version>
            </plugin>
        </plugins>
        <excludeFilterFile>spotbugs-exclude.xml</excludeFilterFile>
    </configuration>
</plugin>
```

---

## QG-010 — ErrorProne + NullAway (planned)

> 🟢 MAY — Khi JSpecify `@NullMarked` đã stable trên ≥ 50% codebase.

```xml
<plugin>
    <artifactId>maven-compiler-plugin</artifactId>
    <configuration>
        <compilerArgs>
            <arg>-XDcompilePolicy=simple</arg>
            <arg>-Xplugin:ErrorProne \
                -Xep:NullAway:ERROR \
                -XepOpt:NullAway:AnnotatedPackages=com.tungph7 \
                -XepOpt:NullAway:JSpecifyMode=true</arg>
        </compilerArgs>
        <annotationProcessorPaths>
            <path>
                <groupId>com.google.errorprone</groupId>
                <artifactId>error_prone_core</artifactId>
                <version>2.31.0</version>
            </path>
            <path>
                <groupId>com.uber.nullaway</groupId>
                <artifactId>nullaway</artifactId>
                <version>0.11.4</version>
            </path>
        </annotationProcessorPaths>
    </configuration>
</plugin>
```

---

## Skipping quality gates (dev/CI emergency)

**Master skip**:

```bash
./mvnw verify -Dquality.skip=true
```

→ Skip Spotless + Checkstyle + JaCoCo + Enforcer. KHÔNG khuyến nghị thường xuyên.

**Per-plugin**:

```bash
./mvnw verify -Dspotless.skip=true       # only Spotless
./mvnw verify -Dcheckstyle.skip=true      # only Checkstyle
./mvnw verify -Djacoco.skip=true          # only JaCoCo
```

**Use cases acceptable**:
- Hotfix urgent (must justify + create follow-up ticket fix quality after).
- Investigation: locally skip gate để debug nhanh.

**Use cases unacceptable**:
- Bypass CI để merge nhanh.
- "Tôi sẽ fix sau" — không fix sau.

---

## See also

- Config files:
  - `pom.xml` — plugin configs
  - `checkstyle.xml` — Checkstyle rules
  - `checkstyle-suppressions.xml` — suppress patterns
