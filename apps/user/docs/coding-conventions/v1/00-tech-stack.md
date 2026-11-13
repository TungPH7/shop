# 00 — Tech Stack & Runtime Baseline

> Version đã pin của dự án. Đổi bất kỳ dòng nào trong đây = PR riêng, có lý do, cập nhật lại file này.

## 0.1 Runtime & package manager — `[MUST]`

| Thành phần | Version                                            | Khai ở                               |
| ---------- | -------------------------------------------------- | ------------------------------------ |
| Node.js    | `24.17.0`                                          | `.nvmrc` + `engines.node >= 24.17.0` |
| pnpm       | `11.8.0`                                           | `package.json` → `packageManager`    |
| Bundler    | Turbopack (mặc định Next 16, cả `dev` lẫn `build`) | —                                    |

- **[MUST]** Dùng đúng Node/pnpm đã pin. `nvm use` trước khi làm việc.
- **[MUST]** pnpm chặn build script của dependency theo mặc định → cho phép **tường minh** trong `pnpm-workspace.yaml` → `allowBuilds`. Hiện: `sharp: true` (tối ưu ảnh runtime), `unrs-resolver: false`.

## 0.2 Dependency chính — `[MUST]`

| Nhóm                  | Package                                   | Version            |
| --------------------- | ----------------------------------------- | ------------------ |
| Framework             | `next`                                    | `16.2.9`           |
| UI runtime            | `react` · `react-dom`                     | `19.2.7`           |
| Ngôn ngữ              | `typescript`                              | `6.0.3`            |
| Validation            | `zod`                                     | `4.4.3`            |
| Env                   | `@t3-oss/env-nextjs`                      | `0.13.11`          |
| i18n                  | `next-intl`                               | `4.13.0`           |
| Theme                 | `next-themes`                             | `0.4.6`            |
| Global state          | `@reduxjs/toolkit` · `react-redux`        | `2.12.0` · `9.3.0` |
| Server cache (client) | `@tanstack/react-query`                   | `5.101.1`          |
| URL state             | `nuqs`                                    | `2.8.9`            |
| Form                  | `react-hook-form` · `@hookform/resolvers` | `7.80.0` · `5.4.0` |
| Auth (JWE/JWT)        | `jose`                                    | `6.2.3`            |
| Logging               | `pino`                                    | `10.3.1`           |

Tooling chính (devDependency): `eslint 9.39.4` + `eslint-config-next 16.2.9` + `typescript-eslint 8.62.0` · `prettier 3.8.4` · `vitest 4.1.9` + `@testing-library/react 16.3.2` + `msw 2.14.6` · `@playwright/test 1.61.1` + `@axe-core/playwright 4.12.1` · `husky 9.1.7` + `lint-staged 17.0.8` + `@commitlint/cli 21.1.0`.

> ⚠️ **ESLint giữ ở 9.x**, không nâng 10 — `eslint-config-next@16` chưa tương thích ESLint 10.

## 0.3 Luật pin version — `[MUST]`

- Pin **CHÍNH XÁC** (`"next": "16.2.9"`), **không** `^` / `~`. Lý do: build phải tái lập được (reproducible) giữa máy dev và CI.
- Commit `pnpm-lock.yaml`. CI luôn `pnpm install --frozen-lockfile` (lệch lock = fail).
- Nâng version = PR riêng, đọc changelog, chạy đủ gate (§18), cập nhật bảng ở §0.2.

## 0.4 Cờ Next.js đang bật — `[MUST]` hiểu trước khi sửa `next.config.ts`

| Cờ                       | Giá trị                | Hệ quả                                                                                                   |
| ------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `cacheComponents`        | `true`                 | Dynamic-by-default + opt-in cache + PPR toàn app (→ §07). **Không hỗ trợ static export & edge runtime.** |
| `reactCompiler`          | `true`                 | Auto-memoization, bớt `useMemo`/`useCallback` tay (→ §15).                                               |
| `serverExternalPackages` | `['pino', 'msw']`      | Không bundle 2 package này; Node `require` lúc runtime.                                                  |
| `images.remotePatterns`  | `picsum.photos`        | Allowlist host ảnh remote cho `next/image` (→ §15).                                                      |
| `headers()`              | security headers + CSP | Áp cho mọi response (→ §14).                                                                             |

## 0.5 Luật "no experimental" — `[MUST]`

**Không bật cờ `experimental.*` nào ảnh hưởng runtime app.** Cờ experimental đổi hành vi giữa các patch → vỡ prod không báo trước.

Hai ngoại lệ đã duyệt, đều **không** vào runtime:

1. `experimental.cpus: 1` — chỉ bật khi `NEXT_BUILD_LOW_MEM=1` (escape hatch cho máy RAM thấp; build thật giữ nguyên parallelism).
2. `next experimental-analyze` — lệnh CLI dev-only để phân tích bundle, không phải cờ trong config.

Muốn dùng một API experimental → mở issue/PR bàn trước, ghi lý do + kế hoạch gỡ.

## 0.6 Kiến trúc runtime — `[MUST]` biết

```
Browser ──► Next.js (Node runtime, BFF)  ──► Backend API (NestJS)
            • RSC render + Server Actions
            • DAL `server-only` giữ token/secret
```

- App này là **BFF**: browser **không bao giờ** gọi thẳng backend. Mọi request đi qua server Next (→ §08).
- Deploy **bắt buộc Node runtime** (`next start` / Docker `output: 'standalone'` / platform hỗ trợ Node). `cacheComponents` không chạy trên static export hay edge.
