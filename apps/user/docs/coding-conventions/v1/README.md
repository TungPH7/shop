# Coding Conventions — v1

> **Version:** 1.0.0 · **Cập nhật:** 2026-07-22 · **Trạng thái:** Active
> SSOT quy ước code cho **codebase1 UI** (Next.js 16 App Router + React 19 + TypeScript 6). Xem chính sách version tại [../README.md](../README.md).

## Nhãn mức độ

**[MUST]** = bắt buộc (enforce bằng lint/CI, vi phạm = block merge) · **[SHOULD]** = khuyến nghị mạnh (lệch phải nêu lý do trong PR) · **[MAY]** = tùy chọn.
Code mẫu: `✅` nên / `❌` tránh. Suy luận/chưa kiểm chứng: `[Inference]` / `[Unverified]`.

## Mục lục

| #   | Chủ đề                                       | File                                                                               |
| --- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| 00  | Tech Stack & Runtime Baseline                | [00-tech-stack.md](./00-tech-stack.md)                                             |
| 01  | Core Principles (nguyên tắc cốt lõi)         | [01-core-principles.md](./01-core-principles.md)                                   |
| 02  | Project Structure & Architecture Boundaries  | [02-project-structure.md](./02-project-structure.md)                               |
| 03  | Naming Conventions                           | [03-naming-conventions.md](./03-naming-conventions.md)                             |
| 04  | TypeScript Conventions                       | [04-typescript.md](./04-typescript.md)                                             |
| 05  | Server & Client Components                   | [05-server-and-client-components.md](./05-server-and-client-components.md)         |
| 06  | Routing & Navigation (App Router)            | [06-routing-and-navigation.md](./06-routing-and-navigation.md)                     |
| 07  | Rendering & Caching (Cache Components · PPR) | [07-rendering-and-caching.md](./07-rendering-and-caching.md)                       |
| 08  | Data Access & Validation (BFF · Zod)         | [08-data-access-and-validation.md](./08-data-access-and-validation.md)             |
| 09  | Mutations — Server Actions & Forms           | [09-server-actions-and-forms.md](./09-server-actions-and-forms.md)                 |
| 10  | State Management                             | [10-state-management.md](./10-state-management.md)                                 |
| 11  | Internationalization (i18n)                  | [11-internationalization.md](./11-internationalization.md)                         |
| 12  | Styling · Theming · Accessibility            | [12-styling-theming-a11y.md](./12-styling-theming-a11y.md)                         |
| 13  | Error Handling & Observability               | [13-error-handling-and-observability.md](./13-error-handling-and-observability.md) |
| 14  | Security · Auth · Config                     | [14-security-auth-config.md](./14-security-auth-config.md)                         |
| 15  | Performance                                  | [15-performance.md](./15-performance.md)                                           |
| 16  | SEO & Metadata                               | [16-seo-and-metadata.md](./16-seo-and-metadata.md)                                 |
| 17  | Testing                                      | [17-testing.md](./17-testing.md)                                                   |
| 18  | Tooling & Git Workflow                       | [18-tooling-and-git.md](./18-tooling-and-git.md)                                   |
| 19  | Quick Reference & PR Checklist               | [19-quick-reference.md](./19-quick-reference.md)                                   |

## Đọc theo lộ trình

- **Mới vào team (ngày đầu):** 01 → 02 → 03 → 05 → 19.
- **Trước khi viết feature đầu tiên:** 06 → 07 → 08 → 09 → 17.
- **Review PR:** 01 + 19 (checklist) + chương liên quan tới diff.
- **Senior / setup môi trường:** 00 → 04 → 14 → 18 → 17.

## Feature tham chiếu

`src/features/product/` là **slice chuẩn** đã ráp đủ mọi tầng (`model` → `server` → `actions` → `api` → `components`). Khi phân vân "code này đặt ở đâu, viết thế nào", soi feature này trước.
