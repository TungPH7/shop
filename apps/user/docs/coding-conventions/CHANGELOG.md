# Changelog — Coding Conventions

Tất cả thay đổi đáng chú ý của bộ tài liệu coding convention được ghi ở đây.
Định dạng theo [Keep a Changelog](https://keepachangelog.com/); đánh version theo [SemVer](https://semver.org/) trong phạm vi mỗi thư mục `vN/`.

## [Unreleased]

_(Chưa có thay đổi chờ phát hành.)_

---

## v1

### [1.1.1] — 2026-11-16

SHOP-45 (PR #32) gỡ TanStack Query, `nuqs`, `<Can>`, `hasPermission` và `httpDelete` vì không còn chỗ dùng, nhưng bộ quy ước còn bắt buộc hay tả chúng (finding Medium của `reviewer` ở PR #32, Task SHOP-48). Bản này chỉ sửa luật cho khớp code đang có và plan `docs/specs/SHOP-7/plan.md`, không thêm ràng buộc nào với code, nên là PATCH.

**Fixed**

- `10-state-management.md`: thang ưu tiên §10.1 còn bốn bậc (RSC + DAL, URL, Redux, `useState`). §10.4 TanStack Query thành "Server-state phía client — tạm ngưng": cần dữ liệu mới thì đổi URL hay `router.refresh()` (plan, Architecture Decisions 10). §10.5 URL state là `searchParams` đọc ở server trong `<Suspense>`, ghi bằng `~/i18n/navigation`, thay cho `nuqs`. §10.6 chỉ còn `StoreProvider`. Minh chứng: `src/app/[locale]/products/page.tsx`, `package.json`.
- `14-security-auth-config.md` §14.4: chỉ còn `hasModule`; guard mức element (`<Can>`, `hasPermission`) thành tạm ngưng, vì `user` không có lệnh ghi sản phẩm (NFR8). Minh chứng: `src/lib/auth/permissions.ts`.
- `17-testing.md`: `renderWithProviders` bọc Redux và i18n; §17.7 bỏ bẫy singleton của TanStack và ví dụ `nuqs`. Minh chứng: `src/testing/render.tsx`, `src/testing/harness.test.tsx`.
- `19-quick-reference.md`: bỏ dòng "Hook TanStack Query"; URL state và dữ liệu mới sau khi tải theo §10.
- `00-tech-stack.md`: bỏ `@tanstack/react-query` và `nuqs`; `next` và `eslint-config-next` là 16.4.6, `zod` là 4.6.7, như `package.json`.
- Các chỗ nhắc lại: `02-project-structure.md` (bỏ `lib/query` và `features/<x>/api/`), `03-naming-conventions.md`, `05-server-and-client-components.md`, `06-routing-and-navigation.md`, `07-rendering-and-caching.md`, `09-server-actions-and-forms.md` (DAL dùng `httpPost` / `httpPut`), `15-performance.md`.
- `docs/conventions.md` (nhật ký build, không phải SSOT): ghi chú phần đã gỡ ở SHOP-18 và SHOP-45 tại các mục 12, 14, 15, 20, 23, 24.

### [1.1.0] — 2026-11-15

Design system của `user` (SHOP-10, mục 14 của plan `docs/specs/SHOP-7/plan.md`): CSS variables và CSS thường, không Tailwind hay thư viện UI (NFR13). Plan đặt tên `src/styles/components.css` và đã được duyệt ở gate ②, nên sửa §12.6 theo plan là MINOR, không phải `v2/`: bộ quy ước không đổi kiến trúc nền.

**Changed**

- `12-styling-theming-a11y.md` §12.6 từ `[SHOULD]` thành `[MUST]`: bỏ câu "không dựng file CSS 'global' thứ hai" và "`globals.css` = reset + base + import `tokens.css`". Thay bằng: layout gốc và `global-error.tsx` cùng nạp `tokens.css`, `components.css`, `globals.css` theo thứ tự đó và cùng đặt class font lên `<html>`, không `@import`; màn hình chỉ dùng token semantic và class của `components.css`; không Tailwind hay thư viện UI; nghĩa của hậu tố `-foreground`, `-text`, `-tint`, với ngoại lệ `--muted-foreground`. Minh chứng: `src/styles/components.css`, `src/styles/tokens.test.ts`, `src/app/global-error.test.tsx`, PR #19.
- `15-performance.md` §15.5: font là Be Vietnam Pro 500, 600, 700, ba subset, font dự phòng chỉnh cỡ, không truyền `fallback`, thay Inter variable. Minh chứng: `src/config/fonts.ts`, `e2e/design-system.spec.ts`.

**Added**

- `19-quick-reference.md`: dòng `components.css` ở bảng "Code này đặt ở đâu?", và một mục checklist PR cho §12.6.

### [1.0.0] — 2026-07-22

Phát hành lần đầu bộ coding convention, biên soạn bám sát codebase thực tế (`src/`, `e2e/`, config gốc), gồm 20 chương (00–19):

- **Added** — 00 Tech Stack · 01 Core Principles · 02 Project Structure · 03 Naming Conventions · 04 TypeScript · 05 Server & Client Components · 06 Routing & Navigation · 07 Rendering & Caching · 08 Data Access & Validation · 09 Server Actions & Forms · 10 State Management · 11 Internationalization · 12 Styling · Theming · A11y · 13 Error Handling & Observability · 14 Security · Auth · Config · 15 Performance · 16 SEO & Metadata · 17 Testing · 18 Tooling & Git · 19 Quick Reference.
- Thiết lập hệ thống nhãn `[MUST]` / `[SHOULD]` / `[MAY]` và chính sách version.
- Ghi nhận baseline codebase: Next.js 16.2.9 · React 19.2.7 · TypeScript 6.0.3 · Node 24.17.0 · pnpm 11.8.0, kiến trúc server-first BFF với `cacheComponents` (PPR) bật toàn app.
