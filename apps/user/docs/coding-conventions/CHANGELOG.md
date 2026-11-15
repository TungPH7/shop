# Changelog — Coding Conventions

Tất cả thay đổi đáng chú ý của bộ tài liệu coding convention được ghi ở đây.
Định dạng theo [Keep a Changelog](https://keepachangelog.com/); đánh version theo [SemVer](https://semver.org/) trong phạm vi mỗi thư mục `vN/`.

## [Unreleased]

_(Chưa có thay đổi chờ phát hành.)_

---

## v1

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
