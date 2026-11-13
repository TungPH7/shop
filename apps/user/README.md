# tungph7-codebase1-ui-nextjs16

> **Codebase nền tảng (foundation) Next.js 16 — server-first, UI-agnostic.**

Đây **không phải** một sản phẩm hoàn chỉnh, mà là **bộ khung dùng lại cho nhiều dự án**: clone về là đã
có sẵn routing, i18n, data layer (BFF), auth, state, form, error handling, observability, security,
SEO, theme, test và CI — thay vì `create-next-app` rồi tự lắp lại từng mảnh.

Ứng dụng demo đi kèm (Trang chủ · About · Products · Caching · Login · Account · Error demo) tồn tại để
**chứng minh từng mảnh chạy thật**, không phải để làm sản phẩm.

**Trạng thái hiện tại:** Phase 1.1 ✅ **hoàn tất** (folder 00–25) — phần lõi server-first.
Phase 1.2 (lớp UI adapter: UI contract `@ui`, shadcn/Antd, Storybook) **chưa làm** → giao diện hiện tại
là HTML + CSS variables thuần, **cố ý chưa có UI library**. Đừng kỳ vọng một giao diện đẹp: giá trị của
repo nằm ở kiến trúc bên dưới.

|                 |                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| **Nhánh chính** | `main` · nhánh phát triển hiện tại `base-1/core-and-ui-agnostic`                                         |
| **Đọc tiếp**    | [Quy ước codebase](docs/conventions.md) · [Tài liệu "vì sao" từng bước](study-guide-impl/build-project/) |

---

## Mục lục

1. [Tech stack](#1-tech-stack)
2. [⚡ Chạy thử trong ~10 phút (không cần biết code)](#2--chạy-thử-trong-10-phút-không-cần-biết-code)
3. [Yêu cầu môi trường](#3-yêu-cầu-môi-trường)
4. [Biến môi trường (.env)](#4-biến-môi-trường-env)
5. [Các lệnh thường dùng](#5-các-lệnh-thường-dùng)
6. [Chạy bản production tại máy](#6-chạy-bản-production-tại-máy)
7. [Bản đồ mã nguồn](#7-bản-đồ-mã-nguồn)
8. [Quy ước quan trọng](#8-quy-ước-quan-trọng)
9. [Kiểm thử](#9-kiểm-thử)
10. [Xử lý sự cố](#10-xử-lý-sự-cố)
11. [Tài liệu chi tiết](#11-tài-liệu-chi-tiết)

---

## 1. Tech stack

| Nhóm                      | Công nghệ                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Runtime · package manager | Node **24.17.0** · pnpm **11.8.0** (pin chính xác, commit lockfile)                                                   |
| Framework                 | **Next.js 16.2.9** (App Router, Turbopack, Cache Components/PPR) · **React 19.2.7**                                   |
| Ngôn ngữ                  | **TypeScript 6** `strict` + `noUncheckedIndexedAccess`                                                                |
| Data                      | **BFF**: DAL `server-only` + native `fetch` → backend NestJS · **Zod 4** ở mọi biên                                   |
| State                     | RSC (mặc định) · **nuqs** (URL) · **TanStack Query** (server-state client) · **Redux Toolkit** (UI state, sau facade) |
| Auth                      | Tự xây: **jose** (JWE) + cookie `__Host-session` httpOnly + RBAC từ backend                                           |
| Form                      | **react-hook-form** + `zodResolver` · Server Actions                                                                  |
| i18n                      | **next-intl 4** (`/en`, `/vi`) — key type-safe                                                                        |
| Theme                     | **next-themes** + design tokens CSS variables (light/dark/system)                                                     |
| Quan sát                  | logger (**pino** ở server) · monitoring seam · analytics seam · `instrumentation.ts`                                  |
| Test                      | **Vitest 4** + RTL (unit/integration) · **Playwright 1.61** + axe (E2E) · **MSW**                                     |
| Chất lượng                | ESLint 9 (flat, type-aware) · Prettier · Husky + lint-staged + commitlint · GitHub Actions                            |

**Luồng dữ liệu (BFF)** — trình duyệt không bao giờ gọi thẳng backend:

```
Trình duyệt ──▶ Next.js server ──▶ Backend NestJS
                (RSC · Server Actions · /api)
                 └─ DAL `server-only` + Zod ở biên
```

---

## 2. ⚡ Chạy thử trong ~10 phút (không cần biết code)

> Phần này dành cho **khách hàng / QA / PM / dev mới** — chỉ cần copy-paste từng lệnh theo thứ tự.
> **Không cần cài database**: dự án dùng sẵn một backend demo công khai trên Internet.

### Bước 0 — Cài 2 phần mềm

| Phần mềm                    | Tải ở đâu                               | Kiểm tra sau khi cài        |
| --------------------------- | --------------------------------------- | --------------------------- |
| **Node.js 24.17.0 trở lên** | <https://nodejs.org> (bản LTS mới nhất) | `node -v` → in ra `v24.x.x` |
| **Git**                     | <https://git-scm.com/downloads>         | `git --version`             |

Sau đó bật **pnpm** (trình quản lý thư viện của dự án) — mở **PowerShell** (Windows) hoặc **Terminal**
(macOS/Linux) và chạy **một** trong hai cách:

```powershell
# Cách A (khuyến nghị — dùng công cụ có sẵn trong Node)
corepack enable pnpm

# Cách B (nếu cách A báo lỗi)
npm install -g pnpm@11.8.0
```

Kiểm tra: `pnpm -v` → in ra `11.8.0`.

> ⚠️ **Chỉ dùng `pnpm`.** Chạy `npm install` hoặc `yarn` sẽ hỏng cây thư viện (dự án khoá bằng
> `pnpm-lock.yaml`).

### Bước 1 — Lấy source code

```powershell
git clone https://github.com/TungPH7/tungph7-codebase1-ui-nextjs16.git
cd tungph7-codebase1-ui-nextjs16
```

> Repo riêng tư → nếu bị hỏi mật khẩu / báo `Repository not found`, hãy xin quyền truy cập, hoặc dùng
> file source được gửi kèm rồi giải nén và `cd` vào thư mục đó.

### Bước 2 — Cài thư viện

```powershell
pnpm install
```

Lần đầu mất khoảng **1–3 phút**. Kết thúc bằng dòng `Done in ...s` là thành công.

### Bước 3 — Tạo file cấu hình `.env`

Vì lý do bảo mật, các file cấu hình **không** được lưu trong repo — bạn phải tự tạo. Ở **thư mục gốc**
dự án (ngang hàng với `package.json`), tạo file tên `.env.development` với **đúng** nội dung sau:

```env
API_URL=https://ecom-nest.t2g.io.vn
NEXT_PUBLIC_SITE_URL=http://localhost:3000
AUTH_SECRET=dev-only-not-a-real-secret-change-me-0123456789
```

Tạo thêm file `.env.production` (chỉ cần khi chạy bản production ở [mục 6](#6-chạy-bản-production-tại-máy)) —
nội dung **giống hệt** file trên.

<details>
<summary>Cách tạo file nhanh bằng lệnh (tuỳ chọn)</summary>

```powershell
# Windows PowerShell
Copy-Item .env.example .env.development
Copy-Item .env.example .env.production
```

```bash
# macOS / Linux / Git Bash
cp .env.example .env.development && cp .env.example .env.production
```

⚠️ `.env.example` chỉ là **template chứa giá trị giả** (`https://api.example.com`) — sau khi copy phải mở
2 file bằng Notepad / VS Code và **dán khối nội dung ở trên đè lên**, nếu không app sẽ không gọi được backend.

</details>

> 🔐 `AUTH_SECRET` ở trên **chỉ dùng để chạy thử trên máy cá nhân**. Khi deploy thật phải tạo khoá ngẫu
> nhiên riêng — xem [mục 4](#4-biến-môi-trường-env).

### Bước 4 — Chạy

```powershell
pnpm dev
```

**Dấu hiệu thành công** — màn hình hiện:

```
▲ Next.js 16.2.9 (Turbopack)
- Local:        http://localhost:3000
- Environments: .env.development
✓ Ready in 9.0s
```

Nếu lệnh báo lỗi, xem ngay [mục 10 — Xử lý sự cố](#10-xử-lý-sự-cố) (2 lỗi đầu tiên xử lý được 90% trường hợp).

### Bước 5 — Mở trình duyệt

Vào **<http://localhost:3000>** (trang sẽ tự chuyển sang `/en` hoặc `/vi` theo ngôn ngữ trình duyệt).
Lần bấm đầu vào mỗi trang sẽ **chậm vài giây** — đó là Next.js đang biên dịch, lần sau sẽ nhanh.

Danh sách trang nên thử để thấy đủ tính năng:

| Đường dẫn                      | Xem được gì                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `/en` · `/vi`                  | Trang chủ · đổi **ngôn ngữ** và **theme sáng/tối** ở đầu trang                                 |
| `/en/products`                 | Danh sách sản phẩm **lấy thật từ backend** · tìm kiếm, sắp xếp, phân trang, đổi grid/list      |
| `/en/caching`                  | Cùng một trang: một phần **cache tĩnh**, một phần **render theo từng request** (PPR)           |
| `/en/error-demo`               | 3 kịch bản lỗi khác nhau và ranh giới nào bắt được lỗi đó                                      |
| `/en/login`                    | Đăng nhập _(cần tài khoản thật trên backend demo — không có vẫn xem được các trang công khai)_ |
| `/sitemap.xml` · `/robots.txt` | SEO sinh tự động                                                                               |

Dừng server: bấm **Ctrl + C** trong cửa sổ terminal.

---

## 3. Yêu cầu môi trường

| Thứ         | Phiên bản            | Ghi chú                                                               |
| ----------- | -------------------- | --------------------------------------------------------------------- |
| Node.js     | **24.17.0+**         | Pin ở `.nvmrc`; `engines.node` chặn bản cũ hơn                        |
| pnpm        | **11.8.0**           | Pin ở `package.json` → `packageManager`                               |
| Git         | bất kỳ               | Cần cho clone + Husky git hook                                        |
| RAM         | ≥ 8 GB (khuyến nghị) | `pnpm build` khá nặng — máy yếu xem [mục 10](#10-xử-lý-sự-cố)         |
| Backend API | _không cần tự dựng_  | Mặc định trỏ tới backend demo công khai `https://ecom-nest.t2g.io.vn` |
| Chromium    | chỉ khi chạy E2E     | `pnpm exec playwright install chromium`                               |

---

## 4. Biến môi trường (.env)

Toàn bộ env được **validate bằng Zod** ở `src/config/env/` → thiếu hoặc sai là `dev`/`build` **chết ngay
lập tức** kèm thông báo rõ, thay vì lỗi mơ hồ lúc chạy.

| Biến                   | Phạm vi    | Ý nghĩa                                                                                        |
| ---------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| `API_URL`              | **server** | URL backend cho DAL. Không lộ ra trình duyệt → nơi đặt URL nội bộ.                             |
| `NEXT_PUBLIC_SITE_URL` | public     | Origin công khai của chính site (không có `/` cuối) — nguồn cho canonical/hreflang/sitemap/OG. Mặc định là origin của Production. |
| `AUTH_SECRET`          | **server** | Khoá niêm phong (mã hoá JWE) cookie phiên đăng nhập. **Tối thiểu 32 ký tự.**                   |

**Next.js nạp file nào?**

| Lệnh                        | File được đọc      |
| --------------------------- | ------------------ |
| `pnpm dev`                  | `.env.development` |
| `pnpm build` · `pnpm start` | `.env.production`  |

→ Tạo **cả hai** file, nếu không `pnpm build` sẽ báo `Invalid environment variables`.

**Tạo `AUTH_SECRET` ngẫu nhiên cho môi trường thật:**

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> 🔐 **Quy tắc secret:** chỉ `.env.example` được commit (đã gitignore mọi `.env*` khác). Secret production
> **thật** chỉ sống trên platform deploy (biến môi trường / secret manager), **không** copy về máy, **không**
> vào repo dù file có được gitignore.

---

## 5. Các lệnh thường dùng

| Lệnh                                | Làm gì                                              |
| ----------------------------------- | --------------------------------------------------- |
| `pnpm dev`                          | Chạy dev server (http://localhost:3000), hot-reload |
| `pnpm build`                        | Build bản production                                |
| `pnpm start`                        | Chạy bản đã build (cần `pnpm build` trước)          |
| `pnpm typecheck`                    | Kiểm tra kiểu TypeScript (`tsc --noEmit`)           |
| `pnpm lint` / `pnpm lint:fix`       | ESLint                                              |
| `pnpm format` / `pnpm format:check` | Prettier                                            |
| `pnpm test` / `pnpm test:watch`     | Unit + integration test (Vitest)                    |
| `pnpm test:coverage`                | Test kèm coverage (**enforce ngưỡng** như CI)       |
| `pnpm e2e`                          | E2E (Playwright) — **cần `pnpm build` trước**       |
| `pnpm e2e:report`                   | Mở báo cáo E2E dạng HTML                            |
| `pnpm analyze`                      | Phân tích kích thước bundle (Turbopack native)      |

**Definition of Done trước khi commit/PR** — đúng 5 gate mà CI sẽ chạy lại:

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
```

---

## 6. Chạy bản production tại máy

Bản production là bản **gần giống deploy thật nhất** (PPR/prerender/streaming chỉ đúng ở đây, `next dev`
render on-demand nên không phản ánh chính xác).

```bash
pnpm build     # đọc .env.production
pnpm start     # http://localhost:3000
```

Trong output của `build`, ký hiệu `◐` cạnh mỗi route nghĩa là route đó **giữ được PPR** (shell tĩnh +
phần động stream sau) — đây là tiêu chí phải giữ khi thêm tính năng mới.

> ⚠️ Deploy thật **bắt buộc Node runtime** (Vercel / self-host `next start` / Docker `output: 'standalone'`).
> `cacheComponents` + PPR **không** hỗ trợ static export và edge runtime. Chi tiết:
> [`study-guide-impl/build-project/25-ci-cd/04-cd-reference.md`](study-guide-impl/build-project/25-ci-cd/).

---

## 7. Bản đồ mã nguồn

```
src/
├── app/                  # CHỈ routing (App Router). Page mỏng — không có business logic.
│   ├── [locale]/         #   mọi trang nằm dưới locale: /en, /vi
│   └── api/              #   Route Handlers (endpoint BFF cho client)
├── features/             # mỗi domain nghiệp vụ = một "ốc đảo" độc lập
│   └── product/          # ⭐ SLICE THAM CHIẾU — copy khuôn này khi thêm feature mới
│       ├── model/        #     type + schema Zod + logic thuần (dễ test nhất)
│       ├── server/       #     DAL `server-only` gọi backend
│       ├── actions/      #     Server Actions ('use server') — mutation
│       ├── api/          #     TanStack Query hooks (phía client)
│       └── components/   #     UI của feature
├── lib/                  # hạ tầng chung: http · auth · errors · logger · monitoring · query · seo · validation
├── components/           # UI dùng chung ≥ 2 feature (theme/language switcher, <Can>, <JsonLd>…)
├── config/               # env (Zod, fail-fast) · i18n · security-headers
├── i18n/                 # next-intl: routing · navigation · request
├── stores/               # facade Redux (feature chỉ gọi hook hướng-domain, không chạm RTK)
├── styles/               # design tokens (CSS variables) + globals
├── testing/              # harness test: renderWithProviders · MSW handlers · stubs
├── proxy.ts              # middleware của Next 16 (i18n routing)
└── instrumentation.ts    # boot: pino sink · onRequestError · MSW-in-server cho E2E

e2e/                      # Playwright specs
messages/                 # en.json · vi.json (i18n)
docs/conventions.md       # LUẬT của codebase
study-guide-impl/          # tài liệu "vì sao" cho từng bước 00–25
```

**Quy tắc phụ thuộc — một chiều, được ESLint chặn tự động:**

```
shared (lib, components, config, i18n, stores, styles, testing)
   ↓
features/<tên>          ← cấm import chéo giữa các feature
   ↓
app/                    ← nơi DUY NHẤT được ghép nhiều feature
```

Cần dùng chung cho 2 feature → **nâng lên `shared`** hoặc **ghép ở `app`**, không import feature này từ feature kia.

---

## 8. Quy ước quan trọng

Bản đầy đủ (25 mục, có giải thích "vì sao") ở **[`docs/conventions.md`](docs/conventions.md)**. Bảy điều
cần nhớ ngay:

- **Server Component là mặc định** — `"use client"` là ngoại lệ, đặt càng sâu (leaf) càng tốt.
- **Import qua alias `~/...`** (→ `src/`), không bao giờ `../../../`. **Không có barrel file** (`index.ts` bị cấm).
- **File và thư mục ngoài `src/app` đặt tên kebab-case**; test đặt cạnh source (`*.test.tsx`).
- **"Parse, don't validate"** — mọi dữ liệu lạ (env, response API, form, searchParams) đi qua Zod; type suy ra từ schema.
- **Đọc env chỉ qua `~/config/env`**, không đọc `process.env` thô.
- **Cache là opt-in, có chủ đích** (`use cache` + `cacheLife` + `cacheTag`), không cache "vô tình".
- **Commit theo Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`…) — commitlint chặn nếu sai.

Pin phiên bản **chính xác** (`x.y.z`, không `^`/`~`) và commit `pnpm-lock.yaml`; CI cài bằng `--frozen-lockfile`.

---

## 9. Kiểm thử

Ba tầng **bổ sung nhau**, không thay thế nhau:

| Tầng            | Lệnh                     | Phủ cái gì                                                                    |
| --------------- | ------------------------ | ----------------------------------------------------------------------------- |
| **Unit**        | `pnpm test`              | Hàm thuần, schema, component đồng bộ, DAL (qua MSW)                           |
| **Integration** | `pnpm test`              | Nhiều seam trong một cây component (Redux + Query + nuqs + i18n cùng tồn tại) |
| **E2E**         | `pnpm build && pnpm e2e` | Render ở **server**, PPR, đổi ngôn ngữ/theme runtime, a11y động (axe)         |

```bash
# Lần đầu chạy E2E: cài trình duyệt
pnpm exec playwright install chromium

pnpm build && pnpm e2e     # E2E chạy trên bản production, port 3100
pnpm e2e:report            # xem báo cáo
```

> **Vì sao E2E quan trọng ở đây:** async Server Component **không** unit-test được (giới hạn chính thức
> của Next) → E2E là nơi _duy nhất_ verify chúng. Backend trong E2E được mock bằng **MSW chạy trong process
> Next** (không phải `page.route`) vì việc fetch diễn ra ở server.

CI (`.github/workflows/ci.yml`) chạy 2 job song song: `verify` (lint → typecheck → format → test+coverage → audit)
và `build-e2e` (build production → Playwright).

---

## 10. Xử lý sự cố

<details open>
<summary><b>❌ <code>'rm' is not recognized...</code> khi chạy <code>pnpm dev</code> / <code>pnpm build</code> (Windows)</b></summary>

Script `dev`/`build` bắt đầu bằng `rm -rf .next` (lệnh Unix). Cách nhanh nhất: chạy thủ công 2 bước —

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
pnpm exec next dev        # hoặc: pnpm exec next build
```

Cách lâu dài: cài **Git for Windows** rồi thêm `C:\Program Files\Git\usr\bin` vào biến môi trường `PATH`.

</details>

<details open>
<summary><b>❌ <code>Invalid environment variables</code></b></summary>

Thiếu hoặc sai file `.env`. Kiểm tra:

- File nằm ở **thư mục gốc** dự án (ngang hàng `package.json`), tên **chính xác** `.env.development` /
  `.env.production` (không phải `.env.development.txt` — Windows hay tự thêm đuôi).
- `pnpm dev` đọc `.env.development`; `pnpm build`/`pnpm start` đọc `.env.production`.
- `AUTH_SECRET` phải **≥ 32 ký tự**; các URL phải đầy đủ `https://...`.

</details>

<details>
<summary><b>❌ Port 3000 (hoặc 3100) đã bị chiếm</b></summary>

```powershell
netstat -ano | findstr :3000
taskkill /F /T /PID <số PID ở cột cuối>
```

> Trên Git Bash phải dùng `taskkill //F //T //PID <pid>` — lệnh `kill` của Git Bash **không** diệt tiến
> trình con của Node, để lại server cũ giữ cổng và phục vụ bản build cũ (rất dễ đánh lừa).

</details>

<details>
<summary><b>⚠️ Trang Products báo "Too many refreshes" / danh sách trống</b></summary>

Backend demo là **dịch vụ công cộng dùng chung có giới hạn số request/phút**. Chờ khoảng 1 phút rồi tải
lại. Đây là hành vi _đã được xử lý có chủ đích_ (lỗi dự kiến → hiện thông báo, giữ trang sống), không phải bug.

</details>

<details>
<summary><b>❌ <code>pnpm build</code> bị treo hoặc báo hết bộ nhớ (OOM)</b></summary>

```powershell
# Windows PowerShell
$env:NEXT_BUILD_LOW_MEM=1; pnpm build
```

```bash
# macOS / Linux / Git Bash
NEXT_BUILD_LOW_MEM=1 pnpm build
```

Cờ này ép build chạy 1 worker (chậm hơn, ít RAM hơn). Nếu vẫn lỗi, thêm `NODE_OPTIONS=--max-old-space-size=4096`.

</details>

<details>
<summary><b>❌ <code>pnpm e2e</code> báo thiếu browser / không khởi động được server</b></summary>

- Cài trình duyệt: `pnpm exec playwright install chromium`
- E2E chạy trên **bản production** → phải `pnpm build` trước.
- Cần có `.env.production`.

</details>

<details>
<summary><b>❌ Commit bị từ chối</b></summary>

- `subject may not be empty` / `type may not be empty` → message phải theo **Conventional Commits**: `feat: mô tả ngắn`.
- Pre-commit tự chạy ESLint + Prettier trên file đã `git add`; nếu ESLint báo lỗi không tự sửa được, sửa
  code rồi commit lại.
- Tải source dạng ZIP (không có thư mục `.git`) → `pnpm install` sẽ cảnh báo về Husky. Không ảnh hưởng việc chạy app.

</details>

<details>
<summary><b>ℹ️ Không đăng nhập được ở <code>/login</code></b></summary>

Cần **tài khoản thật** trên backend demo (repo không kèm tài khoản mẫu). Không có tài khoản thì các trang
công khai (Home, About, Products, Caching, Error demo) **vẫn chạy đầy đủ**.

</details>

---

## 11. Tài liệu chi tiết

README này cố tình **ngắn**. Chi tiết nằm ở:

| Tài liệu                                                                                                   | Nội dung                                                                         |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [`docs/conventions.md`](docs/conventions.md)                                                               | **Luật của codebase** (25 mục) + cách enforce bằng máy. Đọc trước khi viết code. |
| [`study-guide-impl/build-project/00-overview/`](study-guide-impl/build-project/00-overview/)               | Triết lý, mô hình server-first, 7 seam kiến trúc, chiến lược phase               |
| [`study-guide-impl/build-project/23-feature-example/`](study-guide-impl/build-project/23-feature-example/) | **Công thức thêm feature mới** + ma trận truy vết + Definition of Done           |
| [`study-guide-impl/build-project/<01–25>/`](study-guide-impl/build-project/)                               | "Vì sao" của từng quyết định, theo đúng thứ tự đã build                          |
| [`.env.example`](.env.example)                                                                             | Template env — liệt kê mọi biến kèm giải thích                                   |

**Lộ trình tiếp theo:** Phase 1.2 (folder 26–32) — lớp UI adapter: UI contract `@ui`, adapter headless/Antd
chứng minh swap được, Storybook. Và wire CD thật khi chốt hosting.

---

<sub>Tài liệu này mô tả **hiện trạng kỹ thuật thật** của repo, không phải kiến trúc mong muốn. Nếu bạn phát
hiện README lệch với code, hãy sửa README trong cùng PR — docs sai còn tệ hơn không có docs.</sub>
