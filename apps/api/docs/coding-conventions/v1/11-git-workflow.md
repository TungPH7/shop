# 11 — Git Workflow

> **Status:** Active &nbsp;|&nbsp; **Version:** v1.0.0 &nbsp;|&nbsp; **Last updated:** 2026-05-21

Commit message + branch naming + PR conventions.

## Quick reference

|     Item     |                         Format                          |
|--------------|---------------------------------------------------------|
| Branch       | `<type>/<kebab-desc>`                                   |
| Commit       | `<type>(<scope>): <subject>` (Conventional Commits 1.0) |
| PR title     | Cùng format Conventional Commits                        |
| SemVer       | `MAJOR.MINOR.PATCH`                                     |
| Tag          | `v<MAJOR>.<MINOR>.<PATCH>`                              |
| Squash merge | Default                                                 |

---

## Rules

|   ID   |  Severity   |                              Rule                               |
|--------|-------------|-----------------------------------------------------------------|
| GW-001 | 🔴 MUST     | Commit theo Conventional Commits 1.0: `type(scope): subject`    |
| GW-002 | 🔴 MUST     | Subject imperative, lowercase, ≤ 50 chars, không period cuối    |
| GW-003 | 🔴 MUST     | Branch theo `<type>/<kebab-desc>`                               |
| GW-004 | 🔴 MUST     | PR title cùng format CC (squash merge dùng làm commit message)  |
| GW-005 | 🔴 MUST     | Breaking change: `!` sau type/scope + footer `BREAKING CHANGE:` |
| GW-006 | 🟡 SHOULD   | Body khi commit non-trivial (explain WHY)                       |
| GW-007 | 🟡 SHOULD   | Atomic commit — 1 logical change                                |
| GW-008 | 🟡 SHOULD   | PR size ≤ 400 LOC; > 800 phải justify hoặc split                |
| GW-009 | 🔴 MUST NOT | Commit `.env`, credentials, private key                         |
| GW-010 | 🔴 MUST NOT | Force push `main`/`master`                                      |
| GW-011 | 🟢 MAY      | `Co-Authored-By` cho pair programming                           |
| GW-012 | 🔴 MUST     | Tag release `v<SemVer>` (e.g., `v1.0.0`)                        |

---

## GW-001 — Conventional Commits

> 🔴 MUST — Commit format: `<type>(<scope>)<!>: <subject>`.

**Types** (allowed):

|    Type    |                    When                     |     SemVer      |
|------------|---------------------------------------------|-----------------|
| `feat`     | New feature                                 | MINOR           |
| `fix`      | Bug fix                                     | PATCH           |
| `docs`     | Documentation only                          | —               |
| `style`    | Format, whitespace (Spotless apply)         | —               |
| `refactor` | Restructure không thay behavior             | —               |
| `perf`     | Performance improvement                     | PATCH           |
| `test`     | Add/update tests                            | —               |
| `build`    | Build system, dep (`pom.xml`, `Dockerfile`) | —               |
| `ci`       | CI/CD config                                | —               |
| `chore`    | Maintenance khác                            | —               |
| `revert`   | Revert commit trước                         | Theo commit gốc |

**Scope** (recommended cho project):

`product`, `order`, `health`, `api`, `db`, `security`, `logging`, `config`, `deps`, `ci`, `docs`, `test`.

✅ Right:

```
feat(product): add bulk import endpoint
fix(security): close session on logout
docs(api): document RFC 9457 error codes
build(deps): bump spring-boot to 4.0.7
chore(ci): cache maven dependencies
```

❌ Wrong:

```
Added bulk import        # ❌ thiếu type
UPDATE: ...              # ❌ "UPDATE" không phải standard type
wip                      # ❌ không nên commit work-in-progress vào main
```

---

## GW-002 — Subject line

> 🔴 MUST — Imperative, lowercase first word, ≤ 50 chars, không period cuối.

✅ Right:
- `feat(product): add bulk import endpoint`
- `fix(order): prevent negative quantity`

❌ Wrong:
- `feat(product): Added bulk import endpoint`     # ❌ past tense
- `feat(product): adds bulk import endpoint`      # ❌ third person
- `feat(product): Add bulk import endpoint.`      # ❌ period cuối + uppercase
- `feat(product): add the brand new bulk import endpoint that imports products from CSV files` # ❌ > 50 chars

**Test imperative**: "If applied, this commit will __<subject>__"
- ✅ "...will **add bulk import endpoint**"
- ❌ "...will **added bulk import endpoint**"

---

## GW-003 — Branch naming

> 🔴 MUST — `<type>/<kebab-desc>`.

✅ Right:

```
feature/bulk-import
feature/api-versioning
fix/null-price-handler
refactor/extract-validator
docs/coding-conventions
chore/upgrade-spring-boot-4.0.7
ci/cache-maven-deps
```

❌ Wrong:

```
my-feature              # ❌ thiếu type
feature_bulk_import     # ❌ underscore
FeatureBulkImport       # ❌ CamelCase
tungph7/work            # ❌ author prefix
```

---

## GW-004 — PR title

> 🔴 MUST — PR title cùng format Conventional Commits. Squash merge sẽ dùng làm commit message.

GitHub Action enforce:

```yaml
# .github/workflows/pr-lint.yml
name: PR Title Check
on:
  pull_request:
    types: [opened, edited, synchronize]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## GW-005 — Breaking change marker

> 🔴 MUST — Breaking change: `!` sau type/scope + footer `BREAKING CHANGE:` mô tả.

```
refactor(persistence)!: switch ID generator from UUIDv4 to UUIDv7

UUIDv4 random caused index fragmentation. UUIDv7 timestamp-prefix
provides natural sort + better index locality.

BREAKING CHANGE: Existing UUIDv4 IDs remain valid (UUID format
unchanged), but applications relying on lexical comparison for
chronological order must re-sort.
```

→ release-please / git-cliff sẽ bump **MAJOR** version.

---

## GW-006 — Commit body

> 🟡 SHOULD — Non-trivial commit có body explain WHY.

Format:
- Empty line giữa subject và body.
- Wrap 72 chars.
- "What + Why", không "How" (code đã show).

```
fix(product): handle null price in update path

Previously, PATCH /products/{id}/price with null body caused
500 due to missing @NotNull on UpdatePriceRequest.price field.

Now returns 400 with ProblemDetail listing field error. Also
added integration test covering the null path.

Refs #178
```

---

## GW-007 — Atomic commit

> 🟡 SHOULD — Mỗi commit 1 logical change.

✅ Right (multiple commits):

```
feat(product): add bulk import endpoint
fix(product): handle null price in update path
test(product): add integration tests for bulk import
```

❌ Wrong (mixed):

```
feat: add bulk import + fix null price + refactor
```

**Tool**: `git add -p` để stage hunks riêng.

---

## GW-008 — PR size

> 🟡 SHOULD — PR ≤ 400 LOC. > 800 LOC phải justify trong description hoặc split.

**Lý do**: Larger PR → review chậm, miss bug. Studies show defect detection drops sharply over 400 LOC.

**Exception**:
- Initial scaffolding feature mới (1 PR setup full structure).
- Auto-generated file (MapStruct impl, OpenAPI client).
- Renaming/moving (mechanical change).

---

## GW-009 — Không commit secrets

> 🔴 MUST NOT — Commit `.env`, `application-prod.yml` với credentials, private key (`.pem`, `.key`).

`.gitignore`:

```
# Secrets
*.env
**/application-secrets.yml
**/credentials.json
*.pem
*.key
*.p12
```

**Tool** (recommended): `gitleaks` scan trong CI.

---

## GW-010 — Không force push main

> 🔴 MUST NOT — `git push --force` vào `main`/`master` branch.

**Allowed**:
- `git push --force-with-lease` vào branch personal (`feature/*`).

**Never**:
- Force push `main` — destroy others' work + history.

---

## GW-011 — Co-Authored-By

> 🟢 MAY — Pair programming: footer `Co-Authored-By`:

```
feat(product): add bulk import endpoint

Reviewed pair-programming session với colleague.

Co-Authored-By: Colleague Name <colleague@example.com>
```

→ GitHub recognize co-author attribution.

---

## GW-012 — Tag release

> 🔴 MUST — Release tag format `v<SemVer>`.

```bash
git tag -a v1.0.0 -m "Release 1.0.0"
git push origin v1.0.0
```

**Pre-release**:

```bash
git tag -a v1.0.0-rc.1 -m "Release candidate 1"
git tag -a v1.1.0-beta.1 -m "Beta"
```

**Maven version**:

```xml
<version>0.1.0-SNAPSHOT</version>   <!-- Pre-1.0 dev -->
<version>1.0.0</version>             <!-- Production release -->
<version>1.1.0-SNAPSHOT</version>    <!-- Next minor in development -->
```

---

## SemVer summary

|         Change type         | Bump  |      Example      |
|-----------------------------|-------|-------------------|
| Breaking API                | MAJOR | `1.x.x` → `2.0.0` |
| New feature backward-compat | MINOR | `1.1.x` → `1.2.0` |
| Bug fix backward-compat     | PATCH | `1.1.1` → `1.1.2` |

**Pre-1.0**: `0.x.x` không strict SemVer. Reach `1.0.0` khi public API stable.

---

## Code review checklist

|    Aspect    |                     Check                      |
|--------------|------------------------------------------------|
| Title format | `type(scope): subject` đúng format             |
| Scope        | Atomic, không mix unrelated changes            |
| Size         | ≤ 400 LOC; > 800 cần justify                   |
| Tests        | Unit + slice/integration cho behavior mới      |
| Coverage     | JaCoCo gate pass                               |
| Style        | Spotless + Checkstyle pass                     |
| Security     | No secret, no SQL injection path               |
| Docs         | Public API có Javadoc, breaking change có note |

**Comment convention**:
- `nit:` — minor style, không block.
- `q:` / `question:` — clarification.
- `suggestion:` — alternative, optional adopt.
- `must:` / `blocker:` — must fix.

---

## See also

- Conventional Commits: https://www.conventionalcommits.org/en/v1.0.0/
- SemVer: https://semver.org/
- Keep a Changelog: https://keepachangelog.com/
