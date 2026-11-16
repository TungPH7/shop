# Changelog — Coding Conventions

Tất cả thay đổi đáng chú ý của bộ tài liệu coding convention được ghi ở đây.
Định dạng theo [Keep a Changelog](https://keepachangelog.com/); đánh version theo [SemVer](https://semver.org/) trong phạm vi mỗi thư mục `vN/`.

- **MAJOR** (`v1/` → `v2/`): rule cũ bị đảo ngược/xóa, gây conflict với code hiện có → tạo thư mục version mới.
- **MINOR**: thêm rule mới không conflict → sửa tại chỗ trong version hiện hành.
- **PATCH**: làm rõ wording, sửa ví dụ, sửa link/typo.

## [Unreleased]

_(Chưa có thay đổi chờ phát hành.)_

---

## v1

### [1.1.1] — 2026-11-16

SHOP-42 (PR #31) gỡ `<Can>`, `usePermission().hasPermission` và `invariant`, nhưng bộ quy ước còn tả chúng (finding Medium và Low của `reviewer` ở PR #31, Task SHOP-47). Bản này chỉ sửa luật cho khớp code đang có, không thêm ràng buộc nào với code, nên là PATCH.

**Fixed**
- `AU-008`: `usePermission()` chỉ trả `{ hasModule(module) }`. Minh chứng: `src/features/auth/hooks/use-permission.ts`.
- `AU-011`: đổi tên thành "Chặn ở tầng route", chỉ còn `ProtectedRoute` và `RequireModule`. Tầng element (`<Can method path>`) thành `[PLANNED]`, tạm ngưng tới Epic đăng nhập, vì các trang sản phẩm của admin ở ngoài `ProtectedRoute` trong Epic SHOP-7 (NFR8).
- `AU-012`, `AU-013`: không còn dựa trên `<Can>`; tầng `app` đọc `usePermission()` rồi bơm vào slot.
- Ví dụ ✅ của `PS-002` ở `03-project-structure.md`: dùng `usePermission().hasModule` thay cho `<Can>`.
- Ví dụ ✅ của `RT-007` ở `07-routing.md` và mục Params của `docs/conventions.md`: thu hẹp `useParams()` bằng `if (!productId) throw …`, không dùng `invariant`.

### [1.1.0] — 2026-11-15

Design system của `admin` (SHOP-8, mục 14 của plan `docs/specs/SHOP-7/plan.md`): CSS variables và CSS thường, không Tailwind hay thư viện UI (NFR13). Mục 15.3 cũ chỉ là hướng `[PLANNED]`, chưa áp dụng khi review, nên thay nó bằng rule mới là thay đổi MINOR, không phải `v2/`.

**Added**
- `UI-011 [MUST] Chỉ dùng token của tokens.css, không tự đặt giá trị`. Minh chứng: `src/styles/tokens.css`, PR #18.
- `UI-012 [MUST] Dùng class của components.css trước khi viết CSS mới`. Minh chứng: `src/styles/components.css`, PR #18.
- `UI-013 [MUST] Không thêm thư viện styling hay thư viện UI`.
- `UI-014 [MUST] Sáng và tối đi qua token, không qua component`. Minh chứng: `light-dark()` trong `tokens.css`, `public/theme-init.js`, `syncThemeToDocument`.
- Checklist PR và bảng anti-pattern ở `20-quick-reference.md` nhắc `UI-011`, `UI-012`.

**Changed**
- `15-ui-and-accessibility.md`: bỏ hướng `[PLANNED]` "Tailwind v4 + `cva`" của 15.3 và câu "UI-agnostic" ở đầu chương. 15.2 đổi tên thành "Hợp đồng props của component dùng chung"; `UI-008` giữ nguyên ý (props mô tả ý định), nhưng không còn nói tới việc thay markup bằng thư viện UI.

**Fixed**
- Ví dụ ở `04-naming-conventions.md` và `09-state-management.md`: `ui-slice.ts` thành `theme-slice.ts`, `toggleTheme` thành `setTheme`, vì PR #18 gỡ slice `ui`.

### [1.0.0] — 2026-07-22

Phát hành lần đầu bộ coding convention, biên soạn bám sát codebase thực tế (`src/`, 124 file) và cấu hình đang chạy (`eslint.config.js`, `tsconfig.base.json`, `.prettierrc.json`, `.lintstagedrc.json`, `.github/workflows/ci.yml`). Gồm 21 tài liệu (00–20).

**Added**

| # | Tài liệu | Nội dung |
|---|---|---|
| 00 | Introduction | Mục đích, scope, severity, rule ID, thứ tự ưu tiên khi xung đột |
| 01 | Tech Stack | Stack đã chốt + chính sách version (LTS/stable, pin exact) |
| 02 | Core Principles | 10 nguyên tắc nền chi phối mọi rule còn lại |
| 03 | Project Structure | Cây `src/`, layering `shared → features → app`, no-barrel, colocation |
| 04 | Naming Conventions | File/folder kebab-case, định danh, test, branch, commit |
| 05 | TypeScript | Tier strictest, cấm `any`, type-at-boundary bằng Zod, `config/env.ts` |
| 06 | Components & Hooks | Bố cục file, props contract, composition, luật `useEffect` |
| 07 | Routing | Data router, route table thuần dữ liệu, typed paths, lazy |
| 08 | API Layer | Factory + singleton, `ApiError`, auth seam, retry, validate tại biên |
| 09 | State Management | Server (Query) · Client (RTK + facade) · URL (nuqs) |
| 10 | Forms & Validation | RHF + zodResolver, schema-first dùng lại |
| 11 | Auth & RBAC | Token seam, profile qua Query, facade, RBAC 2 tầng |
| 12 | Error Handling | 2 họ lỗi, boundary 2 tầng, cache `onError`, quy tắc toast |
| 13 | Observability | Logger · Monitoring · Analytics — 3 seam interface + DI |
| 14 | i18n | State ngôn ngữ ở i18next, namespace lazy, type-safe keys |
| 15 | UI & Accessibility | A11y bắt buộc; hợp đồng headless; styling đánh dấu `[PLANNED]` |
| 16 | Testing | Vitest + RTL + MSW, `renderWithProviders`, coverage ratchet, E2E |
| 17 | Security | XSS một cửa `SafeHtml`, CSP, secrets, supply-chain |
| 18 | Performance | React Compiler, code-split, bundle analysis, virtualization |
| 19 | Tooling · Git · CI | Lệnh chuẩn, hooks, commit, quality gate, workflow CI |
| 20 | Quick Reference | Cheat-sheet + PR checklist + bảng tra cứu |

- Thiết lập hệ thống nhãn `[MUST]` / `[SHOULD]` / `[MAY]`, nhãn `[PLANNED]`, rule ID scheme (17 prefix) và chính sách version 2 cấp.

**Source**

Rule được rút ra từ code đang chạy tại thời điểm phát hành: Phase 1.1 hoàn tất (folder 00–19 của roadmap), 96 unit test + 4 E2E xanh, coverage floor 80/70/75/80.

---

## Template cho lần cập nhật sau

```markdown
### [1.1.0] — YYYY-MM-DD

**Added**
- `XX-NNN [MUST] <tiêu đề>` — <1 câu>. Minh chứng: <commit/PR>.

**Changed**
- `XX-NNN` — làm rõ <điểm nào>.

**Deprecated**
- `XX-NNN` — thay bằng `XX-NNN`.

**Fixed**
- Sửa ví dụ sai ở `NN-<file>.md`.
```
