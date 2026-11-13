# tungph7 codebase — React + TypeScript foundation

**Codebase nền tảng (foundation / boilerplate)** React 19 + TypeScript cho các dự án enterprise 2025–2026 — **không phải một sản phẩm cụ thể**. Thay vì `create vite` rồi tự lắp lại từ đầu (router, state, api, auth, form, test, CI…), bạn clone repo này và đã có sẵn:

- Kiến trúc feature-first + **quy tắc dependency được máy enforce** (ESLint, không phải "niềm tin").
- Quality gate từ commit đầu: lint · format · type-check · test · git hooks · CI.
- Các building block chuẩn: routing, API layer, server/client state, auth + RBAC, form, error handling, logging, i18n, security, performance, CI/CD.
- Một feature mẫu **Product (CRUD)** làm khuôn để nhân bản feature mới.

> **⚠️ Trạng thái thật của repo (đọc trước khi chạy):** Phase 1.1 — core (folders `00`→`19`) **đã hoàn tất**. Toàn bộ phase này **cố ý KHÔNG dùng thư viện UI và KHÔNG style** → giao diện là **HTML thuần, xấu là đúng thiết kế**, không phải lỗi. Mục tiêu là một lõi mà lắp UI nào cũng được; Phase 1.2 (folders `20`→`25`) mới lắp UI adapter (Ant Design / Headless) lên trên **mà không sửa logic**.

---

## Mục lục

1. [Chạy nhanh (dành cho developer)](#1-chạy-nhanh-dành-cho-developer)
2. [Tech stack](#2-tech-stack)
3. [Biến môi trường (bước hay quên nhất)](#3-biến-môi-trường-bước-hay-quên-nhất)
4. [Bảng lệnh](#4-bảng-lệnh)
5. [Trong app có gì để xem](#5-trong-app-có-gì-để-xem)
6. [Cấu trúc thư mục](#6-cấu-trúc-thư-mục)
7. [Quy ước cốt lõi](#7-quy-ước-cốt-lõi)
8. [Test và CI](#8-test-và-ci)
9. [Lỗi thường gặp](#9-lỗi-thường-gặp)
10. [Bản đồ tài liệu](#10-bản-đồ-tài-liệu)

---

## 1. Chạy nhanh (dành cho developer)

**Yêu cầu:** Node **24.17.0** (xem `.nvmrc`) · pnpm **11.8.0** · Git.

```bash
git clone <repo-url> 00-tungph7-codebase1-ui-reactjs
cd 00-tungph7-codebase1-ui-reactjs

corepack enable                     # dùng đúng pnpm 11.8.0 ghi trong package.json
cp .env.example .env.development    # ⚠️ BẮT BUỘC — xem §3. Windows PowerShell:
                                    #   Copy-Item .env.example .env.development
pnpm install                        # lần đầu ~2–5 phút
pnpm dev                            # → http://localhost:5173
```

Mở trình duyệt tại **http://localhost:5173**. Dừng server bằng `Ctrl + C`.

> ### 👤 Bạn là khách hàng / người không rành code?
>
> Đi theo **[docs/getting-started.md](./docs/getting-started.md)** — hướng dẫn từng bước từ số 0 (cài Node, mở terminal, tải source, chạy, tắt), viết cho người **chưa từng lập trình**, kèm bảng xử lý lỗi. Không cần đọc file này.

**Kiểm tra nhanh môi trường trước khi cài:**

```bash
node -v        # kỳ vọng: v24.17.0
pnpm -v        # kỳ vọng: 11.8.0
```

---

## 2. Tech stack

| Nhóm | Công nghệ | Ghi chú |
|---|---|---|
| Runtime / PM | Node 24.17.0 · pnpm 11.8.0 | pin bằng `.nvmrc` + `packageManager` |
| Core | **React 19.2** + **React Compiler** | auto-memo lúc build → hạn chế `useMemo`/`useCallback` tay |
| Ngôn ngữ | **TypeScript 6** (tier *strictest*) | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`… |
| Build | **Vite 8** (Rolldown) | dev server + code-split theo route |
| Routing | **React Router 7** (data router) | `createBrowserRouter`, route table thuần dữ liệu |
| Server state | **TanStack Query 5** | cache/dedupe/invalidate — **không** nhồi vào Redux |
| Client state | **Redux Toolkit 2** + **nuqs** | UI state + state trên URL (search/filter) |
| API | **axios 1.18** + **Zod 4** | 1 instance, `ApiError` chuẩn hoá, retry, validate tại biên |
| Auth | JWT + refresh single-flight, **RBAC** | permission lấy từ backend, không hardcode FE |
| Form | **react-hook-form 7** + zodResolver | dùng **chung** schema Zod với request body |
| i18n | **react-i18next 17** | `en` / `vi`, namespace lazy-load |
| Test | **Vitest 4** + RTL + **MSW** + **Playwright** | unit/integration + E2E, coverage có threshold |
| Chất lượng | ESLint 10 · Prettier 3 · Husky · lint-staged · commitlint | chặn ngay ở commit |
| CI | GitHub Actions | 2 job: `verify` + `e2e` |
| UI library | **(cố ý chưa có)** | Phase 1.2 mới lắp — xem cảnh báo đầu file |

Version được **pin chính xác** (không `^`/`~`) và `pnpm-lock.yaml` được commit → máy bạn, máy đồng đội và CI có cây phụ thuộc **y hệt**.

---

## 3. Biến môi trường (bước hay quên nhất)

`.gitignore` **loại toàn bộ `.env.*`**, chỉ commit `.env.example`. Nghĩa là **clone mới về sẽ KHÔNG có file env** → app **fail-fast lúc boot** (trang trắng + lỗi `[env] Invalid environment variables` trong console). Đây là hành vi có chủ đích (`src/config/env.ts` validate bằng Zod), không phải bug.

| Muốn chạy | File cần tạo | Lệnh |
|---|---|---|
| `pnpm dev` (dev server) | `.env.development` | `cp .env.example .env.development` |
| `pnpm build` / `pnpm preview` (bản production) | `.env.production` | `cp .env.example .env.production` |

Nội dung mặc định đã dùng được ngay — trỏ vào backend demo công khai:

```dotenv
VITE_API_URL=https://ecom-nest.t2g.io.vn
```

**Hai luật bắt buộc nhớ:**

1. Chỉ biến tiền tố `VITE_` mới lọt vào code client — và **mọi giá trị `VITE_*` đều là PUBLIC** (Vite *nướng* thẳng vào bundle trình duyệt). **Không bao giờ** đặt secret ở đây; secret thật chỉ nằm ở server.
2. Giá trị được bake **lúc BUILD**, không phải lúc chạy → đổi môi trường phải **build lại** (SPA tĩnh, khác backend kiểu NestJS đọc `.env` lúc runtime). Thêm biến `VITE_*` mới thì khai thêm ở `src/vite-env.d.ts` và `src/config/env.ts`.

---

## 4. Bảng lệnh

```bash
pnpm dev              # dev server (HMR)          → http://localhost:5173
pnpm build            # tsc -b && vite build      → dist/
pnpm preview          # serve thử bản dist đã build
pnpm build:analyze    # build + treemap bundle    → bundle-stats.html

pnpm typecheck        # chỉ type-check
pnpm lint             # ESLint (boundaries, naming, hooks, a11y, type-aware)
pnpm lint:fix         # ESLint tự sửa
pnpm format           # Prettier ghi đè
pnpm format:check     # Prettier kiểm tra (dùng trong CI)

pnpm test             # unit/integration (Vitest, chạy 1 lần)
pnpm test:watch       # Vitest watch mode
pnpm test:coverage    # coverage + enforce threshold
pnpm e2e              # E2E Playwright (tự khởi động dev server ở cổng 4173)
```

> **Trước lần chạy `pnpm e2e` đầu tiên** phải tải browser một lần:
> `pnpm exec playwright install chromium`
> (Browser **không** tải qua `pnpm install` — postinstall bị chặn bởi chính sách supply-chain.)

**Quality gate — mọi thay đổi phải xanh 4 lệnh:**

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm build
```

---

## 5. Trong app có gì để xem

| Route | Nội dung | Yêu cầu |
|---|---|---|
| `/` | Trang chủ — hiển thị `VITE_API_URL` đang dùng | — |
| `/products` | Danh sách sản phẩm; ô Search lưu **trên URL** (nuqs) | — |
| `/products/:id` | Chi tiết; nút Edit/Delete chỉ hiện khi **đủ quyền** | — |
| `/about` | Trang tĩnh (route lazy-load) | — |
| `/login` | `POST /auth/login` → lưu token → `GET /profile` | tài khoản của backend |
| `/profile` | Thông tin user | đã đăng nhập |
| `/admin`, `/admin/products/:id/edit` | Khu vực quản trị | đăng nhập + có module `role` |
| `/access-denied`, `*` (404) | Trang chặn quyền / không tìm thấy | — |

Trên thanh header (chạy được **không cần đăng nhập**, tốt để nghiệm thu nhanh):

- **Language** `en ⇄ vi` — đổi ngôn ngữ **ngay lập tức**, không reload, và **nhớ lựa chọn** sau khi tắt trình duyệt.
- **Theme / Sidebar toggle** — chứng minh luồng client state (Redux) chạy đúng. *Chưa đổi màu sắc* vì theming thuộc Phase 1.2.

> **📌 Lưu ý trung thực về trang `/products`:** backend demo hiện trả về payload có shape **khác** với model `Product` của repo → trang sẽ hiện `Failed to load products: Response did not match the expected schema`. Đây **đúng là hành vi mong đợi** của nguyên tắc *validate-at-boundary* (Zod chặn dữ liệu sai shape ngay tại biên thay vì để app vỡ ở chỗ khác). Feature Product là **khuôn mẫu**, không phải tích hợp thật với backend đó; E2E test chạy trên API mock nên vẫn xanh. Muốn thấy trang chạy với dữ liệu thật: sửa `src/features/product/model/product.ts` cho khớp contract backend của bạn.

---

## 6. Cấu trúc thư mục

```txt
src/
├── app/          # composition root: routes, layouts, providers, bootstrap
│   ├── layouts/  #   app shell (nav + <Outlet/>)
│   └── routes/   #   route mỏng — chỉ ghép component của feature
├── features/     # feature dọc, tự chứa (auth, product)
│   └── <x>/      #   api/ · components/ · hooks/ · model/
├── components/   # UI dùng chung (form, feedback, i18n, security, virtual)
├── lib/          # hạ tầng: api, auth, i18n, logger, monitoring, react-query…
├── stores/       # Redux store + domain-hook facade (useTheme, useSidebar)
├── config/       # env.ts (Zod-validated) · paths.ts (typed URLs)
├── testing/      # render helper + MSW handlers (không vào prod bundle)
├── styles/ · utils/
└── main.tsx      # entry: setupObservability() → setupAuth() → render

e2e/              # Playwright specs        docs/       # tài liệu ngắn
scripts/          # build-analyze.mjs       study-guide-impl/  # tài liệu học sâu
```

**Luật vàng — dependency một chiều:** `shared → features → app`

- `shared/*` (`components`, `lib`, `stores`, `config`, `utils`, `testing`) **không** import `features/` hay `app/`.
- `features/*` **không** import `app/`, và **không** import feature khác (cấm cross-feature).
- Cần ghép 2 feature? → compose ở tầng `app` (ví dụ: truyền slot `actions` chứa `<Can>` của auth vào `ProductDetail`).
- **Không có barrel file** (`index.ts` re-export) — import thẳng tới file đích.

Tất cả điều trên được **ESLint chặn tự động** (`import-x/no-restricted-paths`, `check-file`) — vi phạm là `pnpm lint` đỏ, không phải chuyện review nhắc nhau.

---

## 7. Quy ước cốt lõi

| Chủ đề | Luật |
|---|---|
| Tên file/folder | **kebab-case** (`product-card.tsx`); component `PascalCase`; hook `useXxx` |
| TypeScript | Không `any`, không `enum`; `interface` cho object/props, `type` cho union |
| Ranh giới dữ liệu | Mọi dữ liệu ngoài (API, env, form, URL, localStorage) **validate bằng Zod khi nhập** |
| State | Server state → TanStack Query · client state → Redux facade · URL state → nuqs |
| Import store | Component **không** import `react-redux`/`@reduxjs/toolkit` — chỉ dùng facade (`useTheme`…) |
| Đường dẫn | Alias `@/*` = `src/*`; URL khai ở `config/paths.ts`, không magic string |
| Commit | Conventional Commits — dự án dùng `feat: <folder-name>`, một dòng |

Git hooks (cài tự động khi `pnpm install`): **pre-commit** chạy ESLint + Prettier trên file staged; **commit-msg** ép Conventional Commits. Lỗi → chặn commit.

📖 Bản đầy đủ (23 mục, kèm *lý do*): **[docs/conventions.md](./docs/conventions.md)** — đọc file này trước khi viết dòng code đầu tiên.

---

## 8. Test và CI

```bash
pnpm test                              # unit + integration (Vitest + RTL)
pnpm test:coverage                     # + enforce coverage threshold
pnpm exec playwright install chromium  # một lần duy nhất
pnpm e2e                               # E2E trên Chromium thật
```

- Test gọi API đi qua **MSW** (mock ở tầng network) → chạy qua **api layer thật** (interceptor, normalize error, Zod) nên sát production; không cần backend để test.
- Coverage threshold là **lưới chống regress**, không phải mục tiêu chạy đua %.
- `pnpm test` / `pnpm e2e` **không** nằm trong pre-commit (chậm) → CI lo.

**CI** (`.github/workflows/ci.yml`, chạy trên mọi PR và push vào `main`) — 2 job song song:

- **`verify`**: install `--frozen-lockfile` → lint → typecheck → format:check → test:coverage → build → `pnpm audit --audit-level=high`.
- **`e2e`**: cài Chromium → `pnpm e2e` → upload Playwright report làm artifact.

CI không có file `.env` (bị gitignore) nên **inject `VITE_API_URL`** qua repo *Variable* (không phải *Secret* — vì `VITE_*` là PUBLIC).

---

## 9. Lỗi thường gặp

| Hiện tượng | Nguyên nhân & cách xử lý |
|---|---|
| Trang trắng, console báo `[env] Invalid environment variables` | Thiếu file env → `cp .env.example .env.development` rồi chạy lại `pnpm dev` |
| `pnpm : command not found` | `corepack enable` (hoặc `npm install -g pnpm@11.8.0`) |
| `cp : The term 'cp' is not recognized` (Windows) | PowerShell dùng `Copy-Item .env.example .env.development` |
| `Port 5173 is in use` | `pnpm dev --port 5174` hoặc tắt tiến trình đang chiếm cổng |
| Lỗi lạ lúc `pnpm install` / `tsc` | Sai version Node → `node -v` phải là `v24.17.0` (dùng nvm/fnm: `nvm use`) |
| `/products` báo `Response did not match the expected schema` | **Đúng như mong đợi** — xem ghi chú ở [§5](#5-trong-app-có-gì-để-xem) |
| `pnpm e2e` báo không tìm thấy browser | `pnpm exec playwright install chromium` |
| `pnpm preview` ra trang trắng | Cần `.env.production` **trước khi** `pnpm build` (env bake lúc build) |
| Commit bị chặn | pre-commit/commitlint đang bắt lỗi — đọc log, sửa, hoặc `pnpm lint:fix` |

Cần bản chi tiết hơn, dành cho người không rành code: **[docs/getting-started.md › Xử lý sự cố](./docs/getting-started.md#xử-lý-sự-cố)**.

---

## 10. Bản đồ tài liệu

README này chỉ là **cửa vào**. Chi tiết nằm ở:

| Tài liệu | Dành cho ai / Nội dung |
|---|---|
| **[docs/getting-started.md](./docs/getting-started.md)** | 👤 Khách hàng, QA, người không rành code — chạy được app từ số 0 |
| **[docs/conventions.md](./docs/conventions.md)** | 👨‍💻 Developer — **luật thực thi** của repo (23 mục), phần lớn enforce bằng ESLint |
| **[study-guide-impl/build-project/](./study-guide-impl/build-project/)** | 🎓 Tài liệu học sâu: **vì sao** mỗi quyết định được chọn, theo từng building block `00`→`19` |
| ↳ [00-overview-architecture](./study-guide-impl/build-project/00-overview-architecture/) | Triết lý, chiến lược 2 phase, 4 kiến trúc *seam*, quy tắc dependency |
| ↳ [01-project-init](./study-guide-impl/build-project/01-project-init/) | Prerequisites, scaffold, config, env |
| ↳ `05` → `19` | Architecture · routing · api · state · auth · form · error · logging · i18n · test · security · performance · CI/CD · feature mẫu |
| **[.github/workflows/ci.yml](./.github/workflows/ci.yml)** | Pipeline thật đang chạy |

---

## Roadmap

- ✅ **Phase 1.1 — Core (00→19):** hoàn tất. Nền tảng UI-agnostic + feature mẫu Product CRUD.
- ⏭️ **Phase 1.2 — UI layer (20→25):** design token, theme sáng/tối, UI contract + alias `@ui`, adapter Headless và Ant Design, hệ responsive.
- 🔜 **Deploy phase:** CSP headers ở edge, refresh token qua httpOnly cookie, SHA-pin actions, CD.
