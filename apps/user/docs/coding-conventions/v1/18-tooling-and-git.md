# 18 — Tooling & Git Workflow

## 18.1 Scripts — `[MUST]` biết

| Lệnh                                         | Việc                                |
| -------------------------------------------- | ----------------------------------- |
| `pnpm dev`                                   | Dev server (port 3000)              |
| `pnpm build` · `pnpm start`                  | Build production · chạy production  |
| `pnpm typecheck`                             | `tsc --noEmit` — **gate**           |
| `pnpm lint` · `pnpm lint:fix`                | ESLint — **gate**                   |
| `pnpm format` · `pnpm format:check`          | Prettier — **gate**                 |
| `pnpm test` · `test:watch` · `test:coverage` | Vitest — **gate**                   |
| `pnpm e2e` · `e2e:report`                    | Playwright — **gate ở CI**          |
| `pnpm analyze`                               | Phân tích bundle (Turbopack-native) |

## 18.2 ESLint — `[MUST]`

Flat config `eslint.config.mjs`, các lớp theo đúng thứ tự:

1. `ignores` — build output, `study-guide-impl/`, `frontend-technical/`
2. `eslint-config-next/core-web-vitals` + `/typescript` (đã gồm react, react-hooks, **jsx-a11y**, `@next/next`)
3. `typescript-eslint` `recommendedTypeChecked` + `projectService` — bật rule cần type info
4. Ranh giới kiến trúc: `import-x/no-restricted-paths` + `no-cycle` + TS resolver (→ §02)
5. Seam Redux: `no-restricted-imports` (→ §10)
6. Security: cấm `dangerouslySetInnerHTML` (→ §14)
7. **`eslint-config-prettier` — PHẢI ĐẶT CUỐI** (tắt rule format trùng; sai thứ tự = xung đột)

Rule chốt cần nhớ:

| Rule                                           | Mức   | Ý nghĩa                                         |
| ---------------------------------------------- | ----- | ----------------------------------------------- |
| `@typescript-eslint/no-explicit-any`           | error | Cấm `any`                                       |
| `@typescript-eslint/consistent-type-imports`   | error | Cặp với `verbatimModuleSyntax`                  |
| `no-floating-promises` · `no-misused-promises` | error | Bắt quên `await`, Promise gắn vào event handler |
| `check-file/filename-naming-convention`        | error | kebab-case mọi file                             |
| `check-file/no-index`                          | error | Cấm barrel                                      |
| `no-console`                                   | warn  | Chừa `warn`/`error`; đi qua `logger` (→ §13)    |

**[MUST]** Không dùng `stylisticTypeChecked` — nó ép `consistent-type-definitions: interface`, ngược với §04.

**Disable rule** chỉ được ở phạm vi **một dòng** và **phải kèm lý do**:

```ts
// eslint-disable-next-line @typescript-eslint/require-await -- 'use cache' là async-by-contract, không có await thật
```

❌ Không disable cả file, ❌ không disable không lý do.

## 18.3 Prettier — `[MUST]`

**Nguồn format DUY NHẤT.** `.prettierrc.json`: `semi` · `singleQuote` · `trailingComma: all` · `printWidth: 100` · `tabWidth: 2` · `arrowParens: always` · `endOfLine: lf`.

❌ Không tranh luận format trong review — chạy `pnpm format`.

## 18.4 Nhất quán môi trường — `[MUST]`

Bộ ba, giá trị phải khớp nhau:

```
.editorconfig  (editor, lúc gõ)  →  .gitattributes (git: * text=auto eol=lf)  →  Prettier (format)
```

`.gitattributes` buộc **LF** mọi nơi → hook shell không vỡ vì CRLF, `format:check` không đỏ trên CI.

## 18.5 Git hooks — `[MUST]`

Husky 9 (`prepare: husky` dựng `.husky/_` khi `pnpm install`). Chỉ commit `.husky/pre-commit` và `.husky/commit-msg`.

| Hook         | Chạy                                                                        |
| ------------ | --------------------------------------------------------------------------- |
| `pre-commit` | `lint-staged` → `eslint --fix` + `prettier --write` trên file **đã staged** |
| `commit-msg` | `commitlint` → ép Conventional Commits                                      |

**[MUST]** Pre-commit **không** chạy test (chậm) — test thuộc về CI.
❌ Không `--no-verify` để bỏ qua hook. Hook đỏ = sửa code.

## 18.6 Commit & branch — `[MUST]`

- Branch: `<type>/<mô-tả-kebab>` — `feat/product-filters`, `fix/session-expiry`.
- Commit theo **Conventional Commits**, subject **một dòng**:
  ```
  feat: thêm bộ lọc sản phẩm theo danh mục
  fix: reset store MSW giữa các lần chạy E2E
  docs: bổ sung chương state management
  ```
  Type: `feat` `fix` `docs` `refactor` `test` `chore` `build` `ci` `perf` `style` `revert`.
- **[SHOULD]** Một commit = một thay đổi logic. Đừng trộn refactor với feature.
- **[MUST]** Thay đổi rule kiến trúc phải đi kèm cập nhật tài liệu này trong **cùng PR** (→ `../README.md` §5).

## 18.7 CI — `[MUST]` hiểu

`.github/workflows/ci.yml`, trigger `push`/`pull_request` lên `main` + `workflow_dispatch`. `concurrency` cancel-in-progress, `permissions: contents: read`.

**Hai job song song:**

| Job         | Các bước                                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `verify`    | install `--frozen-lockfile` → lint → typecheck → format:check → **test:coverage** (enforce threshold) → `audit --audit-level=high` |
| `build-e2e` | install → `playwright install --with-deps chromium` → **build** → e2e → upload `playwright-report`                                 |

⭐ **Build chỉ sống ở `build-e2e`** — E2E cần `next start` nên cần build; một build gác cả "build được" lẫn E2E, tránh build hai lần.

**Env trên CI — `[MUST]`:** CI không có file `.env*` (đã gitignore) → inject qua `env:` của workflow. Thiếu biến thì `next build` **chết ngay** ("Invalid environment variables") — đây là tính năng, không phải lỗi. Giá trị public qua repo **Variables**; `AUTH_SECRET` qua **Secret**.

`HUSKY=0` trên CI (hook thành no-op). `--frozen-lockfile` fail nếu lock lệch.

> ⚠️ `format:check` của CI kiểm **cả** `ci.yml` → file workflow cũng phải đúng chuẩn Prettier, nếu không CI tự làm đỏ chính mình.

## 18.8 Merge — `[MUST]`

- PR chỉ merge khi **cả hai job xanh**. Enforce bằng branch protection ở repo (Ruleset), không phải bằng file trong repo.
- **[SHOULD]** PR có mô tả: làm gì, vì sao, đã verify thế nào (kèm output gate nếu có thay đổi rủi ro).
- Checklist trước khi mở PR → §19.
