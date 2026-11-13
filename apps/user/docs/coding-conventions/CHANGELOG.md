# Changelog — Coding Conventions

Tất cả thay đổi đáng chú ý của bộ tài liệu coding convention được ghi ở đây.
Định dạng theo [Keep a Changelog](https://keepachangelog.com/); đánh version theo [SemVer](https://semver.org/) trong phạm vi mỗi thư mục `vN/`.

## [Unreleased]

_(Chưa có thay đổi chờ phát hành.)_

---

## v1

### [1.0.0] — 2026-07-22

Phát hành lần đầu bộ coding convention, biên soạn bám sát codebase thực tế (`src/`, `e2e/`, config gốc), gồm 20 chương (00–19):

- **Added** — 00 Tech Stack · 01 Core Principles · 02 Project Structure · 03 Naming Conventions · 04 TypeScript · 05 Server & Client Components · 06 Routing & Navigation · 07 Rendering & Caching · 08 Data Access & Validation · 09 Server Actions & Forms · 10 State Management · 11 Internationalization · 12 Styling · Theming · A11y · 13 Error Handling & Observability · 14 Security · Auth · Config · 15 Performance · 16 SEO & Metadata · 17 Testing · 18 Tooling & Git · 19 Quick Reference.
- Thiết lập hệ thống nhãn `[MUST]` / `[SHOULD]` / `[MAY]` và chính sách version.
- Ghi nhận baseline codebase: Next.js 16.2.9 · React 19.2.7 · TypeScript 6.0.3 · Node 24.17.0 · pnpm 11.8.0, kiến trúc server-first BFF với `cacheComponents` (PPR) bật toàn app.
