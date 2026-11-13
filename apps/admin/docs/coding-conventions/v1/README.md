# Coding Conventions — v1

> **Version:** 1.0.0 &nbsp;·&nbsp; **Trạng thái:** ✅ Active &nbsp;·&nbsp; **Cập nhật:** 2026-07-22
> SSOT quy ước code cho **codebase1 UI** — React 19 + TypeScript + Vite (SPA, không phải Next.js).
> Chính sách version: xem [../README.md](../README.md).

## Nhãn mức độ

🔴 **[MUST]** bắt buộc, vi phạm = block merge · 🟡 **[SHOULD]** khuyến nghị mạnh, lệch phải nêu lý do trong PR · 🟢 **[MAY]** tùy chọn · ⏳ **[PLANNED]** chưa áp dụng vào codebase.

Mỗi rule có ID grep được (`NM-004`) — cite ID khi review PR. Code mẫu: `✅` nên / `❌` tránh.

## Mục lục

| # | Chủ đề | File | Đọc |
|---|---|---|---|
| 00 | Introduction — mục đích, scope, severity, rule ID | [00-introduction.md](./00-introduction.md) | 4' |
| 01 | Tech Stack & chính sách version | [01-tech-stack.md](./01-tech-stack.md) | 3' |
| 02 | Core Principles — 10 nguyên tắc nền | [02-core-principles.md](./02-core-principles.md) | 4' |
| 03 | Project Structure — layering, no-barrel | [03-project-structure.md](./03-project-structure.md) | 7' |
| 04 | Naming Conventions | [04-naming-conventions.md](./04-naming-conventions.md) | 5' |
| 05 | TypeScript | [05-typescript.md](./05-typescript.md) | 7' |
| 06 | Components & Hooks | [06-components-and-hooks.md](./06-components-and-hooks.md) | 7' |
| 07 | Routing | [07-routing.md](./07-routing.md) | 6' |
| 08 | API Layer | [08-api-layer.md](./08-api-layer.md) | 7' |
| 09 | State Management — server · client · URL | [09-state-management.md](./09-state-management.md) | 8' |
| 10 | Forms & Validation | [10-forms-and-validation.md](./10-forms-and-validation.md) | 5' |
| 11 | Auth & RBAC | [11-auth-and-rbac.md](./11-auth-and-rbac.md) | 6' |
| 12 | Error Handling | [12-error-handling.md](./12-error-handling.md) | 6' |
| 13 | Observability — logger · monitoring · analytics | [13-observability.md](./13-observability.md) | 5' |
| 14 | Internationalization (i18n) | [14-i18n.md](./14-i18n.md) | 5' |
| 15 | UI & Accessibility | [15-ui-and-accessibility.md](./15-ui-and-accessibility.md) | 4' |
| 16 | Testing | [16-testing.md](./16-testing.md) | 8' |
| 17 | Security | [17-security.md](./17-security.md) | 5' |
| 18 | Performance | [18-performance.md](./18-performance.md) | 5' |
| 19 | Tooling · Git · CI | [19-tooling-git-ci.md](./19-tooling-git-ci.md) | 6' |
| 20 | Quick Reference & PR Checklist | [20-quick-reference.md](./20-quick-reference.md) | 5' |

## Lộ trình đọc

Đừng đọc hết một lượt. Chọn lộ trình theo việc bạn đang làm:

| Bạn là / bạn đang | Đọc | Thời gian |
|---|---|---|
| **Mới vào team** | 00 → 02 → 03 → 04 → 05 → 06 → 09 → 20 | ~45' |
| **Review PR** | 20 (checklist) + file chủ đề liên quan | ~10' |
| **Thêm feature mới** | 03 → 08 → 09 → 10 → 16 | ~35' |
| **Đụng vào hạ tầng / setup** | 01 → 03 → 13 → 17 → 19 | ~26' |
| **Còn lại** | Tra cứu theo nhu cầu | — |

## Scope

| Trong scope | Ngoài scope |
|---|---|
| React 19 SPA + TypeScript + Vite | Next.js / SSR / RSC |
| Kiến trúc feature-first, layering | Backend / API contract design |
| State: TanStack Query · Redux Toolkit · nuqs | Hạ tầng deploy, K8s, CDN |
| Form, routing, auth/RBAC phía client | Database, migration |
| Testing (Vitest/RTL/MSW/Playwright) | Thiết kế UX / design system |
| Security phía client, performance bundle | Capacity planning, SRE |

## Thay đổi version

| Hành động | Kết quả |
|---|---|
| Thêm rule additive (không conflict) | Sửa file trong `v1/` → bump 1.0.0 → 1.1.0 + ghi `CHANGELOG.md` |
| Làm rõ wording / sửa ví dụ | Sửa file trong `v1/` → bump patch (1.1.0 → 1.1.1) |
| Đảo ngược / xóa rule | Tạo `v2/`, copy v1 + sửa, đánh dấu `v1/` `Superseded by v2` |

## Liên kết

- **Chính sách version + rule ID scheme:** [../README.md](../README.md)
- **Lịch sử thay đổi:** [../CHANGELOG.md](../CHANGELOG.md)
