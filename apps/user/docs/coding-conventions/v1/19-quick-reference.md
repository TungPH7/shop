# 19 — Quick Reference & PR Checklist

> Trang tra nhanh. Bookmark trang này; mở chương chi tiết khi cần.

## 19.1 "Code này đặt ở đâu?"

| Bạn đang viết                                         | Đặt tại                                         | Chương   |
| ----------------------------------------------------- | ----------------------------------------------- | -------- |
| Type / schema Zod / logic thuần của feature           | `features/<x>/model/`                           | §02, §08 |
| Gọi backend (đọc dữ liệu)                             | `features/<x>/server/` + `import 'server-only'` | §08      |
| Mutation client gọi được                              | `features/<x>/actions/` (`"use server"`)        | §09      |
| Hook TanStack Query                                   | `features/<x>/api/`                             | §10      |
| UI của feature                                        | `features/<x>/components/`                      | §02      |
| UI dùng chung ≥2 feature                              | `src/components/`                               | §02      |
| Hạ tầng (http, auth, errors, logger, seo, validation) | `src/lib/<domain>/`                             | §02      |
| Client/UI state toàn cục                              | `src/stores/` + facade                          | §10      |
| Route                                                 | `src/app/[locale]/<path>/page.tsx` (mỏng)       | §06      |
| Endpoint cho client / webhook                         | `src/app/api/<path>/route.ts`                   | §06      |
| Chuỗi hiển thị                                        | `messages/{en,vi}.json`                         | §11      |
| Màu / spacing                                         | `src/styles/tokens.css` (semantic token)        | §12      |

## 19.2 "Dùng cái gì?"

| Nhu cầu                   | Dùng                               | ❌ Không dùng                  |
| ------------------------- | ---------------------------------- | ------------------------------ |
| Đọc dữ liệu backend       | RSC + DAL                          | `fetch` trong Client Component |
| Ghi dữ liệu               | Server Action                      | Route Handler + fetch tay      |
| State share/bookmark được | nuqs (URL)                         | Redux                          |
| State nhớ qua phiên       | Redux qua `~/stores/*`             | Import `react-redux` trực tiếp |
| Fetch lại phía client     | TanStack Query ở `features/*/api`  | `useEffect` + `fetch`          |
| Form đơn giản             | `<form action>` + `useActionState` | —                              |
| Form phức tạp             | RHF + zodResolver                  | `<form action>`                |
| Điều hướng                | `~/i18n/navigation`                | `next/link`, `next/navigation` |
| Ghi log                   | `~/lib/logger`                     | `console.log`                  |
| Báo lỗi                   | `captureError`                     | `console.error`                |
| Đọc env                   | `~/config/env/{client,server}`     | `process.env` thô              |
| Ảnh                       | `next/image`                       | `<img>`                        |
| Invalidate sau mutation   | `updateTag('x')`                   | `revalidateTag` trong action   |

## 19.3 Lệnh hay dùng

```bash
pnpm dev                 # dev (BẮT BUỘC verify khi có <form action> / provider client)
pnpm typecheck           # gate
pnpm lint                # gate
pnpm format              # sửa format
pnpm test                # unit + integration
pnpm test:coverage       # + enforce threshold (như CI)
pnpm build && pnpm start # kiểm tra PPR thật (◐) + hành vi prod
pnpm e2e                 # Playwright (cần build trước)
pnpm analyze             # bundle
```

## 19.4 Top 10 bẫy hay gặp

| #   | Triệu chứng                                  | Nguyên nhân & cách sửa                                                         |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Build lỗi `Uncached data outside <Suspense>` | Đọc request-time ở static shell → bọc `<Suspense>` (§07)                       |
| 2   | Route ra `ƒ` thay vì `◐`                     | Layout/metadata đọc request-time → xem §07, §16                                |
| 3   | `Math.random() in Client Component`          | Provider client-state ở root → scope vào dynamic hole (§10)                    |
| 4   | Build treo rồi fail                          | Vi phạm luật cô lập `'use cache'` → đưa việc đọc ra ngoài (§07)                |
| 5   | Xoá xong vẫn thấy item cũ                    | Dùng `revalidateTag` thay `updateTag` (§07)                                    |
| 6   | Lỗi `blocking-route` chỉ khi chạy `dev`      | `<form action>` ngoài `<Suspense>` → luôn verify bằng `pnpm dev` (§09)         |
| 7   | Hydration mismatch ở switcher                | Dùng `useEffect`+`useState('mounted')` → đổi sang `useSyncExternalStore` (§12) |
| 8   | Test lỗi "t3-env: server variable on client" | Thiếu `// @vitest-environment node` (§17)                                      |
| 9   | ESLint kêu boundary nhưng import đúng        | Quên thêm tên feature vào mảng `FEATURES` trong `eslint.config.mjs` (§02)      |
| 10  | `t(code)` báo TS2345                         | next-intl cấm key động → build map key tĩnh ở server (§09, §11)                |

## 19.5 PR Checklist

**Trước khi mở PR:**

- [ ] `pnpm typecheck` xanh
- [ ] `pnpm lint` xanh (không thêm `eslint-disable` mà thiếu lý do)
- [ ] `pnpm format:check` xanh
- [ ] `pnpm test` xanh, có test cho code mới
- [ ] `pnpm build` xanh — **route mới hiện `◐`**
- [ ] Verify tay bằng `pnpm dev` (bắt buộc nếu có form / provider client)
- [ ] Feature mới → đã thêm tên vào `FEATURES` ở `eslint.config.mjs`
- [ ] Chuỗi mới → đã thêm vào **cả** `en.json` và `vi.json`
- [ ] Commit theo Conventional Commits, subject một dòng

**Reviewer kiểm:**

- [ ] Ranh giới tầng đúng (`shared → features → app`, không import chéo feature)
- [ ] `"use client"` ở lá, không ở gốc; island nhỏ nhất có thể
- [ ] Module chạm secret/backend có `import 'server-only'`
- [ ] Server Action đủ **4 bước**: validate → re-authz → delegate → invalidate
- [ ] Dữ liệu từ ngoài đều qua Zod; DTO **tối thiểu**, không lộ field thừa
- [ ] Không có `any`, không `console.*`, không hardcode màu, không barrel file
- [ ] Không thêm `useMemo`/`useCallback` tay khi chưa đo (React Compiler lo)
- [ ] Rule kiến trúc thay đổi → tài liệu convention cập nhật **trong cùng PR**

## 19.6 Nguyên tắc cốt lõi — nhắc lại

1. **Server-first** — client là ngoại lệ có chủ đích.
2. **Enforce bằng máy** — rule không ép được thì chỉ là gợi ý.
3. **Parse, don't validate** — Zod ở mọi biên.
4. **Ranh giới một chiều** — `shared → features → app`.
5. **Vendor sau seam** — đổi vendor không đụng feature.
6. **Không tin client** — server luôn kiểm tra lại.
7. **Đo trước khi tối ưu.**
8. **Đừng lắp seam sớm.**
