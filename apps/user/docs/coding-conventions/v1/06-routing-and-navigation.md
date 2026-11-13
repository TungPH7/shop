# 06 — Routing & Navigation (App Router)

## 6.1 `app/` chỉ làm routing — `[MUST]`

`src/app/**` chỉ chứa file theo quy ước của Next. `page.tsx` **mỏng**:

```tsx
// ✅ page: await params → giao cho feature
export default async function ProductsPage({ params }: PageParams) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProductShell locale={locale} />; // feature lo phần còn lại
}
```

❌ Không business logic, không gọi `lib/http` trực tiếp, không dựng UI phức tạp trong `app/`.

## 6.2 Special files — `[MUST]` biết

| File                                                            | Vai trò                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `layout.tsx`                                                    | Khung bao quanh, giữ state khi điều hướng trong cùng segment                          |
| `page.tsx`                                                      | UI của route                                                                          |
| `loading.tsx`                                                   | Fallback Suspense cấp segment                                                         |
| `error.tsx`                                                     | Error boundary (`"use client"`) — bọc page + con, **không** bọc `layout` cùng segment |
| `global-error.tsx`                                              | Lưới cuối cho lỗi ở root layout; tự render `<html>/<body>`                            |
| `not-found.tsx`                                                 | Đích của `notFound()`                                                                 |
| `route.ts`                                                      | Route Handler (REST endpoint)                                                         |
| `sitemap.ts` · `robots.ts` · `opengraph-image.tsx` · `icon.svg` | Metadata file-based (→ §16)                                                           |

## 6.3 Quy ước thư mục — `[MUST]`

| Cú pháp       | Nghĩa                        | Có vào URL?     |
| ------------- | ---------------------------- | --------------- |
| `products/`   | Segment thường               | ✅ `/products`  |
| `[locale]`    | Dynamic segment              | ✅ giá trị thật |
| `(marketing)` | Route group — chỉ để tổ chức | ❌              |
| `_private`    | Opt-out khỏi routing         | ❌              |

Vì các tên này do Next quy định nên `src/app` được **nới khỏi** rule kebab-case cho thư mục (§03) — kebab vẫn áp cho mọi **file**.

## 6.4 i18n path-based — `[MUST]`

- **Mọi route nằm dưới `app/[locale]/`.** Locale là một phần URL.
- **Root layout nằm ở `app/[locale]/layout.tsx`** (nơi render `<html lang={locale}>`). **Không** có `app/layout.tsx` riêng.
- `generateStaticParams` sinh sẵn trang cho từng locale. **[MUST]** Không trả mảng rỗng (`cacheComponents` cấm).
- Cấu hình locale tập trung ở `~/config/i18n.ts` (`locales` / `defaultLocale` / `Locale` / `isLocale`).

## 6.5 `params` và `searchParams` là Promise — `[MUST]`

Breaking change của Next 16 — **luôn phải `await`**:

```tsx
// ✅ khai type tường minh
type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();   // validate + thu hẹp type
  …
}
```

- **[MUST]** Không dùng helper `PageProps<>` / `LayoutProps<>` của Next — chúng cần `.next/types` sinh sau build, nên `pnpm typecheck` khi chưa build sẽ hỏng.
- **[MUST]** Validate `params` bằng guard (`isLocale`) → `notFound()` nếu sai. Vừa an toàn vừa thu hẹp kiểu để truyền xuống feature.
- `searchParams` là input người dùng → parse bằng Zod schema **tha thứ** (→ §08).

## 6.6 Navigation — `[MUST]`

Luôn dùng API locale-aware của `~/i18n/navigation` (`Link`, `redirect`, `useRouter`, `usePathname`), **không** import từ `next/link` hay `next/navigation`.

```tsx
// ✅ tự thêm tiền tố locale
import { Link } from '~/i18n/navigation';
<Link href="/about">About</Link>

// ❌ tự nối chuỗi
<a href={`/${locale}/about`}>About</a>
```

> ⚠️ `redirect` của next-intl bị TS suy ra `void` (không phải `never`): trong Server Action phải `return` sau khi gọi; trong guard phải `throw` sau khi gọi.

## 6.7 `proxy.ts` (thay `middleware.ts`) — `[MUST]`

- Đặt ở `src/proxy.ts`. Nội dung hiện tại: `createMiddleware(routing)` của next-intl.
- Chạy **Node runtime**; `matcher` loại trừ `api|_next/*|asset|metadata` để không chặn tài nguyên tĩnh.
- **[MUST] `proxy` KHÔNG phải security boundary** (bài học CVE-2025-29927). ❌ Không đặt quyết định authz ở đây. Authz thật verify ở **DAL / Server Action** (→ §14).
- ❌ Không truy vấn DB, không logic nặng, không fetch lớn trong proxy.

## 6.8 Route Handler vs Server Action — `[MUST]`

| Nhu cầu                                   | Dùng                                     |
| ----------------------------------------- | ---------------------------------------- |
| Mutation phát sinh từ UI của ta           | **Server Action** (→ §09)                |
| Client cần fetch dữ liệu (TanStack Query) | **Route Handler** `app/api/*` → DAL      |
| Webhook / caller ngoài / cron             | **Route Handler**                        |
| Revalidate theo tag từ hệ thống ngoài     | **Route Handler** (nhớ bảo vệ bằng auth) |

Route Handler cũng chỉ **mỏng**: parse → gọi DAL → trả JSON.
