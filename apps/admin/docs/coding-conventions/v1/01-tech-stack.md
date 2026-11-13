# 01 — Tech Stack & chính sách version

> Stack đã chốt. Muốn thêm/đổi thư viện ⇒ đọc §1.3 trước.

## 1.1 Stack

| Lớp | Lựa chọn | Ghi chú |
|---|---|---|
| Runtime / package manager | **Node 24 LTS** · **pnpm** | Version pin ở `.nvmrc` + `packageManager` |
| Library | **React 19** | Function component; không viết class mới (trừ Error Boundary) |
| Compiler | **React Compiler v1** | Auto-memo lúc build → xem `18-performance.md` |
| Language | **TypeScript** (tier strictest) | `05-typescript.md` |
| Build tool | **Vite** | SPA thuần client; không SSR |
| Router | **React Router v7** (data router) | `07-routing.md` |
| Server state | **TanStack Query v5** | `09-state-management.md` |
| Client state | **Redux Toolkit** + `react-redux` | Truy cập **chỉ** qua facade hook |
| URL state | **nuqs** | Filter/search/pagination |
| HTTP client | **axios** | Bọc trong `src/lib/api/` |
| Schema & validation | **Zod v4** | Nguồn sự thật cho type tại mọi ranh giới |
| Form | **react-hook-form** + `@hookform/resolvers` | `10-forms-and-validation.md` |
| i18n | **react-i18next** + `i18next` | `14-i18n.md` |
| Error boundary | **react-error-boundary** | Không tự viết |
| Sanitize HTML | **DOMPurify** | Gọi qua đúng một module |
| Lint / format | **ESLint 10 (flat config)** + **Prettier** | `19-tooling-git-ci.md` |
| Test | **Vitest** + **RTL** + **MSW** + **Playwright** | `16-testing.md` |
| CI | **GitHub Actions** | `.github/workflows/ci.yml` |

**Số version cụ thể là `package.json`** — file này chỉ giữ *chính sách*. Không chép số version vào tài liệu (chắc chắn sẽ lệch).

## 1.2 Rule về version

### SK-001 [MUST] Pin exact version cho mọi dependency

`package.json` ghi số chính xác, không `^` / `~`. Nâng version là hành động có chủ đích, đi kèm PR riêng.

✅ `"react": "19.2.7"` ❌ `"react": "^19.2.7"`

**Enforce:** review + `pnpm install --frozen-lockfile` trong CI.

### SK-002 [MUST] Chỉ dùng bản stable/LTS trong quality gate

Không đưa bản `alpha` / `beta` / `RC` vào nhánh chính hay vào CI. Muốn thử nghiệm → nhánh riêng, không merge.

### SK-003 [MUST] Node version lấy từ một nguồn duy nhất

`.nvmrc` là SSOT của Node version; CI đọc qua `node-version-file`. pnpm version lấy từ `packageManager` trong `package.json`. Không hardcode số version trong workflow.

### SK-004 [SHOULD] Thêm dependency mới phải có lý do đánh đổi

Trước khi thêm một thư viện, trả lời được: (a) code hiện có giải quyết được không? (b) kích thước bundle thêm bao nhiêu? (c) có tree-shake được không? (d) ai maintain, còn active không?

Ưu tiên **0 dependency mới** khi thứ cần chỉ là ~50 dòng code thuần (vd retry, persistence, pub/sub store).

### SK-005 [MUST] Devtool/analyzer không được lọt vào bundle production

Thư viện chỉ phục vụ dev (React Query Devtools, bundle visualizer) phải nằm ở `devDependencies` **và** được nạp có điều kiện (`import.meta.env.DEV`, lazy import, hoặc plugin gated bằng env) để tree-shake khỏi bản prod.

**Enforce:** kiểm bằng `pnpm build:analyze` khi nghi ngờ.

## 1.3 Đổi hoặc thêm thành phần stack

Thay một lựa chọn ở bảng §1.1 là **thay đổi kiến trúc**, không phải refactor:

1. Mở đề xuất nêu vấn đề của lựa chọn hiện tại + phương án + chi phí migrate.
2. Nếu được duyệt: implement sau **seam** sẵn có (facade hook, interface + DI) để call-site không đổi — xem `09`, `13`.
3. Cập nhật bảng §1.1 + `CHANGELOG.md`. Đổi làm rule cũ mất hiệu lực ⇒ lên `v2/`.
