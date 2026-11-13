# 02 — Project Structure & Architecture Boundaries

> Chương quan trọng nhất khi thêm code mới. Câu hỏi "file này đặt ở đâu?" luôn trả lời được từ đây.

## 2.1 Cây thư mục — `[MUST]`

```
├── e2e/                       # Playwright spec (*.spec.ts) — tách khỏi unit test
├── messages/                  # Catalog i18n: en.json, vi.json
├── public/                    # Asset tĩnh phục vụ nguyên trạng
├── src/
│   ├── app/                   # ⬅ TẦNG 3 — App Router: CHỈ routing
│   ├── features/              # ⬅ TẦNG 2 — domain nghiệp vụ
│   ├── components/            # ⬅ TẦNG 1 (shared) — UI dùng chung ≥2 feature
│   ├── config/                # env, i18n, fonts, security-headers
│   ├── hooks/                 # hook dùng chung
│   ├── i18n/                  # routing / navigation / request của next-intl
│   ├── lib/                   # hạ tầng: http, auth, errors, logger, monitoring,
│   │                          #   analytics, query, seo, validation
│   ├── stores/                # Redux store + facade hướng-domain
│   ├── styles/                # tokens.css (design token)
│   ├── testing/               # harness test: render seam, setup, MSW
│   ├── types/                 # type dùng chung (tạo khi cần)
│   ├── utils/                 # hàm thuần dùng chung (tạo khi cần)
│   ├── instrumentation.ts     # boot hook server + onRequestError
│   └── proxy.ts               # middleware (Next 16 đổi tên từ middleware.ts)
├── next.config.ts · tsconfig.json · eslint.config.mjs · vitest.config.ts
└── playwright.config.ts · global.d.ts
```

- **[MUST]** Thư mục shared **tạo khi cần**, không tạo rỗng sẵn.
- **[MUST]** Alias `~/*` → `./src/*`. Luôn import bằng `~/...`, **không** `../../../` (kể cả trong cùng feature).

## 2.2 Ba tầng, phụ thuộc MỘT CHIỀU — `[MUST]`

```
shared  ──►  features  ──►  app
(lib, components, config, hooks, i18n, stores, styles, testing, types, utils, ui)
```

| Tầng                   | Được import                  | Bị cấm import               |
| ---------------------- | ---------------------------- | --------------------------- |
| **shared**             | shared khác                  | `features/*`, `app/*`       |
| **features/&lt;x&gt;** | shared, chính `features/<x>` | feature **khác**, `app/*`   |
| **app**                | shared, features             | — (đây là composition root) |

- **`app/` là nơi DUY NHẤT được ghép nhiều feature.**
- Cần code chung cho 2 feature → **nâng lên shared** hoặc **ghép ở app**. ❌ Không bao giờ import feature này từ feature kia.

## 2.3 Enforce bằng máy — `[MUST]`

Trong `eslint.config.mjs`:

- `import-x/no-restricted-paths` — sinh "zone" cấm từ hai mảng `SHARED_DIRS` và `FEATURES`.
- `import-x/no-cycle` — cấm vòng lặp import.
- `eslint-import-resolver-typescript` — để boundary "nhìn thấy" được import qua alias `~/`. Không có resolver thì rule mù hoàn toàn với alias.

> **[MUST] Thêm feature mới ⇒ thêm tên vào mảng `FEATURES`** trong `eslint.config.mjs` (đúng 1 dòng). Quên bước này = feature mới không được bảo vệ khỏi import chéo.

## 2.4 Giải phẫu một feature — `[MUST]`

```
src/features/<name>/
├── model/         # type + schema Zod + logic THUẦN (no React, no IO) — dễ test nhất
├── server/        # DAL: gọi backend. BẮT BUỘC `import 'server-only'`
├── actions/       # Server Actions ("use server") — lớp client gọi được
├── api/           # hook TanStack Query (chỉ khi cần fetch phía client)
├── components/    # UI của feature (Server + Client Component)
└── hooks/ store/  # hook headless / client state riêng feature (tạo khi cần)
```

Quy tắc:

- **[MUST]** `server/` và `actions/` **tách nhau**. `server/` là `server-only` (không bao giờ ra client); `actions/` là endpoint client gọi được.
- **[MUST]** Không đặt schema/type trong file `"use server"` — file đó chỉ được export hàm async. Schema thuộc `model/`.
- **[SHOULD]** `model/` phải thuần: không import React, không IO. Đây là nơi test rẻ nhất.
- **[SHOULD]** Component hiển thị tách thành **view đồng bộ** thuần (nhận props, không `await`) để unit-test được; phần async nằm ở orchestrator (→ §05, §17).

**Feature tham chiếu:** `src/features/product/` đã ráp đủ 5 thư mục — soi theo khi tạo feature mới.

## 2.5 `app/` chỉ chứa routing — `[MUST]`

`src/app/**` chỉ được có: `layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `global-error.tsx`, `route.ts`, `sitemap.ts`, `robots.ts`, `opengraph-image.tsx`, `icon.svg`.

`page.tsx` **mỏng**: `await` params → gọi vào feature → render. ❌ Không business logic, không gọi backend trực tiếp trong `app/`.

## 2.6 Anti-patterns — `[MUST]` tránh

| ❌ Anti-pattern                                                    | ✅ Thay bằng                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------- |
| `import { x } from '~/features/auth/...'` trong `features/product` | Nâng lên `~/lib` hoặc ghép ở `app/`                     |
| `index.ts` re-export (barrel)                                      | Import trực tiếp file đích (`check-file/no-index` chặn) |
| `import ... from '../../lib/http/client'`                          | `import ... from '~/lib/http/client'`                   |
| Business logic trong `app/[locale]/products/page.tsx`              | Chuyển vào `features/product/`                          |
| Gọi `fetch` backend trong Client Component                         | DAL ở `features/<x>/server/` (→ §08)                    |
| Thư mục shared rỗng tạo sẵn "cho tương lai"                        | Tạo khi có file đầu tiên                                |

## 2.7 Checklist thêm feature mới — `[MUST]`

1. Tạo `src/features/<name>/` với các thư mục **thật sự cần** (thường: `model` → `server` → `components`).
2. Thêm `'<name>'` vào mảng `FEATURES` ở `eslint.config.mjs`.
3. Thêm namespace i18n vào `messages/en.json` + `messages/vi.json` (→ §11).
4. Tạo route mỏng trong `src/app/[locale]/<route>/page.tsx`.
5. Chạy đủ gate: `typecheck` · `lint` · `format:check` · `test` · `build` (route mới phải hiện `◐` — xem §07) · verify tay bằng `next dev`.
