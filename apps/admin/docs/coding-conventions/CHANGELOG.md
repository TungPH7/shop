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
